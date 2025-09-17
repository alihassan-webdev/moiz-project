import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(204).end();
  }
  const EXTERNAL =
    process.env.PREDICT_ENDPOINT ||
    "https://api-va5v.onrender.com/generate-questions";

  try {
    const url = new URL(EXTERNAL);
    // forward query params
    Object.entries(req.query || {}).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, String(v));
    });

    const headers: Record<string, string> = { ...req.headers } as any;
    delete headers.host;

    const fetchRes = await fetch(url.toString(), {
      method: req.method || "GET",
      headers: headers as any,
      body:
        req.method && req.method !== "GET"
          ? (req as any).rawBody || req.body
          : undefined,
    });

    const contentType =
      fetchRes.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await fetchRes.arrayBuffer());

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", contentType);

    res.status(fetchRes.status).send(buffer);
  } catch (err: any) {
    console.error("Proxy error", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res
      .status(500)
      .json({ error: true, message: err?.message || "Proxy error" });
  }
}
