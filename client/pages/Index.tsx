import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

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

// API endpoint comes from environment
const API_URL = (import.meta.env.VITE_PREDICT_ENDPOINT as string) || "";

function ExternalPdfSelector({
  onLoadFile,
  onSetPrompt,
  onGenerate,
  onReset,
}: {
  onLoadFile: (f: File | null) => void;
  onSetPrompt: (p: string) => void;
  onGenerate: () => Promise<void> | void;
  onReset: () => void;
}) {
  const pdfModules = import.meta.glob("/datafiles/**/*.pdf", { as: "url", eager: true }) as Record<string, string>;
  const entries = Object.entries(pdfModules).map(([path, url]) => ({ path, url, name: path.split("/").pop() || "file.pdf" }));
  const byClass = entries.reduce<Record<string, { path: string; url: string; name: string }[]>>((acc, cur) => {
    // extract class folder name
    const m = cur.path.replace(/^\/?datafiles\//, "");
    const parts = m.split("/");
    const cls = parts[0] || "Other";
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(cur);
    return acc;
  }, {});

  const classOptions = Object.keys(byClass).sort();
  const [selectedClass, setSelectedClass] = useState<string>(classOptions[0] || "");
  const [subjectOptions, setSubjectOptions] = useState<{ path: string; url: string; name: string }[]>(
    selectedClass ? byClass[selectedClass] || [] : []
  );
  const [selectedSubjectPath, setSelectedSubjectPath] = useState<string>("");
  const [promptText, setPromptText] = useState("");

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
          <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v)}>
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

        <div>
          <label className="text-xs text-muted-foreground">Subject</label>
          <Select value={selectedSubjectPath} onValueChange={(p) => { setSelectedSubjectPath(p); handleSelectSubject(p); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select subject (PDF)" />
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

      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            if (!selectedSubjectPath) return toast({ title: "Select PDF", description: "Please choose a PDF to use." });
            // Ensure subject is loaded (handleSelectSubject already loads and calls onLoadFile)
            await onGenerate();
          }}
          className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground"
        >
          Generate
        </button>

        <button
          onClick={() => {
            // clear selection
            setSelectedSubjectPath("");
            // clear parent file state
            onLoadFile(null);
            onReset();
          }}
          className="rounded-md bg-muted/40 px-3 py-2 text-sm"
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

      const form = new FormData();
      form.append("pdf", theFile);
      form.append("query", q);
      // External APIs may expect the field name "file"; include both for compatibility
      if (isExternal) {
        form.append("file", theFile);
      }

      let finalUrl = urlStr;
      if (isExternal && q) {
        const u = new URL(urlStr);
        u.searchParams.set("query", q);
        finalUrl = u.toString();
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

      try {
        console.debug("Attempting fetch ->", finalUrl, { isExternal });
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
          } else if (err?.message === "Failed to fetch" || err?.name === "TypeError") {
            // Likely network or CORS
            console.warn("Network or CORS error when fetching:", finalUrl, err?.message ?? err);
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
        const proxies = ["/.netlify/functions/proxy", "/api/proxy"]; // netlify, vercel
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
          "Network or CORS error. If deployed on Netlify set VITE_PREDICT_ENDPOINT='/.netlify/functions/proxy' and PREDICT_ENDPOINT='https://api-va5v.onrender.com', or on Vercel set VITE_PREDICT_ENDPOINT='/api/proxy' and PREDICT_ENDPOINT='https://api-va5v.onrender.com'. Alternatively, enable CORS on the API."
        );
      }

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `HTTP ${res.status}`);
      }
      if (contentType.includes("application/json")) {
        const json = await res.json();
        const text =
          typeof json === "string"
            ? json
            : (json?.questions ??
              json?.result ??
              json?.message ??
              JSON.stringify(json, null, 2));
        setResult(String(text));
      } else {
        const text = await res.text();
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
            onGenerate={async () => await runSubmit()}
            onReset={onReset}
          />

          <div className="mt-4">
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!loading) await runSubmit();
                }}
                className="rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground"
              >
                Generate
              </button>

              <button
                onClick={onReset}
                className="rounded-md bg-muted/40 px-4 py-2 text-sm"
              >
                Reset
              </button>
            </div>

            {result && (
              <pre className="whitespace-pre-wrap mt-4 rounded-md bg-card/60 p-4 text-sm">{result}</pre>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
