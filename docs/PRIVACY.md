# Reader privacy boundary

## Student-facing contract

The static reader:

- creates no student account;
- contains no student identity integration;
- sends no student reflection or provisional judgment to the application;
- uses no Local Storage, Session Storage, IndexedDB, or application database for student responses;
- ships no student analytics beacon;
- does not require JavaScript for textbook content or navigation.

Anything typed into a future transient reflection control must remain only in the current page and disappear on reload or close. Course work intentionally submitted in Canvas follows CWI's Canvas policies.

## Necessary operational data

“Nothing is stored” is not an accurate statement for an operated website. GitHub retains commits, branches, pull requests, and authoring audit history. Cloudflare retains build, deployment, security, and ordinary request metadata according to the account configuration and provider terms. The admin service retains a short-lived, secure instructor session. These are operational boundaries, not student-response storage.

## Future AI or voice features

No AI feedback or voice provider is called in the initial reader. A future feature requires a separate data-flow, retention, accessibility, cost, and provider-quality review. The existing reading JSON/plain-text routes are public content representations, not student data.
