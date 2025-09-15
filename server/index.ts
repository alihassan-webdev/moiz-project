import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleGenerate, uploadPdf } from "./routes/generate";
import { handleProxy } from "./routes/proxy";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Proxy to external PDF question generation API
  app.post("/api/generate-questions", uploadPdf, handleGenerate);

  // Universal proxy endpoint (CORS + POST forward). Register both paths for serverless base path quirks
  app.all("/api/proxy", handleProxy);
  app.all("/proxy", handleProxy);

  return app;
}
