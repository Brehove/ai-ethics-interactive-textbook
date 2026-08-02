# Reader Accessibility Audit — 2026-08-02

Status: pre-release audit and remediation record
Target: WCAG 2.2 Level AA
Primary surface: Chapter 7 reading record and self-contained offline chapter

## Scope

- live chapter page at desktop and 320 by 800 CSS pixels;
- chapter outline, reading-record triggers, response form, validation, preservation dialog, export controls, and focus return;
- enlarged reading text and reduced-motion CSS;
- semantic page structure, headings, labels, images, alternative text, duplicate IDs, contrast, and console health;
- generated self-contained offline chapter HTML;
- Lighthouse accessibility scans in mobile and desktop modes.

## Initial Findings

### Label in Name — repaired

The outline rail displayed `In this chapter` while its accessible name was `Open chapter outline`. Lighthouse failed the Label-in-Name audit in mobile and desktop modes. The accessible name now begins with the visible label: `In this chapter: open chapter outline`.

### Header target size — improved

The visible `Aa` and `Print` controls had content boxes below 24 CSS pixels in height. Although spacing likely met the WCAG 2.2 target-size exception, their interactive boxes were increased to a minimum of 44 by 44 CSS pixels.

### Voice input privacy boundary — resolved

The prototype's direct Web Speech API path would have invoked a browser speech provider and conflicted with the reader's no-transmission contract. It was removed. Students can type or use device-level dictation while the field is focused; the textbook does not request microphone access or receive audio.

## Passing Evidence

- The page declares English, provides a descriptive title, one main landmark, and a visible chapter heading.
- Visible images in the audited chapter had nonempty alternative text.
- No duplicate IDs, heading-level skips, unnamed controls, or computed contrast failures were found in the automated DOM inspection.
- On a narrow viewport, the reading record becomes a modal dialog, makes background content inert, focuses the active response field, wraps Tab and Shift-Tab within the dialog, closes with Escape, and returns focus to the invoking checkpoint.
- Empty-response validation announces an error and moves focus to the control that requires correction.
- The chapter and dialog reflow at 320 CSS pixels without horizontal page overflow.
- Enlarged reading text reflows without horizontal page overflow.
- The initial live page and offline page produced no relevant console warnings or errors.
- The offline chapter contains one main landmark, one H1, viewport metadata, no scripts, and no horizontal overflow at 320 CSS pixels.
- Lighthouse reported an accessibility category score of 100 for mobile, desktop, and offline scans. The initial live scan nevertheless contained the unweighted Label-in-Name failure recorded above; the score was not treated as proof of conformance.

## Remaining Manual Gate

A human screen-reader pass remains required before claiming complete WCAG conformance. It should verify VoiceOver and Safari reading order, landmark usefulness, control announcements, dialog context, error timing, exported-record readability, and the note-selection alternative when operating without a pointer. Forced-colors or equivalent high-contrast review also remains advisable.

## Privacy Boundary

Responses and passage notes remain in page memory. The implementation must not use local storage, session storage, cookies, analytics, accounts, or network submission. Content leaves the page only when the student explicitly invokes copy or download. The textbook does not request microphone access or invoke a speech provider; students may independently use device-level dictation.

## Maintenance

Repeat the focused audit when the reader shell, reading-record component, note capture, export format, typography controls, or responsive breakpoints materially change. Record new findings and their disposition rather than replacing this history.
