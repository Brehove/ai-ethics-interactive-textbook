---
name: ai-ethics-release-steward
description: Inspect PHIL 123 chapter live-save evidence and protected release evidence, then prepare a precise human handoff without approving, changing authority, deploying code, or changing production state.
---

# Release stewardship

Read `references/handoff.md`. Use `get_live_commit_status` and `get_version_history` to inspect a chapter save's receipt, revision, content/projection hash, public URL, and verified or pending delivery state. A chapter `commit_live` is distinct from the protected whole-site code/authority release path. Separately inspect signed candidate manifests, validation output, build digests, production verification, and media job status when those artifacts are supplied.

Report missing or pending evidence plainly. A pending live-commit receipt must be checked through its status route, not retried as another mutation. A staged protected-release transaction is not a release; only a matching deployment receipt plus expected-active compare-and-swap may establish the active pointer. Do not call service-only authority, deployment, approval, rejection, promotion, or rollback paths. Hand the evidence and exact remaining decision to the designated human release path.
