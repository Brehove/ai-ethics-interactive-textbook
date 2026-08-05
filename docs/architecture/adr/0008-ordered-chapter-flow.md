# ADR 0008: Ordered chapter flow is the placement authority

- Status: Accepted
- Date: 2026-08-05
- Supersedes: the anchor-derived ordering portions of ADR 0006 and `UNIFIED_READER_AUTHORING_IMPLEMENTATION_PLAN.md`

## Context

Schema v2 stores prose blocks in `chapter.body`, checkpoints in `checkpoints`, and separately rendered person features in `managedPlacements`. The renderer reconstructs their inline order from `passageId`, `anchorPassageId`, `position`, `displayOrder`, and `orderAtAnchor`.

That design makes one stable passage identifier perform two independent jobs: describing intellectual context and determining exact layout. A paragraph split can copy the passage identity onto both fragments. The renderer then has to guess which fragment owns the checkpoint boundary. In the August 5 Chapter 4 incident, Save remounted the editor through that reconstruction before the API rejected the duplicated IDs, visibly moving prose around a checkpoint.

Stable identities remain necessary for deep links, annotations, contextual relationships, excerpt-drift detection, agent addressing, revision aliases, and tombstones. They are not a safe layout language.

## Decision

Content schema v3 makes `chapter.body` the single ordered chapter flow. It adds lightweight reference nodes:

```ts
type CheckpointReferenceNode = {
  type: "checkpointRef";
  checkpointId: string;
};

type PlacementReferenceNode = {
  type: "placementRef";
  placementId: string;
};
```

Checkpoint and managed-placement records remain typed canonical records. Each inline record has exactly one matching reference, and each reference resolves to exactly one record of the expected type. Reference order in `body` is the only inline-order authority.

In schema v3:

- `PromptCheckpoint.passageId` describes context and deep-link identity; it does not place the checkpoint.
- `PromptCheckpoint.displayOrder` is forbidden.
- `ManagedPlacement.position` and `orderAtAnchor` are forbidden.
- inline and sidebar checkpoint order come from the same flow walk.
- generic flow positions use `{ beforeNodeId }` or `{ afterNodeId }`; the target may be a block, checkpoint reference, or placement reference.
- block editing still targets real blocks by `blockId`.

The server derives the nearest contextual passage after a move unless the caller supplies an explicit valid context passage. It recomputes the checkpoint excerpt hash atomically.

## Identity and edit semantics

- Split: the left fragment retains the original block and passage identities; the right fragment receives new server-derived identities. Existing reference nodes remain after the new right fragment because they already occupy that location in flow.
- Join: only adjacent compatible prose blocks may join. A reference between them prevents the join. The first block retains its identities; the retired passage receives a tombstone pointing to the survivor.
- Move: moving a block or reference changes the flow array directly.
- Create: creating an inline checkpoint or separately managed placement creates its record and one reference atomically at an explicit flow position.
- Remove: removing an inline checkpoint or placement removes its record and reference in one guarded operation.
- Whole-document replacement: `chapter.replaceDocumentV3` validates complete one-to-one reference coverage before any revision, projection, head, authority, or receipt write.

## Compatibility

- Declared schema v2 uses the frozen anchor projector as a read-only adapter.
- Declared schema v3 uses the ordered-flow projector.
- A v2/v3 hybrid is invalid; readers never infer a schema from node shapes.
- Deterministic v2-to-v3 migration materializes the existing projected sequence as reference nodes and removes legacy positional fields.
- A temporary v3-to-v2 export derives legacy fields from flow using one shared per-anchor order. Those fields are never accepted back as v3 placement authority.
- Historical revisions are not rewritten. A migrated head is a new immutable revision through the normal guarded content workflow.

## Runtime and release boundary

The public reader continues to consume frozen validated release projections and never queries the authoring API or D1 at view time. Server-controlled flags can disable v3 writes while retaining v2 and v3 reads. The legacy adapter remains available through the rollback window after the last active head is migrated.

## Consequences

The chapter document now says where every inline item appears, matching the editing model used by block editors such as WordPress and Pressbooks while retaining stronger typed records and release controls. Passage anchors remain durable semantic identities. The editor, renderer, API, MCP, and migration tooling must all preserve the same explicit flow and reject orphaned or duplicate references.
