import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AnimatedAIChat from "@/components/chat/AnimatedAIChat";
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

// Direct API endpoint used when serverless functions are unavailable (static deploys)
const DIRECT_API_URL =
  "https://api-va5v.onrender.com/generate-questions" as const;

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
      const t = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(finalUrl, {
          method: "POST",
          body: form,
          signal: controller.signal,
          headers: { Accept: "application/json" },
          // CORS-friendly defaults for external endpoints
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
        const msg = String(err?.message || "").toLowerCase();
        if (
          err?.name === "AbortError" ||
          msg.includes("signal is aborted") ||
          msg.includes("aborted") ||
          msg.includes("failed to fetch")
        ) {
          return null;
        }
        throw err;
      } finally {
        clearTimeout(t);
      }
    };

    try {
      setLoading(true);
      let res: Response | null = null;

      // 1) Prefer universal proxy endpoint (works on Express, Vercel, Netlify)
      try {
        res = await sendTo("/api/proxy", settings.initialTimeoutMs);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          toast({ title: "Slow connection", description: "Retrying..." });
        } else {
          throw err;
        }
      }

      // 2) Fallback to local express route if available
      if (!res || !res.ok) {
        await new Promise((r) => setTimeout(r, 200));
        res = await sendTo("/api/generate-questions", settings.retryTimeoutMs);
      }

      // 3) If still bad or HTML, go direct external API (requires CORS on remote)
      const isBad =
        !res ||
        !res.ok ||
        res.status === 404 ||
        (res.headers?.get("content-type") || "").includes("text/html");
      if (isBad) {
        await new Promise((r) => setTimeout(r, 200));
        res = await sendTo(DIRECT_API_URL, settings.retryTimeoutMs);
      }

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
            Upload your PDF and generate exam-ready questions
          </h1>
          <p className="mt-3 text-sm text-white/90">
            Fast, accurate question generation tailored to your query.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-5xl space-y-6">
        <div>
          <div>
            <div className="border-border bg-card/80 relative rounded-2xl border p-5 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Response</h3>
                  <p className="text-sm text-muted-foreground">
                    Results from your latest request
                  </p>
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
                      const blob = new Blob([result], {
                        type: "text/plain;charset=utf-8",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const safeQuery =
                        (query || "")
                          .trim()
                          .slice(0, 50)
                          .replace(/[^a-z0-9_-]/gi, "_") || "questions";
                      const filename = `${safeQuery}_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    <Download />
                    <span className="sr-only">Download</span>
                  </Button>
                </div>
              </div>

              <div className="mt-4 max-h-[520px] overflow-auto rounded-md bg-background p-4 text-sm scrollbar-yellow">
                {!result && !loading && (
                  <p className="text-muted-foreground">
                    No result yet. Submit to see the output.
                  </p>
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="opacity-25"
                      />
                      <path
                        d="M22 12a10 10 0 0 1-10 10"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="opacity-75"
                      />
                    </svg>
                    Generating...
                  </div>
                )}
                {!!result && !loading && (
                  <pre className="whitespace-pre-wrap break-words text-foreground">
                    {result}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}
          <AnimatedAIChat
            loading={loading}
            onSubmit={async ({ file: f, query: q }) => {
              if (f) setFile(f);
              setQuery(q);
              await runSubmit(f, q);
            }}
          />
        </div>
      </section>
    </div>
  );
}
