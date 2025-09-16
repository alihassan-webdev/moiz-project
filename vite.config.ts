import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// HMR configuration can be driven by environment variables so preview/proxy
// environments can override protocol/host/port when necessary.
const HMR = {
  protocol:
    process.env.HMR_PROTOCOL || process.env.VITE_HMR_PROTOCOL || undefined,
  host:
    process.env.HMR_HOST ||
    process.env.VITE_HMR_HOST ||
    process.env.HOST ||
    undefined,
  port: process.env.HMR_PORT ? Number(process.env.HMR_PORT) : undefined,
};

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
    // Only include hmr when at least one value is provided; otherwise let Vite decide
    hmr: HMR.protocol || HMR.host || HMR.port ? HMR : undefined,
    fs: {
      allow: [
        path.resolve(__dirname), // project root allow
        path.resolve(__dirname, "client"),
        path.resolve(__dirname, "shared"),
      ],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
    proxy: {
      // Proxy the Netlify function path to the external API during local dev to avoid CORS
      "/.netlify/functions/proxy": {
        target: process.env.PREDICT_ENDPOINT || "https://api-va5v.onrender.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace("/.netlify/functions/proxy", "/generate-questions"),
      },
    },
  },
  build: {
    outDir: "dist",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
}));
