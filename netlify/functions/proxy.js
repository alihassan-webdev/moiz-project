exports.handler = async function (event, context) {
  const EXTERNAL = process.env.PREDICT_ENDPOINT || "https://api-va5v.onrender.com/generate-questions";

  // Build upstream URL including query string
  const url = new URL(EXTERNAL);
  if (event.queryStringParameters) {
    for (const [k, v] of Object.entries(event.queryStringParameters)) {
      if (v != null) url.searchParams.set(k, v as string);
    }
  }

  // Reconstruct headers
  const headers = { ...(event.headers || {}) };
  // Remove host header to avoid issues
  delete headers.host;

  // Decode body if base64 encoded
  let body = event.body || null;
  if (event.isBase64Encoded && body) {
    body = Buffer.from(body, "base64");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const resp = await fetch(url.toString(), {
      method: event.httpMethod || "GET",
      headers,
      body: body,
      signal: controller.signal,
    });

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const isText = contentType.includes("application/json") || contentType.startsWith("text/");

    const responseBody = isText ? buffer.toString("utf-8") : buffer.toString("base64");

    const responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Content-Type": contentType,
    };

    return {
      statusCode: resp.status,
      headers: responseHeaders,
      body: responseBody,
      isBase64Encoded: !isText,
    };
  } catch (err) {
    if (err && err.name === "AbortError") {
      return {
        statusCode: 504,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: true, message: "Upstream timeout" }),
      };
    }
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: true, message: err?.message || "Proxy error" }),
    };
  } finally {
    clearTimeout(timeout);
  }
};