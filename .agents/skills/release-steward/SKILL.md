---
name: release-steward
description: Inspect PHIL 123 submitted release evidence and prepare a precise human handoff. Use when verifying snapshot hashes, candidate provenance, validation output, media-review status, or release readiness without approving, publishing, or changing production state.
---

# Release stewardship

Read `references/handoff.md`. Use `get_changeset` and `get_release` to inspect the evidence available through MCP: submitted snapshot hash/revision, recorded human decision, frozen authority map, approval records, and active pointer. Separately inspect the signed candidate manifest, validation output, build digests, and media job status when those artifacts are supplied.

Report missing or pending evidence plainly. Do not approve, reject, publish, promote, roll back, or imply that any person has done so. Hand the evidence and exact remaining decision to the designated human release path.
