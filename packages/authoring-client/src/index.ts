export type CommitDeliveryState = "verified" | "confirmationPending" | "unchanged";

export interface AuthoringClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  getBearer?: () => string | Promise<string | undefined> | undefined;
  getCsrf?: () => string | Promise<string | undefined> | undefined;
  credentials?: RequestCredentials;
}

export interface CommitLiveRequest {
  changeSetId: string;
  documentId: string;
  baseRevisionId: string;
  expectedVersion: number;
  idempotencyKey: string;
  operations: Array<Record<string, unknown>>;
}

export type FlowPosition =
  | { beforeNodeId: string; afterNodeId?: never }
  | { afterNodeId: string; beforeNodeId?: never };

export type OrderedFlowOperation =
  | { type: "block.split"; blockId: string; offset: number }
  | { type: "block.join"; firstBlockId: string; secondBlockId: string }
  | { type: "block.move"; blockId: string; position: FlowPosition }
  | { type: "checkpoint.move"; checkpointId: string; position: FlowPosition; passageId?: string }
  | { type: "managedPlacement.move"; placementId: string; position: FlowPosition; anchorPassageId?: string }
  | { type: "chapter.replaceDocumentV3"; document: Record<string, unknown> };

export interface OperationBatchRequest {
  documentId: string;
  baseRevisionId: string;
  expectedVersion: number;
  idempotencyKey: string;
  operations: Array<OrderedFlowOperation | Record<string, unknown>>;
}

export interface OperationBatchResult {
  documentId: string;
  version: number;
  contentHash: string;
  chapter?: Record<string, unknown>;
  created?: { blockId?: string; passageId?: string; checkpointId?: string; placementId?: string };
}

export interface CommitLiveResult {
  commitReceiptId: string;
  changeSetId: string;
  documentId: string;
  revisionId: string;
  contentHash: string;
  projectionId: string;
  projectionHash: string;
  publicUrl: string;
  deliveryStatus: "verified" | "confirmation_pending";
  statusUrl: string;
  statusExpiresAt: string;
  committed: boolean;
  live: boolean;
  noOp: boolean;
}

export interface ChangesetSession {
  id: string;
  state: string;
  resumed: boolean;
  chapterId?: string;
  baseRevisionId?: string;
  version?: number;
  chapter?: Record<string, unknown>;
  documents?: Array<{ documentId: string; baseRevisionId: string; version: number }>;
}

export interface AuthoringClient {
  getSession(signal?: AbortSignal): Promise<{ csrf_token: string; expires_at: number }>;
  getAgentCapabilityRequest(requestId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  approveAgentCapabilityRequest(requestId: string, request: { approve: true; userCode: string; confirmLiveSave?: boolean }, signal?: AbortSignal): Promise<Record<string, unknown>>;
  getAuthoringView(documentId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  createOrResumeChangeset(documentId: string, request: { title: string; description?: string; resume?: boolean; idempotencyKey: string }, signal?: AbortSignal): Promise<ChangesetSession>;
  getChangeset(changeSetId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  submitChangeset(changeSetId: string, request: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
  approveChangeset(changeSetId: string, request: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
  applyOperationBatch(changeSetId: string, request: OperationBatchRequest, signal?: AbortSignal): Promise<OperationBatchResult>;
  searchMedia(query?: { q?: string; kind?: "image" | "audio" | "video" | "document"; rightsStatus?: "reviewRequired" | "cleared" | "blocked"; sha256?: string; limit?: number; cursor?: string }, signal?: AbortSignal): Promise<Record<string, unknown>>;
  createMediaReviewPackage(request: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
  getMediaReviewPackage(reviewPackageId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  decideMediaReviewPackage(reviewPackageId: string, request: { declarationHash: string; decision: "cleared" | "blocked"; comment: string; idempotencyKey: string }, signal?: AbortSignal): Promise<Record<string, unknown>>;
  requestMediaUpload(request: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
  uploadMediaBytes(ticketId: string, bytes: ArrayBuffer | ArrayBufferView | Blob, upload: { mimeType: string; sha256: string; uploadToken: string }, signal?: AbortSignal): Promise<Record<string, unknown>>;
  getMediaJob(jobId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  getMediaAsset(mediaId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  /**
   * An authenticated, editor-only image URL for one exact cleared media
   * version and rights decision. It is deliberately a view concern: callers
   * must not put it in a canonical chapter operation.
   */
  getManagedMediaPreviewUrl(mediaId: string, mediaVersionId: string, rightsCaseId: string): string;
  searchPersons(query?: { q?: string; limit?: number; cursor?: string }, signal?: AbortSignal): Promise<Record<string, unknown>>;
  getPerson(personId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  resolveEmbed(request: { url: string; expectedProvider?: string }, signal?: AbortSignal): Promise<Record<string, unknown>>;
  commitLive(request: CommitLiveRequest, signal?: AbortSignal): Promise<CommitLiveResult>;
  getLiveCommitStatus(commandId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  getHistory(chapterId: string, cursor?: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  restoreAsDraft(chapterId: string, revisionId: string, request: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
}

export class AuthoringApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
}

export function createAuthoringClient(options: AuthoringClientOptions): AuthoringClient;
