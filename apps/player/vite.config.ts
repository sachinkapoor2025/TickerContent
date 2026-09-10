import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Production is served from Customer CloudFront at /player/. Local `vite` keeps `/` so
  // http://localhost:5175/?tickerId= still matches the existing player workflow.
  base: command === "build" ? "/player/" : "/",
  server: {
    port: 5175,
    proxy: {
      "/v1": "http://127.0.0.1:3001",
      "/health": "http://127.0.0.1:3001",
    },
  },
}));
