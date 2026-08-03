export function extractMetaCsp(html) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map();
    for (const attribute of match[0].matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes.set(attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? "");
    }
    if (attributes.get("http-equiv")?.toLowerCase() === "content-security-policy") {
      return attributes.get("content") ?? "";
    }
  }
  return "";
}
