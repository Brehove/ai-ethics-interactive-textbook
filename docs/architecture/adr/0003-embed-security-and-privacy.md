# ADR 0003: Authored fallbacks are the default X experience

- Status: Accepted (Phase 0, 2026-08-02)

## Context

WordPress and Pressbooks make supported embeds practical by accepting a URL, not arbitrary executable markup. X posts are especially brittle and introduce a third-party script. The textbook also promises no provider connection before a student chooses to load one.

## Decision

An X URL creates a typed X embed record with instructor-authored rich fallback: title/summary, teaching use, canonical link, and any rights-cleared first-party supporting image. That fallback is the rendered default in web, no-JS, offline, and print views. The official X widget may load only after the student explicitly activates it and sees the connection disclosure. The reviewed adapter owns the fixed script URL, invocation, CSP entries, and permitted options; authored content supplies neither HTML nor script/iframe strings.

All providers use the same allowlisted URL-to-data adapter model. Unsupported URLs become authored rich link cards. Raw HTML, scripts, iframes, shortcodes, runtime oEmbed discovery, and copied provider markup are prohibited.

## Consequences

- The reader remains useful when X is blocked, deleted, protected, unavailable, offline, or JavaScript is disabled.
- The official widget is optional progressive enhancement, not a release or pedagogy dependency.
- X widget activation is page-memory-only; it is not persisted in cookies, localStorage, or analytics.
- A provider-policy or browser failure simply leaves the fallback and Open on X link visible.

## Rollback

Disable the X adapter's activation capability by code/configuration and republish; existing typed records continue rendering as rich fallbacks. No content migration or HTML cleanup is needed because raw provider markup was never stored.
