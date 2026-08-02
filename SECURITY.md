# Security policy

## Supported version

Security fixes apply to the current `main` branch and active Cloudflare deployment.

## Reporting

Do not open a public issue containing a credential, exploit payload, private path, student information, or unpublished course material. Contact the repository owner privately through the GitHub profile associated with this repository.

## Security boundaries

- The public reader is a static Astro build with no student authentication or database.
- The instructor editor uses a separate repository-scoped GitHub App Worker.
- GitHub App credentials and session secrets are Cloudflare secrets and never enter repository files or browser-readable responses.
- Editor saves target only allowlisted content files, use optimistic concurrency checks, and create pull requests rather than writing `main`.
- Canvas credentials and course mutations are outside this repository and never run from public pull-request workflows.

If the editor service is suspected of compromise, disable its route, revoke the GitHub App installation, rotate all Worker secrets, inspect GitHub audit history, and continue authoring through local Git until the incident is resolved.
