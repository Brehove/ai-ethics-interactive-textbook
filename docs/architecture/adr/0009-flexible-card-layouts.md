# ADR 0009: Semantic flexible card layouts

Status: Accepted

Date: 2026-08-05

## Decision

Schema v4 stores card presentation as semantic values and stores multi-node arrangements as explicit, contiguous `layoutRegions` in chapter flow. Cards may use named widths, alignment, density, and media framing. Regions may be a prose wrap, a card-text split, or a two-to-six-card grid.

The Content API owns validation and server-generated layout identities. The editor and textbook MCP use typed semantic operations bound to the current layout-catalog version. They cannot submit CSS, HTML, pixels, breakpoints, or caller-selected layout IDs. The shared renderer produces the same markup and CSS for reader, editor, preview, print, offline, and no-JavaScript surfaces.

Narrow screens and print flatten regions in canonical source order. A flow node may belong to at most one region, and moving or deleting a region member requires explicit removal or reconciliation of the region first.

## Consequences

- Layout remains canonical chapter content without making the public reader depend on the live authoring API.
- Agents can make the same bounded layout choices as instructors and receive card-specific guidance through MCP reads.
- The legacy browser script may position old static artifacts only before schema-v4 cutover; it cannot rearrange an explicit v4 projection.
- New layout behavior rolls out behind the fail-closed `card_layouts_v1` chapter canary and requires a frozen release snapshot before public use.
- Adding a new layout primitive requires a new catalog version, contract validation, renderer behavior, responsive and print tests, Content API operations, editor controls, MCP schemas, and agent guidance.
