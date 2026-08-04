import { WorkerEntrypoint } from "cloudflare:workers";

import app, { getReaderDeliveryIdentity } from "./index.mjs";

// Cloudflare-native delivery attestation. The public HTTP probe still verifies
// the deployed chapter shell; this RPC exposes only the route/projection
// identity needed by the Content API to close an atomic Save receipt.
export class DeliveryIdentity extends WorkerEntrypoint {
  async getDeliveryIdentity(documentId) {
    return getReaderDeliveryIdentity(this.env, documentId);
  }
}

export default app;
