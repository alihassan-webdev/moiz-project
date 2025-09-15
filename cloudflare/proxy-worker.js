export default {
  async fetch(request) {
    const EXTERNAL = "https://api-va5v.onrender.com/generate-questions";
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: CORS,
      });
    }

    try {
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("content-length");
      headers.delete("connection");
      headers.delete("accept-encoding");

      const upstream = await fetch(EXTERNAL, {
        method: "POST",
        headers,
        body: request.body,
      });

      const respHeaders = new Headers(upstream.headers);
      respHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Proxy error",
          message: String((err && err.message) || err),
        }),
        { status: 502, headers: CORS },
      );
    }
  },
};
