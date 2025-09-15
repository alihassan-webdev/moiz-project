export async function handler(event) {
  const EXTERNAL = "https://api-va5v.onrender.com/generate-questions";
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const headers = { ...event.headers };
    delete headers.host; delete headers.connection; delete headers["content-length"]; delete headers["accept-encoding"]; 
    const body = event.isBase64Encoded && event.body ? Buffer.from(event.body, "base64") : event.body;

    const resp = await fetch(EXTERNAL, { method: "POST", headers, body });
    const respBuf = Buffer.from(await resp.arrayBuffer());
    const respHeaders = Object.fromEntries(resp.headers.entries());
    return {
      statusCode: resp.status,
      headers: { ...respHeaders, ...CORS },
      body: respBuf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Proxy error", message: String(err && err.message || err) }) };
  }
}
