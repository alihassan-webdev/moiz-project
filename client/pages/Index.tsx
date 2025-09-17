import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Download } from "lucide-react";

type ApiResult = string;

type AppSettings = {
  initialTimeoutMs: number;
  retryTimeoutMs: number;
  autoRetry: boolean;
  defaultQuery: string;
};

const SETTINGS_KEY = "app:settings" as const;
const DEFAULT_SETTINGS: AppSettings = {
  initialTimeoutMs: 25000,
  retryTimeoutMs: 55000,
  autoRetry: true,
  defaultQuery: "",
};

const MAX_SIZE = 15 * 1024 * 1024; // 15MB

// API endpoint selection: env override > Netlify functions > Vercel/Node API
const API_URL = (() => {
  const env = import.meta.env.VITE_PREDICT_ENDPOINT as string | undefined;
  if (env) return env;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isNetlify = host.includes("netlify.app") || host.includes("netlify");
    if (isNetlify) return "/api/generate-questions";
  }
  // No default direct URL; use fallback list below to adapt to envs (dev, vercel, netlify)
  return "";
})();

function ExternalPdfSelector({
  onLoadFile,
  onSetPrompt,
  onGenerate,
  onReset,
  loading,
}: {
  onLoadFile: (f: File | null) => void;
  onSetPrompt: (p: string) => void;
  onGenerate: (prompt?: string) => Promise<void> | void;
  onReset: () => void;
  loading?: boolean;
}) {
  const pdfModules = import.meta.glob("/datafiles/**/*.pdf", {
    as: "url",
    eager: true,
  }) as Record<string, string>;
  const entries = Object.entries(pdfModules).map(([path, url]) => ({
    path,
    url,
    name: path.split("/").pop() || "file.pdf",
  }));
  const byClass = entries.reduce<
    Record<string, { path: string; url: string; name: string }[]>
  >((acc, cur) => {
    // extract class folder name
    const m = cur.path.replace(/^\/?datafiles\//, "");
    const parts = m.split("/");
    const cls = parts[0] || "Other";
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(cur);
    return acc;
  }, {});

  const classOptions = Object.keys(byClass).sort();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [subjectOptions, setSubjectOptions] = useState<
    { path: string; url: string; name: string }[]
  >([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>("");
  const [selectedSubjectPath, setSelectedSubjectPath] = useState<string>("");
  const [totalMarks, setTotalMarks] = useState<number | null>(null);
  const [promptText, setPromptText] = useState("");

  const buildPaperSchemePrompt = (
    subjectName: string,
    cls: string,
    marks: number,
  ) => {
    // Build a prompt that asks the AI to generate a full exam paper (questions, not just scheme)
    return `Generate a complete exam-style question paper for Class ${cls} in the subject "${subjectName}" of total ${marks} marks.\n\nStructure requirements:\n1) Section A - MCQs: allocate between 10% and 20% of total marks to MCQs. Each MCQ should be 1 mark and include four options labeled a), b), c), d). Number all MCQs sequentially (Q1, Q2, ...).\n2) Section B - Short Questions: allocate between 30% and 40% of total marks. Each short question should be 4 or 5 marks. Number questions sequentially continuing from MCQs.\n3) Section C - Long Questions: allocate between 30% and 40% of total marks. Each long question should be 8 to 10 marks. Number questions sequentially continuing from Section B.\n\nContent and formatting instructions:\n- Provide actual question text for every item (do NOT output only a scheme).\n- For MCQs include clear options (a/b/c/d) and ensure only one correct option logically exists (do NOT reveal answers).\n- Short and long questions should be clear, exam-style (descriptive, conceptual or numerical as appropriate), and require the indicated length of answer.\n- Use headings exactly: "Section A - MCQs", "Section B - Short Questions", "Section C - Long Questions".\n- Use numbering like Q1, Q2, Q3 ... across the paper.\n- Ensure the marks per question and number of questions sum exactly to the total ${marks} marks. If multiple valid distributions exist, choose a balanced distribution that fits the percentage ranges and explain the distribution briefly at the top in one line.\n- Do NOT provide answers or solutions.\n- Keep layout professional and easy to read (use line breaks, headings, and spacing similar to an exam paper).\n\nOutput only the exam paper text (no metadata, no commentary).`;
  };

  const subjectOf = (p: string) => {
    const m = p.replace(/^\/?datafiles\//, "");
    const parts = m.split("/");
    return parts[1] || "General";
  };

  useEffect(() => {
    const arr = selectedClass ? byClass[selectedClass] || [] : [];
    setSubjectOptions(arr);
    const subs = Array.from(new Set(arr.map((e) => subjectOf(e.path)))).sort();
    setSubjects(subs);
    setSelectedSubjectName("");
    setSelectedSubjectPath("");
  }, [selectedClass]);

  const handleSelectSubject = (name: string) => {
    setSelectedSubjectName(name);
    setSelectedSubjectPath("");
    onLoadFile(null);
  };

  const handleSelectChapter = async (path: string) => {
    if (!path) return;
    const found = entries.find((e) => e.path === path);
    if (!found) return;
    try {
      const res = await fetch(found.url);
      const blob = await res.blob();
      const f = new File([blob], found.name, { type: "application/pdf" });
      onLoadFile(f);
      setSelectedSubjectPath(path);
    } catch (err: any) {
      if (err?.name === "AbortError") return; // ignore user/navigation aborts silently
      toast({ title: "Load failed", description: "Could not load PDF." });
    }
  };

  return (
    <div className="rounded-xl card-yellow-shadow border border-muted/20 bg-card/60 p-6 sm:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Class</label>
          <Select
            value={selectedClass}
            onValueChange={(v) => setSelectedClass(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={`transition-opacity ${!selectedClass ? "opacity-50 pointer-events-none" : ""}`}
        >
          <label className="text-xs text-muted-foreground">Subject</label>
          <Select
            value={selectedSubjectName}
            onValueChange={(name) => handleSelectSubject(name)}
          >
            <SelectTrigger className="w-full" disabled={!selectedClass}>
              <SelectValue
                placeholder={
                  selectedClass ? "Select subject" : "Select class first"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={`transition-opacity ${!selectedSubjectName ? "opacity-50 pointer-events-none" : ""}`}
        >
          <label className="text-xs text-muted-foreground">Chapter</label>
          <Select
            value={selectedSubjectPath}
            onValueChange={(p) => {
              setSelectedSubjectPath(p);
              handleSelectChapter(p);
            }}
          >
            <SelectTrigger className="w-full" disabled={!selectedSubjectName}>
              <SelectValue
                placeholder={
                  selectedSubjectName
                    ? "Select chapter (PDF)"
                    : "Select subject first"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(subjectOptions || [])
                .filter(
                  (s) =>
                    selectedSubjectName &&
                    subjectOf(s.path) === selectedSubjectName,
                )
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((s) => (
                  <SelectItem key={s.path} value={s.path}>
                    {s.name.replace(/\.pdf$/i, "")}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={`transition-opacity ${!selectedSubjectPath ? "opacity-50 pointer-events-none" : ""}`}
        >
          <label className="text-xs text-muted-foreground">Total Marks</label>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="number"
              min={20}
              max={100}
              value={totalMarks ?? ""}
              onChange={(e) => {
                const v = e.currentTarget.value;
                const n = v === "" ? null : Number(v);
                setTotalMarks(n);
              }}
              disabled={!selectedSubjectPath || !!loading}
              className="w-24 rounded-md border border-input bg-muted/40 px-2 py-2 text-sm"
              placeholder="Marks"
            />
            <button
              type="button"
              onClick={() => setTotalMarks(30)}
              disabled={!selectedSubjectPath || !!loading}
              aria-pressed={totalMarks === 30}
              className={`rounded-md px-3 py-2 text-sm border ${totalMarks === 30 ? "bg-secondary text-secondary-foreground border-secondary" : "bg-muted/40 text-foreground/90 border-input hover:bg-muted/60"}`}
            >
              30
            </button>
            <button
              type="button"
              onClick={() => setTotalMarks(50)}
              disabled={!selectedSubjectPath || !!loading}
              aria-pressed={totalMarks === 50}
              className={`rounded-md px-3 py-2 text-sm border ${totalMarks === 50 ? "bg-secondary text-secondary-foreground border-secondary" : "bg-muted/40 text-foreground/90 border-input hover:bg-muted/60"}`}
            >
              50
            </button>
            <button
              type="button"
              onClick={() => setTotalMarks(100)}
              disabled={!selectedSubjectPath || !!loading}
              aria-pressed={totalMarks === 100}
              className={`rounded-md px-3 py-2 text-sm border ${totalMarks === 100 ? "bg-secondary text-secondary-foreground border-secondary" : "bg-muted/40 text-foreground/90 border-input hover:bg-muted/60"}`}
            >
              100
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter 20–100 or use quick buttons
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          disabled={loading}
          onClick={async () => {
            if (!selectedSubjectPath)
              return toast({
                title: "Select PDF",
                description: "Please choose a PDF to use.",
              });
            const subjectName = selectedSubjectName || "";
            if (totalMarks == null) {
              return toast({
                title: "Enter total marks",
                description: "Please enter a value between 20 and 100.",
              });
            }
            // Clamp marks just before generating
            const marks = Math.min(100, Math.max(20, Number(totalMarks)));
            if (marks !== totalMarks) setTotalMarks(marks);
            const generated = buildPaperSchemePrompt(
              subjectName,
              selectedClass || "",
              marks,
            );
            onSetPrompt(generated);
            await onGenerate(generated);
          }}
          className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-2 w-2 rounded-full bg-white/90 animate-pulse" />
              <span>Generating...</span>
            </>
          ) : (
            "Generate"
          )}
        </button>

        <button
          disabled={loading}
          onClick={() => {
            // clear local selections
            setSelectedClass("");
            setSelectedSubjectPath("");
            setTotalMarks(null);
            setPromptText("");
            // clear parent state
            onLoadFile(null);
            onSetPrompt("");
            onReset();
          }}
          className="rounded-md bg-muted/40 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        const s = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(s);
        if (s.defaultQuery) setQuery(s.defaultQuery);
      }
    } catch {}
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleFile = (f: File) => {
    if (
      f.type !== "application/pdf" &&
      !f.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please upload a valid PDF file.");
      setFile(null);
      toast({
        title: "Invalid file",
        description: "Only PDF files are supported.",
      });
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("PDF exceeds 15MB limit.");
      setFile(null);
      toast({
        title: "File too large",
        description: "Please upload a PDF up to 15MB.",
      });
      return;
    }
    setError(null);
    setFile(f);
  };

  const onReset = () => {
    setFile(null);
    setQuery("");
    setError(null);
    setResult(null);
    const el = fileInputRef.current;
    if (el) el.value = "";
  };

  // Utility: promise timeout without aborting the underlying fetch
  const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
    return await new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error("timeout")), ms);
      p.then((v) => {
        clearTimeout(id);
        resolve(v);
      }).catch((e) => {
        clearTimeout(id);
        reject(e);
      });
    });
  };

  const runSubmit = async (fArg?: File | null, qArg?: string) => {
    setError(null);
    setResult(null);
    const theFile = fArg ?? file;
    const q = (qArg ?? query).trim();
    if (!theFile) {
      setError("Attach a PDF file first.");
      toast({ title: "Missing PDF", description: "Attach a PDF to continue." });
      return;
    }
    if (!q) {
      setError("Enter a query.");
      toast({ title: "Missing query", description: "Write what to generate." });
      return;
    }

    const sendTo = async (urlStr: string, timeoutMs: number) => {
      const isExternal = /^https?:/i.test(urlStr);

      let finalUrl = urlStr;
      // If external and a query is provided, attach as query param for compatibility
      if (isExternal && q) {
        try {
          const u = new URL(urlStr);
          u.searchParams.set("query", q);
          finalUrl = u.toString();
        } catch {}
      }

      try {
        console.debug("Attempting fetch ->", finalUrl, {
          isExternal,
          hasFile: !!theFile,
        });
        // If no file attached, send a lightweight JSON body with the query only
        if (!theFile) {
          const res = await withTimeout(
            fetch(finalUrl, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: q }),
              ...(isExternal
                ? {
                    mode: "cors" as const,
                    credentials: "omit" as const,
                    referrerPolicy: "no-referrer" as const,
                  }
                : {}),
            }),
            timeoutMs,
          );
          return res;
        }

        // Otherwise send multipart form with the PDF
        const form = new FormData();
        form.append("pdf", theFile);
        form.append("query", q);
        // External APIs may expect the field name "file"; include both for compatibility
        if (isExternal) {
          form.append("file", theFile);
        }

        const res = await withTimeout(
          fetch(finalUrl, {
            method: "POST",
            body: form,
            headers: { Accept: "application/json" },
            ...(isExternal
              ? {
                  mode: "cors" as const,
                  credentials: "omit" as const,
                  referrerPolicy: "no-referrer" as const,
                }
              : {}),
          }),
          timeoutMs,
        );
        return res;
      } catch (err: any) {
        try {
          if (err?.message === "timeout") {
            console.warn("Request timed out:", finalUrl);
          } else if (
            err?.message === "Failed to fetch" ||
            err?.name === "TypeError"
          ) {
            console.warn(
              "Network or CORS error when fetching:",
              finalUrl,
              err?.message ?? err,
            );
          } else if (err?.name === "AbortError") {
            // Should not happen now, but silently handle
            console.warn("Fetch aborted:", finalUrl);
          } else {
            console.warn("Fetch error:", finalUrl, err?.message ?? err);
          }
        } catch {}
        return null;
      }
    };

    // Check whether a lightweight request to the given URL responds (used to test proxies)
    const checkEndpoint = async (_urlStr: string, _timeoutMs = 3000) => {
      return true;
    };

    try {
      setLoading(true);
      let res: Response | null = null;

      // Try direct API endpoint (silent on failure; fallbacks below)
      if (API_URL) {
        res = await sendTo(API_URL, settings.initialTimeoutMs);
      }

      // If direct request failed (CORS or network), try internal proxies first then serverless
      if (!res) {
        const proxies = [
          "/.netlify/functions/proxy", // Vite dev proxy path (works locally)
          "/api/generate-questions", // Netlify redirect path (production on Netlify)
          "/api/proxy", // Express/Vercel proxy
          "/proxy", // Alternate express proxy path
        ];
        for (const proxyPath of proxies) {
          try {
            const attempt = await sendTo(proxyPath, settings.retryTimeoutMs);
            if (attempt && attempt.ok) {
              res = attempt;
              break;
            }
          } catch {
            // continue to next proxy
          }
        }
      }

      if (!res) {
        // If we get here, it likely failed due to CORS or network. Provide a helpful error.
        throw new Error(
          "Network or CORS error. If deployed on Netlify set VITE_PREDICT_ENDPOINT='/.netlify/functions/proxy' and PREDICT_ENDPOINT='https://api-va5v.onrender.com', or on Vercel set VITE_PREDICT_ENDPOINT='/api/proxy' and PREDICT_ENDPOINT='https://api-va5v.onrender.com'. Alternatively, enable CORS on the API.",
        );
      }

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.clone().text();
        } catch (e) {
          detail = res.statusText || "";
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      if (contentType.includes("application/json")) {
        try {
          const json = await res.clone().json();
          const text =
            typeof json === "string"
              ? json
              : (json?.questions ??
                json?.result ??
                json?.message ??
                JSON.stringify(json, null, 2));
          setResult(String(text));
        } catch (e) {
          // fallback if json parsing fails
          const txt = await res
            .clone()
            .text()
            .catch(() => "");
          setResult(txt);
        }
      } else {
        const text = await res.clone().text();
        setResult(text);
      }
    } catch (err: any) {
      const msg =
        err?.message === "timeout"
          ? "Request timed out. Please try again."
          : err?.message || "Request failed";
      setError(msg);
      toast({ title: "Request failed", description: msg });
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading) await runSubmit();
  };

  // Helper: escape HTML to avoid XSS
  const escapeHtml = (unsafe: string) =>
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Enhanced formatter: renumber per section, convert **bold** to <strong>, style headings, questions and options
  const formatResultHtml = (txt: string) => {
    if (!txt) return "";

    // 1) Renumber questions per section: reset to Q1 at each "Section ..." heading
    const renumbered = (() => {
      const lines = txt.split(/\r?\n/);
      let count = 0;
      let inSection = false;
      const out: string[] = [];
      const headingRe = /^\s*Section\s+[A-Z0-9\-–].*$/i;
      const qRe = /^(\s*)Q\d+\.\s*/i;
      for (const line of lines) {
        if (headingRe.test(line)) {
          inSection = true;
          count = 0;
          out.push(line);
          continue;
        }
        if (inSection && qRe.test(line)) {
          count += 1;
          out.push(line.replace(qRe, `$1Q${count}. `));
        } else {
          out.push(line);
        }
      }
      return out.join("\n");
    })();

    // 2) Escape HTML to avoid XSS
    let out = escapeHtml(renumbered);

    // 3) Convert bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // 4) Headings: lines starting with Section or Section A/B/C -> styled h3 in theme color
    out = out.replace(
      /^\s*(Section\s+[A-Z0-9\-–].*)$/gim,
      '<h3 class="text-xl font-extrabold text-secondary mb-3">$1</h3>',
    );

    // 5) Question lines 'Q1.' -> larger bold line
    out = out.replace(
      /^\s*(Q\d+\.)\s*(.*)$/gim,
      '<p class="text-lg font-semibold mb-3"><strong>$1</strong> $2</p>',
    );

    // 6) MCQ options like 'a) text'
    out = out.replace(
      /^\s*([a-d])\)\s*(.*)$/gim,
      '<div class="ml-6 mb-2 text-base"><strong class="mr-2">$1)</strong>$2</div>',
    );

    // 7) Paragraph spacing
    out = out.replace(/\n{2,}/g, '</p><p class="mb-4">');
    out = out.replace(/\n/g, "<br />");

    if (!out.startsWith("<h3>") && !out.startsWith("<p>")) {
      out = `<p class=\"mb-4\">${out}</p>`;
    }

    return out;
  };

  return (
    <div>
      <section className="relative overflow-hidden rounded-2xl px-6 pt-0 pb-12 sm:pt-0 sm:pb-14 -mt-5 text-white">
        <div className="absolute inset-0 bg-background -z-10" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl text-secondary drop-shadow-md">
            Test Paper Generater
          </h1>
          <p className="mt-3 text-sm text-white/90">
            Fast, accurate question generation tailored to your query.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-5xl space-y-6">
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}

          {/* External controls: Class -> Subject -> Prompt */}
          <div className="w-full max-w-4xl mx-auto order-2 sticky top-4 z-20">
            <ExternalPdfSelector
              onLoadFile={(f) => setFile(f)}
              onSetPrompt={(p) => setQuery(p)}
              onGenerate={async (p?: string) => await runSubmit(undefined, p)}
              onReset={onReset}
              loading={loading}
            />
          </div>

          {result && (
            <div className="order-1 mt-0 w-full max-w-5xl mx-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Result</h3>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Download PDF"
                    disabled={!result || !!loading}
                    onClick={async () => {
                      if (!result) return;
                      try {
                        const { jsPDF } = await import("jspdf");
                        const doc = new jsPDF({ unit: "pt", format: "a4" });
                        const margin = 72; // 1 inch margins
                        let y = margin; // start below top margin
                        const pageWidth = doc.internal.pageSize.getWidth();

                        function makeFilenameFromPrompt(q: string | undefined) {
                          const raw = (q || "").trim();
                          if (!raw) return "questions";
                          const verbs = [
                            "make",
                            "generate",
                            "produce",
                            "create",
                            "give",
                            "write",
                            "please",
                            "build",
                            "compose",
                            "form",
                          ];
                          let s = raw;
                          let changed = true;
                          while (changed) {
                            changed = false;
                            for (const v of verbs) {
                              const re = new RegExp("^" + v + "\\s+", "i");
                              if (re.test(s)) {
                                s = s.replace(re, "").trim();
                                changed = true;
                              }
                            }
                          }
                          s = s.replace(/^['"]+|['"]+$/g, "").trim();
                          let out = s.slice(0, 60).toLowerCase();
                          out = out.replace(/[^a-z0-9\s_-]/g, "");
                          out = out.trim().replace(/\s+/g, "_");
                          if (!out) return "questions";
                          return out;
                        }

                        const safeQuery = makeFilenameFromPrompt(query);
                        const filename = `${safeQuery}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;

                        doc.setFont("times", "bold");
                        doc.setFontSize(18);
                        doc.text("Test Paper Generater", pageWidth / 2, y, {
                          align: "center",
                        });
                        y += 30;

                        const dateStr = new Date().toLocaleString();
                        const promptText = (query || "").trim();
                        doc.setFont("times", "normal");
                        doc.setFontSize(12);
                        const header = `Query: ${promptText}`;
                        doc.text(header, margin, y);
                        y += 18;
                        doc.setDrawColor(200);
                        doc.setLineWidth(0.5);
                        doc.line(margin, y + 4, pageWidth - margin, y + 4);
                        y += 12;

                        const rawText = (result || "")
                          .replace(/\r\n/g, "\n")
                          .replace(/\n{3,}/g, "\n\n");

                        const lineHeight = 18; // 1.5x-ish line spacing
                        const paraGap = 12;
                        const pageHeight = doc.internal.pageSize.getHeight();
                        const usableWidth = pageWidth - margin * 2;

                        doc.setFont("times", "normal");
                        doc.setFontSize(12);

                        function ensurePageSpace(linesNeeded = 1) {
                          if (
                            y + lineHeight * linesNeeded >
                            pageHeight - margin
                          ) {
                            doc.addPage();
                            y = margin;
                            // running header on every new page
                            doc.setFont("times", "bold");
                            doc.setFontSize(12);
                            doc.text("Test Paper Generater", margin, y);
                            doc.setDrawColor(220);
                            doc.setLineWidth(0.5);
                            doc.line(margin, y + 6, pageWidth - margin, y + 6);
                            y += 16;
                          }
                        }

                        const paragraphs = rawText.split(/\n\s*\n/);
                        for (const para of paragraphs) {
                          const text = para.trim();
                          if (!text) {
                            y += paraGap;
                            continue;
                          }

                          const isSection =
                            /^\s*(section|part)\s+[A-Z0-9\-–]+/i.test(text);
                          const isQuestionLine =
                            /^(?:q\s*\d+|\d+[\.)]|\(\d+\))\s+/i.test(text);

                          if (isSection) {
                            doc.setFont("times", "bold");
                            doc.setFontSize(16);
                          } else if (isQuestionLine) {
                            doc.setFont("times", "bold");
                            doc.setFontSize(13);
                          } else {
                            doc.setFont("times", "normal");
                            doc.setFontSize(12);
                          }

                          const lines = text.split(/\n/);
                          for (let i = 0; i < lines.length; i++) {
                            const l = lines[i];
                            const isOption =
                              /^\s*(?:[A-Da-d][\).]|\([A-Da-d]\))\s+/.test(l);
                            const indent = isOption ? 18 : 0;
                            const wrap = doc.splitTextToSize(
                              l,
                              usableWidth - indent,
                            );
                            for (const w of wrap) {
                              ensurePageSpace(1);
                              doc.text(w, margin + indent, y);
                              y += lineHeight;
                            }
                            if (isOption) y -= 2; // slightly tighter between options
                          }
                          y += paraGap;
                        }

                        // Add watermark and footer on each page
                        const totalPages = doc.getNumberOfPages();
                        for (let i = 1; i <= totalPages; i++) {
                          doc.setPage(i);
                          // Watermark
                          const cx = doc.internal.pageSize.getWidth() / 2;
                          const cy = doc.internal.pageSize.getHeight() / 2;
                          doc.setFont("times", "bold");
                          doc.setFontSize(64);
                          doc.setTextColor(230);
                          doc.text("Test Paper Generater", cx, cy, {
                            align: "center",
                            angle: 0,
                          });
                          // Footer page number
                          doc.setFont("times", "normal");
                          doc.setFontSize(10);
                          doc.setTextColor(120);
                          const footerY =
                            doc.internal.pageSize.getHeight() - 30;
                          doc.text(
                            `Page ${i} of ${totalPages}`,
                            doc.internal.pageSize.getWidth() / 2,
                            footerY,
                            { align: "center" },
                          );
                          doc.setTextColor(0);
                        }

                        doc.save(filename);
                      } catch (err) {
                        console.error(err);
                        toast({
                          title: "Download failed",
                          description: "Could not generate PDF.",
                        });
                      }
                    }}
                    className="rounded-full bg-secondary p-2 text-secondary-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-card/60 p-8 text-base overflow-hidden">
                <div className="paper-view paper-watermark">
                  <div
                    className="paper-body prose prose-invert prose-lg leading-relaxed max-w-none break-words"
                    dangerouslySetInnerHTML={{
                      __html: formatResultHtml(result || ""),
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
