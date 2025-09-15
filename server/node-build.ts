import path from "path";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
const port = process.env.PORT || 3000;

// In production, serve the built SPA files
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

// Serve static files
app.use(express.static(distPath));

// Handle React Router - serve index.html for all non-API routes
app.get(/.*/, (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: true, message: "Not Found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

const server = app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

// Ensure API requests can take at least 60s
server.setTimeout?.(65_000);
// @ts-ignore
server.headersTimeout = 65_000;

// Optional keep-alive ping (prevent idling on some hosts)
const enableKeepAlive = process.env.KEEP_ALIVE !== "false";
if (enableKeepAlive) {
  const pingUrl =
    process.env.KEEP_ALIVE_PING_URL || `http://localhost:${port}/health`;
  setInterval(() => {
    fetch(pingUrl).catch(() => void 0);
  }, 5 * 60_000).unref?.();
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
