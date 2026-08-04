import { WorkerEntrypoint } from "cloudflare:workers";

import app, { createCapabilityVerifier } from "./index.mjs";

// Cloudflare Service Binding RPC entrypoint.  It deliberately exposes a
// capability verifier only to bound Workers; index.mjs has no corresponding
// /internal HTTP route.
export class AgentCapabilityVerifier extends WorkerEntrypoint {
  async verifyCapability(token, target = {}) {
    return createCapabilityVerifier(this.env).verifyCapability(token, target);
  }
}

export default app;
