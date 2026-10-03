import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

export default defineConfig({
  plugins: [react(), {
    name: "private-order-preview",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/__order-preview") return next();
        const file = process.env.ORDER_PREVIEW_DATA;
        if (!file) { res.statusCode = 404; res.end(); return; }
        try {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(readFileSync(file));
        } catch { res.statusCode = 404; res.end(); }
      });
    }
  }],
  test: {
    globals: true,
    environment: "node"
  }
});
