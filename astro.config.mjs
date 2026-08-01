import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import remarkPhilPassageIds from "./scripts/remark-phil-passage-ids.mjs";

const configuredSite = process.env.PUBLIC_SITE_URL?.trim() || "https://ethicsandai.your-digital-life.org";
const configuredEditorAuthOrigin =
  process.env.PUBLIC_EDITOR_AUTH_ORIGIN?.trim() || "https://auth.ethicsandai.your-digital-life.org";

function validatedEditorAuthOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !local) || url.origin !== value.replace(/\/$/, "")) {
    throw new Error("PUBLIC_EDITOR_AUTH_ORIGIN must be an exact HTTPS origin without a path");
  }
  return url.origin;
}

const editorAuthOrigin = validatedEditorAuthOrigin(configuredEditorAuthOrigin);

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
        "base-uri 'self'",
        `connect-src 'self'${editorAuthOrigin ? ` ${editorAuthOrigin}` : ""}`,
        "font-src 'self'",
        "form-action 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ],
    },
  },
  ...(configuredSite ? { site: configuredSite } : {}),
});
