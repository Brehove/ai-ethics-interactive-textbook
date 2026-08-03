import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import remarkPhilPassageIds from "./scripts/remark-phil-passage-ids.mjs";

const configuredSite = process.env.PUBLIC_SITE_URL?.trim() || "https://ethicsandai.your-digital-life.org";
export default defineConfig({
  output: "static",
  trailingSlash: "always",
  markdown: {
    syntaxHighlight: "prism",
    processor: unified({ remarkPlugins: [remarkPhilPassageIds] }),
  },
  build: {
    format: "directory",
    inlineStylesheets: "never",
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
  security: {
    csp: {
      algorithm: "SHA-256",
      styleDirective: {
        // Offline chapter exports intentionally embed their complete print CSS.
        // Pages with Astro-generated style hashes continue to ignore this
        // fallback under the CSP inline-style precedence rule.
        resources: ["'self'", "'unsafe-inline'"],
      },
      directives: [
        "default-src 'self'",
        "base-uri 'none'",
        "connect-src 'self'",
        "font-src 'self'",
        "form-action 'self'",
        "img-src 'self' data:",
        "media-src 'self' data:",
        "object-src 'none'",
        "worker-src 'self'",
        "upgrade-insecure-requests",
      ],
    },
  },
  ...(configuredSite ? { site: configuredSite } : {}),
});
