import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  resolve: { dedupe: ["zod"], alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    {
      name: "nahhasio-local-development-api",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use("/__development_api", (request, response, next) => {
          const origin = request.headers.origin;
          if (
            request.headers.host !== "127.0.0.1:23110" ||
            (origin && origin !== "http://127.0.0.1:23110") ||
            request.headers["sec-fetch-site"] === "cross-site"
          ) {
            response.writeHead(403);
            response.end("Local development only");
            return;
          }
          next();
        });
      },
    },
    {
      name: "nahhasio-production-csp",
      apply: "build",
      transformIndexHtml: (html) =>
        html.replace(
          "<head>",
          `<head><meta name="nahhasio-style-nonce" content="NAHHASIO_STYLE_NONCE"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'nonce-NAHHASIO_STYLE_NONCE'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`,
        ),
    },
  ],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 23110,
    strictPort: true,
    proxy: {
      "/__development_api": {
        target: "http://127.0.0.1:23103",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__development_api/, "/api"),
      },
    },
  },
  build: { outDir: "dist" },
});
