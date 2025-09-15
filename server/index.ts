import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleGenerate, uploadPdf } from "./routes/generate";
import { handleProxy } from "./routes/proxy";

export function createServer() {
  const app = express();

  // Middleware
  const corsOptions = {
    origin: "*",
    methods: "*",
    allowedHeaders: "*",
  } as const;
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use((_, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    next();
  });
  app.use(express.json({ limit: "16mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health and ping
  app.get("/health", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ ok: true });
  });

  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "API Running" });
  });

  app.get("/api/demo", handleDemo);

  // Proxy to external PDF question generation API
  app.post("/api/generate-questions", uploadPdf, handleGenerate);

  // Universal proxy endpoint (CORS + POST forward). Register both paths for serverless base path quirks
  app.all("/api/proxy", handleProxy);
  app.all("/proxy", handleProxy);

  // Global error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    const message = err?.message || "Internal Server Error";
    res.status(500).json({ error: true, message });
  });

  return app;
}
