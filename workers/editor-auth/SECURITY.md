# Editor authentication security boundary

## Authority model

Create a GitHub App owned by the repository owner and install it on **only** `Brehove/ai-ethics-interactive-textbook`. Do not install it for all repositories.

Repository permissions:

- Metadata: read-only, implicit.
- Contents: read and write, required to create a branch commit.
- Pull requests: read and write, required to open the review request.

Do not grant Administration, Actions, Checks, Deployments, Environments, Issues, Members, Secrets, Workflows, or organization permissions. Disable webhooks unless a later reviewed feature needs them. Enable expiring user-to-server tokens. Configure the exact callback as `<EDITOR_AUTH_BASE_URL>/auth/callback`.

The App installation selection is the first repository boundary. The Worker adds four more:

1. the repository owner/name and `main` base are code-pinned;
2. each installation token request is restricted to that one repository and only Contents/Pull Requests permissions;
3. browser edits are limited to existing allowlisted text files under `content/`;
4. the API can create a non-main branch and pull request but cannot merge, delete content, edit workflows, or write directly to `main`.

Protect `main` in GitHub with required pull requests, required CI, resolved conversations, no force pushes, and linear/squash history. The App must not bypass that ruleset.

## Session and callback boundary

- OAuth state is HMAC-signed, expires in at most 15 minutes, is mirrored in an HttpOnly Secure SameSite=Lax host-only cookie, and is cleared on callback.
- The GitHub authorization code is exchanged server-side. The returned user token is used only to read `/user` and verify the pinned repository, then discarded.
- The editor session is an HMAC-signed, HttpOnly Secure SameSite=Strict host-only cookie with a maximum two-hour lifetime and a one-hour default.
- Session payloads contain only GitHub numeric ID, login, expiry, and a random CSRF value. They contain no GitHub or Cloudflare credential.
- Every API request requires an exact credentialed CORS origin. Every state-changing request also requires the session-bound CSRF header.
- The callback and post-login destinations are fixed configuration, not request parameters.
- Production must use a same-site reader and auth hostname. Do not weaken the cookie to `SameSite=None` merely to make a temporary cross-site preview work.

## Stale-write and main-branch boundary

The admin must retain both values returned by `/api/file`:

- `base_commit_sha` proves which `main` revision was loaded;
- `blob_sha` proves which exact file version was loaded.

The Worker rejects either mismatch before mutation and checks `main` a second time immediately before creating the branch. It generates the source branch name server-side and always sets the pull-request base from the code-pinned `main` constant. Unknown body keys are rejected, so a browser cannot smuggle an owner, repository, base, head, merge, or publish instruction into the request.

If branch creation succeeds but the commit or pull request fails, the Worker attempts to delete only the just-created draft branch. A failed cleanup can leave an isolated branch; it cannot alter `main`.

## Logging and retention

Worker observability is disabled in committed configuration. Application code does not log requests or errors. Never add logging for cookies, OAuth codes, authorization headers, request bodies, Markdown content, App JWTs, installation tokens, or user access tokens. If temporary synthetic diagnostics are required, use fake credentials, inspect the exact captured fields, remove the instrumentation, and redeploy before real authentication.

Cloudflare and GitHub retain their own security, request, build, commit, and pull-request records. The privacy claim is therefore about student reading/judgment data, not a claim that infrastructure has no logs.

## Deployment checklist

1. Review the App owner and confirm installation selection contains exactly the textbook repository.
2. Review the permission screen against the minimal list above.
3. Add the production callback URL and no wildcard callback.
4. Bind the exact admin origin, auth origin, admin URL, numeric user ID, App IDs, and three secrets.
5. Generate `EDITOR_SESSION_SECRET` from at least 32 cryptographically random bytes.
6. Deploy only reviewed `main`; do not bind production credentials to pull-request previews.
7. Confirm `workers_dev` and preview URLs remain disabled.
8. Run the security tests and a Wrangler dry bundle.
9. Exercise login, file read, stale-base rejection, PR creation, logout, revocation, and branch-rules enforcement with a disposable content edit.
10. Inspect Cloudflare logging settings and GitHub App audit events for unexpected request-body or credential capture.

## Rotation and incident response

- Rotate `EDITOR_SESSION_SECRET` to invalidate every editor session immediately.
- Revoke the GitHub App private key and create a new one if it may have been exposed.
- Rotate the App client secret after any callback-service compromise.
- Suspend or uninstall the App to stop all repository writes while leaving the static reader online.
- Close the affected pull request and delete only its isolated editor branch through GitHub after reviewing the diff.
- Never solve an editor incident by disabling `main` protection or granting the App broader permissions.
