const JSON_HEADERS = { accept: "application/json" };

export class AuthoringApiError extends Error {
  constructor(status, code, message, details) {
    super(message); this.name = "AuthoringApiError"; this.status = status; this.code = code; this.details = details;
  }
}

const boundedSegment = (value, name) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)) throw new TypeError(`${name} is invalid`);
  return encodeURIComponent(value);
};

const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : { error: { message: await response.text() } };
  if (!response.ok) {
    const error = body?.error || {};
    throw new AuthoringApiError(response.status, error.code || "REQUEST_FAILED", error.message || `Request failed (${response.status})`, error.details);
  }
  return body;
};

export function createAuthoringClient(options) {
  const baseUrl = new URL(options.baseUrl);
  if (baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new TypeError("Authoring API requires HTTPS outside local development");
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  const credentials = options.credentials || "include";

  const request = async (path, init = {}, signal) => {
    const bearer = await options.getBearer?.();
    const csrf = init.method && init.method !== "GET" ? await options.getCsrf?.() : undefined;
    const headers = { ...JSON_HEADERS, ...(init.body ? { "content-type": "application/json" } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(csrf ? { "x-editor-csrf": csrf } : {}), ...init.headers };
    return parseResponse(await fetchImpl(new URL(path, baseUrl), { ...init, headers, credentials, cache: "no-store", signal }));
  };

  return Object.freeze({
    getSession: (signal) => request(`/api/session`, { method: "GET" }, signal),
    getAuthoringView: (documentId, signal) => request(`/v1/chapters/${boundedSegment(documentId, "documentId")}/authoring-view`, { method: "GET" }, signal),
    createOrResumeChangeset: (documentId, body, signal) => request(`/v1/chapters/${boundedSegment(documentId, "documentId")}/changesets`, { method: "POST", body: JSON.stringify(body) }, signal),
    getChangeset: (changeSetId, signal) => request(`/v1/changesets/${boundedSegment(changeSetId, "changeSetId")}`, { method: "GET" }, signal),
    submitChangeset: (changeSetId, body, signal) => request(`/v1/changesets/${boundedSegment(changeSetId, "changeSetId")}:submitReview`, { method: "POST", body: JSON.stringify(body) }, signal),
    approveChangeset: (changeSetId, body, signal) => request(`/v1/changesets/${boundedSegment(changeSetId, "changeSetId")}:approve`, { method: "POST", body: JSON.stringify(body) }, signal),
    applyOperationBatch: (changeSetId, body, signal) => request(`/v1/changesets/${boundedSegment(changeSetId, "changeSetId")}/operations:batch`, { method: "POST", body: JSON.stringify(body) }, signal),
    searchMedia: (query = {}, signal) => {
      const params = new URLSearchParams();
      for (const key of ["q", "kind", "rightsStatus", "sha256", "limit", "cursor"]) {
        const value = query[key];
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
      }
      return request(`/v1/media${params.size ? `?${params}` : ""}`, { method: "GET" }, signal);
    },
    getManagedMediaPreviewUrl: (mediaId, mediaVersionId, rightsCaseId) => new URL(
      `/v1/media/${boundedSegment(mediaId, "mediaId")}/versions/${boundedSegment(mediaVersionId, "mediaVersionId")}/rights/${boundedSegment(rightsCaseId, "rightsCaseId")}:preview`,
      baseUrl,
    ).toString(),
    searchPersons: (query = {}, signal) => {
      const params = new URLSearchParams();
      for (const key of ["q", "limit", "cursor"]) {
        const value = query[key];
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
      }
      return request(`/v1/persons${params.size ? `?${params}` : ""}`, { method: "GET" }, signal);
    },
    getPerson: (personId, signal) => request(`/v1/persons/${boundedSegment(personId, "personId")}`, { method: "GET" }, signal),
    resolveEmbed: (body, signal) => request(`/v1/embeds:resolve`, { method: "POST", body: JSON.stringify(body) }, signal),
    commitLive: (body, signal) => {
      if (!body || typeof body !== "object") throw new TypeError("commit body is required");
      const { changeSetId, ...payload } = body;
      return request(`/v1/changesets/${boundedSegment(changeSetId, "changeSetId")}:commitLive`, { method: "POST", body: JSON.stringify(payload) }, signal);
    },
    getLiveCommitStatus: (commandId, signal) => request(`/v1/live-commits/${boundedSegment(commandId, "commandId")}`, { method: "GET" }, signal),
    getHistory: (chapterId, cursor, signal) => request(`/v1/chapters/${boundedSegment(chapterId, "chapterId")}/revisions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { method: "GET" }, signal),
    restoreAsDraft: (chapterId, revisionId, body, signal) => request(`/v1/chapters/${boundedSegment(chapterId, "chapterId")}/revisions/${boundedSegment(revisionId, "revisionId")}:restoreAsDraft`, { method: "POST", body: JSON.stringify(body) }, signal),
  });
}
