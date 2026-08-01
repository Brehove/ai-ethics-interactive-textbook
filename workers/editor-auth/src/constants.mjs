export const REPOSITORY = Object.freeze({
  owner: "Brehove",
  name: "ai-ethics-interactive-textbook",
  branch: "main",
});

export const EDITABLE_PATH_PREFIX = "content/";
export const EDITABLE_EXTENSIONS = new Set([".md", ".yml", ".yaml", ".json"]);

export const STATE_COOKIE = "__Host-phil123_editor_state";
export const SESSION_COOKIE = "__Host-phil123_editor_session";

export const DEFAULT_STATE_TTL_SECONDS = 600;
export const DEFAULT_SESSION_TTL_SECONDS = 3600;
export const MAX_STATE_TTL_SECONDS = 900;
export const MAX_SESSION_TTL_SECONDS = 7200;

export const MAX_REQUEST_BYTES = 1_100_000;
export const MAX_CONTENT_BYTES = 1_000_000;
export const MAX_GITHUB_FILE_BYTES = 1_000_000;

export const GITHUB_API = "https://api.github.com";
export const GITHUB_WEB = "https://github.com";
export const GITHUB_API_VERSION = "2022-11-28";
export const USER_AGENT = "PHIL-123-Interactive-Textbook-Editor";
