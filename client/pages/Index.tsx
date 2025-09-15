import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ApiResult = string;

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a valid PDF file.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) return setError("Attach a PDF file first.");
    if (!query.trim()) return setError("Enter a query.");

    try {
      setLoading(true);
      const form = new FormData();
      form.append("pdf", file);
      form.append("query", query);

      const res = await fetch("/api/generate-questions", {
        method: "POST",
        body: form,
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail);
      }
      if (contentType.includes("application/json")) {
        const json = await res.json();
        const text = typeof json === "string"
          ? json
          : json?.questions ?? json?.result ?? json?.message ?? JSON.stringify(json, null, 2);
        setResult(String(text));
      } else {
        const text = await res.text();
        setResult(text);
      }
    } catch (err: any) {
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 px-6 py-16 text-white shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_40%_at_50%_0%,rgba(255,255,255,.25),rgba(255,255,255,0))]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Upload a PDF and generate questions with your query
          </h1>
          <p className="mt-4 text-lg/7 text-white/85">
            API: https://api-va5v.onrender.com/generate-questions
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-5xl gap-8 md:grid-cols-5">
        <form onSubmit={submit} className="md:col-span-3 space-y-6">
          <div>
            <label
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                file ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60",
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
              <div className="rounded-md bg-gradient-to-br from-primary to-fuchsia-500 p-[2px]">
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
            <Button type="submit" disabled={loading} className="min-w-32">
              {loading ? "Generating..." : "Generate"}
            </Button>
            <a
              href="https://api-va5v.onrender.com/generate-questions"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View API endpoint
            </a>
          </div>
        </form>

        <div className="md:col-span-2">
          <div className="sticky top-24 rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Response</h3>
            <p className="mb-4 text-sm text-muted-foreground">Results from your latest request</p>
            <div className="max-h-[420px] overflow-auto rounded-md border bg-background p-4 text-sm">
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
                <pre className="whitespace-pre-wrap break-words text-foreground">
                  {result}
                </pre>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
