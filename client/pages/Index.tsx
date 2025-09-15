import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Copy, Download } from "lucide-react";

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

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

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

  const runSubmit = async () => {
    setError(null);
    setResult(null);
    if (!file) {
      setError("Attach a PDF file first.");
      toast({ title: "Missing PDF", description: "Attach a PDF to continue." });
      return;
    }
    const q = query.trim();
    if (!q) {
      setError("Enter a query.");
      toast({ title: "Missing query", description: "Write what to generate." });
      return;
    }

    const send = async (timeoutMs: number) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const form = new FormData();
        form.append("pdf", file);
        form.append("query", q);
        try {
          const res = await fetch("/api/generate-questions", {
            method: "POST",
            body: form,
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          return res;
        } catch (err: any) {
          // Normalize AbortError to a null response so callers can handle retries
          if (err?.name === "AbortError") {
            return null;
          }
          throw err;
        }
      } finally {
        clearTimeout(t);
      }
    };

    try {
      setLoading(true);
      let res: Response | null = null;

      try {
        res = await send(settings.initialTimeoutMs);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          toast({ title: "Slow connection", description: "Retrying..." });
        } else {
          throw err;
        }
      }

      if ((!res || !res.ok || res.status === 504) && settings.autoRetry) {
        await new Promise((r) => setTimeout(r, 800));
        res = await send(settings.retryTimeoutMs);
      }

      // If send returned null (e.g. aborted), normalize to an error to be handled below
      if (!res) {
        throw new Error("Request timed out or was aborted");
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
            : (json?.questions ?? json?.result ?? json?.message ?? JSON.stringify(json, null, 2));
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
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/90 via-accent/40 to-secondary/80 blur-2xl opacity-95 -z-10" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl text-secondary drop-shadow-md">
            Upload a PDF and generate premium-quality questions
          </h1>
          <p className="mt-3 text-sm text-white/90">Fast, accurate question generation tailored to your query.</p>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-5xl gap-8 md:grid-cols-5">
        <form onSubmit={submit} className="md:col-span-3 space-y-6">
          <div>
            <label
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-8 text-center transition-colors card-surface",
                file ? "ring-2 ring-secondary/70" : "border-2 border-dashed border-secondary/40 hover:ring-2 hover:ring-secondary/60",
              )}
            >
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="rounded-md bg-gradient-to-br from-secondary to-secondary/80 p-[2px]">
                <div className="rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground">
                  {file ? "PDF attached" : "Click to upload or drag & drop"}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "PDF up to 15MB"}
              </p>
            </label>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Your query</label>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.ctrlKey &&
                  !e.altKey
                ) {
                  e.preventDefault();
                  if (!loading) {
                    // Trigger submit on Enter
                    // Avoid unhandled promise rejections when calling from key handlers
                    void runSubmit();
                  }
                }
              }}
              placeholder="e.g. Generate 10 multiple-choice questions covering key concepts"
              rows={5}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading} variant="secondary" className="min-w-32">
              {loading ? "Generating..." : "Generate"}
            </Button>
          </div>
        </form>

        <div className="md:col-span-2">
          <div className="sticky top-24">
            <div className="card-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Response</h3>
                  <p className="text-sm text-muted-foreground">Results from your latest request</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Download"
                    disabled={!result || loading}
                    onClick={() => {
                      if (!result) return;
                      const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const safeQuery = (query || "").trim().slice(0, 50).replace(/[^a-z0-9_-]/gi, "_") || "questions";
                      const filename = `${safeQuery}_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      // Delay revoke slightly to ensure download is initiated in all browsers
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    <Download />
                    <span className="sr-only">Download</span>
                  </Button>
                </div>
              </div>

              <div className="mt-4 max-h-[420px] overflow-auto rounded-md bg-background p-4 text-sm">
                {!result && !loading && (
                  <p className="text-muted-foreground">No result yet. Submit the form to see the output.</p>
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" className="opacity-75" />
                    </svg>
                    Generating...
                  </div>
                )}
                {!!result && !loading && (
                  <pre className="whitespace-pre-wrap break-words text-foreground">{result}</pre>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
