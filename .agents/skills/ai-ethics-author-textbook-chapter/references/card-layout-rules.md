# Card layout rules

Card layout is canonical chapter content only in schema v4. Before changing it, call `get_authoring_view`, `get_layout_catalog`, `get_card_layout`, and `get_valid_layout_options`. Use the returned `layoutCatalogVersion` as `expectedLayoutCatalogVersion`; never guess a remembered version, CSS class, pixel width, or raw markup.

Choose the least complex arrangement that expresses the teaching relationship:

- Use `set_card_layout` for one independent card. `reading`, centered, standard density is the default. Use `compact` or `narrow` for brief supporting cards; `wide`, `full`, and especially `bleed` require content that benefits from the added visual field.
- For a `mediaFigure`, keep the `plain` surface when the image stands on its own and the caption remains secondary. Use the `panel` surface when the image, caption, and credit form one bounded contextual artifact. A panel is not a substitute for grouping unrelated cards or for changing media rights, identity, or framing.
- Use `create_card_group` for two to six related cards readers should scan or compare together. Use `equal` for peers. With exactly two cards, use `start-narrow` or `end-narrow` only when the named source-order card is a brief supporting artifact and the other card needs the larger reading field. Do not infer start/end from visual left/right; source order controls both semantics and mobile collapse.
- Use `create_card_wrap` only for one compact, narrow, or medium card beside sustained prose. Do not wrap around headings, checkpoints, tables, code, or short fragments.
- Use `create_card_text_split` when card and prose form one deliberate explanatory or comparative unit. It is not a generic two-column page tool.
- Use `set_card_frame` only for the media itself. `contain` preserves the whole image; `crop` needs an explicit aspect and focal point and does not grant human crop approval.

Layout regions decorate a contiguous span but never reorder it. Removing a region does not remove content. Use `reconcile_layout_region` for a coordinated final region set; otherwise use the narrow create/update/remove tool. Validate with `validate_layout_proposal`, preview wide, mobile, print, offline, and no-JavaScript behavior, and confirm that collapse and print preserve source order.

Do not place checkpoints or prose callouts in free-form card regions. Do not use a featured layout merely for visual variety. Never change prose, rights, media identity, or source order unless the user separately requested that change.
