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

// API endpoint comes from environment; prefer Netlify dev proxy when running locally
const API_URL =
  (import.meta.env.VITE_PREDICT_ENDPOINT as string) ||
  (import.meta.env.DEV
    ? "/.netlify/functions/proxy"
    : "/api/generate-questions");

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

  useEffect(() => {
    setSubjectOptions(selectedClass ? byClass[selectedClass] || [] : []);
    setSelectedSubjectPath("");
  }, [selectedClass]);

  const handleSelectSubject = async (path: string) => {
    if (!path) return;
    const found = entries.find((e) => e.path === path);
    if (!found) return;
    try {
      const res = await fetch(found.url);
      const blob = await res.blob();
      const f = new File([blob], found.name, { type: "application/pdf" });
      onLoadFile(f);
      setSelectedSubjectPath(path);
    } catch (err) {
      toast({ title: "Load failed", description: "Could not load PDF." });
    }
  };

  return (
    <div className="rounded-md border border-muted/20 bg-card/60 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
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
            value={selectedSubjectPath}
            onValueChange={(p) => {
              setSelectedSubjectPath(p);
              handleSelectSubject(p);
            }}
          >
            <SelectTrigger className="w-full" disabled={!selectedClass}>
              <SelectValue
                placeholder={
                  selectedClass ? "Select subject (PDF)" : "Select class first"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((s) => (
                <SelectItem key={s.path} value={s.path}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={`transition-opacity ${!selectedClass ? "opacity-50 pointer-events-none" : ""}`}
        >
          <label className="text-xs text-muted-foreground">Total Marks</label>
          <input
            type="number"
            min={20}
            max={100}
            step={1}
            value={totalMarks ?? ""}
            placeholder="Enter"
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                setTotalMarks(null);
                return;
              }
              const n = Number(val);
              if (isNaN(n)) return;
              const clamped = Math.min(100, Math.max(20, Math.floor(n)));
              setTotalMarks(clamped);
            }}
            onBlur={(e) => {
              const val = e.target.value;
              if (val === "") return;
              const n = Number(val);
              if (isNaN(n)) return;
              const clamped = Math.min(100, Math.max(20, Math.floor(n)));
              if (clamped !== n) setTotalMarks(clamped);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
            disabled={!selectedClass}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter marks between 20 and 100
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
            // Ensure subject is loaded (handleSelectSubject already loads and calls onLoadFile)
            const found = entries.find((e) => e.path === selectedSubjectPath);
            const subjectName = found
              ? found.name.replace(/\.pdf$/i, "")
              : selectedSubjectPath || "";
            if (totalMarks == null) {
              return toast({
                title: "Enter total marks",
                description: "Please enter a value between 20 and 100.",
              });
            }
            const generated = buildPaperSchemePrompt(
              subjectName,
              selectedClass || "",
              totalMarks,
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

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      try {
        console.debug("Attempting fetch ->", finalUrl, {
          isExternal,
          hasFile: !!theFile,
        });
        // If no file attached, send a lightweight JSON body with the query only
        if (!theFile) {
          const res = await fetch(finalUrl, {
            method: "POST",
            signal: controller.signal,
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
          });
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

        const res = await fetch(finalUrl, {
          method: "POST",
          body: form,
          signal: controller.signal,
          headers: { Accept: "application/json" },
          ...(isExternal
            ? {
                mode: "cors" as const,
                credentials: "omit" as const,
                referrerPolicy: "no-referrer" as const,
              }
            : {}),
        });
        return res;
      } catch (err: any) {
        try {
          if (err?.name === "AbortError") {
            console.warn("Fetch aborted:", finalUrl, err?.message ?? err);
          } else if (
            err?.message === "Failed to fetch" ||
            err?.name === "TypeError"
          ) {
            // Likely network or CORS
            console.warn(
              "Network or CORS error when fetching:",
              finalUrl,
              err?.message ?? err,
            );
          } else {
            console.warn("Fetch error:", finalUrl, err?.message ?? err);
          }
        } catch {}
        return null;
      } finally {
        clearTimeout(t);
      }
    };

    // Check whether a lightweight request to the given URL responds (used to test proxies)
    const checkEndpoint = async (urlStr: string, timeoutMs = 3000) => {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(urlStr, {
          method: "OPTIONS",
          mode: "cors",
          signal: controller.signal,
        });
        clearTimeout(t);
        return res && (res.ok || res.status === 200 || res.status === 204);
      } catch (err) {
        return false;
      }
    };

    try {
      setLoading(true);
      let res: Response | null = null;

      // Send directly to the API endpoint configured via VITE_PREDICT_ENDPOINT
      try {
        if (!API_URL) {
          throw new Error("Missing VITE_PREDICT_ENDPOINT in .env");
        }
        res = await sendTo(API_URL, settings.initialTimeoutMs);
      } catch (err: any) {
        toast({
          title: "Connection issue",
          description: err?.message || "Check your API endpoint.",
        });
        res = null;
      }

      // If direct request failed (CORS or network), try Netlify function proxy then /api/proxy (Vercel)
      if (!res) {
        const proxies = ["/.netlify/functions/proxy", "/api/proxy", "/proxy"]; // netlify, vercel, server fallback
        for (const proxyPath of proxies) {
          // check if proxy path is reachable before sending large multipart payload
          const ok = await checkEndpoint(proxyPath, 2500).catch(() => false);
          if (!ok) continue;
          try {
            res = await sendTo(proxyPath, settings.retryTimeoutMs);
            if (res) break;
          } catch (err) {
            res = null;
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
        err?.name === "AbortError"
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

  // Enhanced formatter: convert **bold** to <strong>, headings to styled h3, questions to larger bold lines, options styled, and spacing increased
  const formatResultHtml = (txt: string) => {
    if (!txt) return "";
    // Escape first
    let out = escapeHtml(txt);

    // Convert bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Headings: lines starting with Section or Section A/B/C -> styled h3
    out = out.replace(
      /^\s*(Section\s+[A-Z0-9\-–].*)$/gim,
      '<h3 class="text-xl font-bold mb-3">$1</h3>',
    );

    // Convert lines that look like 'Q1.' or 'Q16.' at line start -> larger bold question line
    out = out.replace(
      /^\s*(Q\d+\.)\s*(.*)$/gim,
      '<p class="text-lg font-semibold mb-3"><strong>$1</strong> $2</p>',
    );

    // Convert MCQ option lines like 'a) text' to styled option lines
    out = out.replace(
      /^\s*([a-d])\)\s*(.*)$/gim,
      '<div class="ml-6 mb-2 text-base"><strong class="mr-2">$1)</strong>$2</div>',
    );

    // Paragraphs: two or more newlines -> paragraph break with spacing
    out = out.replace(/\n{2,}/g, '</p><p class="mb-4">');

    // Single newlines -> line break
    out = out.replace(/\n/g, "<br />");

    // Wrap with a paragraph if not already
    if (!out.startsWith("<h3>") && !out.startsWith("<p>")) {
      out = `<p class=\"mb-4\">${out}</p>`;
    }

    return out;
  };

  return (
    <div>
      <section className="relative overflow-hidden rounded-2xl px-6 py-16 text-white">
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
        <div className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}

          {/* External controls: Class -> Subject -> Prompt */}
          <ExternalPdfSelector
            onLoadFile={(f) => setFile(f)}
            onSetPrompt={(p) => setQuery(p)}
            onGenerate={async (p?: string) => await runSubmit(undefined, p)}
            onReset={onReset}
            loading={loading}
          />

          {result && (
            <div className="mt-4">
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
                        const margin = 40;
                        let y = 60;
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

                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(22);
                        doc.text("Test Paper Generator", pageWidth / 2, y, {
                          align: "center",
                        });
                        y += 30;

                        const promptText = (query || "").trim();
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(12);
                        const header = `Query: ${promptText}`;
                        doc.text(header, margin, y);
                        y += 20;

                        const lines = (result || "").split(/\n/);
                        doc.setFontSize(11);
                        for (const line of lines) {
                          const split = doc.splitTextToSize(
                            line,
                            pageWidth - margin * 2,
                          );
                          for (const s of split) {
                            if (
                              y >
                              doc.internal.pageSize.getHeight() - margin
                            ) {
                              doc.addPage();
                              y = margin;
                            }
                            doc.text(s, margin, y);
                            y += 14;
                          }
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

              <div className="mt-3 rounded-md bg-card/60 p-6 text-base">
                <div
                  className="prose prose-invert prose-lg leading-relaxed max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: formatResultHtml(result || ""),
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
