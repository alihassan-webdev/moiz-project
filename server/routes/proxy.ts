import type { RequestHandler } from "express";

const EXTERNAL = "https://api-va5v.onrender.com/generate-questions" as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Headers": "*",
} as const;

export const handleProxy: RequestHandler = async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Build forward headers, preserve content-type for multipart boundaries
    const forwardHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (
        key === "host" ||
        key === "content-length" ||
        key === "connection" ||
        key === "accept-encoding"
      )
        continue;
      forwardHeaders[key] = Array.isArray(v) ? v.join(", ") : String(v);
    }

    // req is a readable stream; pass through to fetch body to preserve multipart form data
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const upstream = await fetch(EXTERNAL, {
      method: "POST",
      headers: forwardHeaders,
      body: req as any,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    // Mirror status and headers
    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    headers.forEach((v, k) => res.setHeader(k, v));
    return res.send(buf);
  } catch (err: any) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    const message = err?.message || String(err);
    return res
      .status(502)
      .json({ error: true, message: message || "Internal Server Error" });
  }
};
