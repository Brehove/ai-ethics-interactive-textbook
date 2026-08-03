import {
  GITHUB_API,
  GITHUB_API_VERSION,
  GITHUB_WEB,
  MAX_GITHUB_FILE_BYTES,
  USER_AGENT,
} from "./constants.mjs";
import {
  createGitHubAppJwt,
  decodeBase64Utf8,
  encodeBase64Utf8,
  randomHex,
} from "./crypto.mjs";
import { HttpError, getRepositoryConfig } from "./policy.mjs";

export class GitHubUpstreamError extends Error {
  constructor(status, operation) {
    super(`GitHub rejected ${operation}`);
    this.name = "GitHubUpstreamError";
    this.status = status;
    this.operation = operation;
  }
}

function requiredEnv(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is not configured`);
  return value.trim();
}

function repoPath(repository) {
  return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
}

function contentPath(path) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

async function parseJson(response, operation) {
  try {
    return await response.json();
  } catch {
    throw new GitHubUpstreamError(response.status || 502, operation);
  }
}

async function githubRequest(fetchImpl, path, {
  method = "GET",
  token,
  body,
  operation,
  accept = "application/vnd.github+json",
  parse = true,
} = {}) {
  const response = await fetchImpl(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
  });
  if (!response.ok) throw new GitHubUpstreamError(response.status, operation);
  return parse ? parseJson(response, operation) : response;
}

export async function exchangeOAuthCode(env, code, redirectUri, fetchImpl = fetch) {
  const clientId = requiredEnv(env, "GITHUB_APP_CLIENT_ID");
  const clientSecret = requiredEnv(env, "GITHUB_APP_CLIENT_SECRET");
  const response = await fetchImpl(`${GITHUB_WEB}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    redirect: "manual",
  });
  if (!response.ok) throw new GitHubUpstreamError(response.status, "OAuth code exchange");
  const payload = await parseJson(response, "OAuth code exchange");
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new GitHubUpstreamError(502, "OAuth code exchange");
  }
  return payload.access_token;
}

export async function getAuthenticatedUser(userToken, fetchImpl = fetch) {
  const user = await githubRequest(fetchImpl, "/user", {
    token: userToken,
    operation: "user identity lookup",
  });
  if (!Number.isInteger(user.id) || typeof user.login !== "string" || !user.login) {
    throw new GitHubUpstreamError(502, "user identity lookup");
  }
  return { id: user.id, login: user.login };
}

export async function verifyUserRepositoryAccess(env, userToken, fetchImpl = fetch) {
  const repository = getRepositoryConfig(env);
  const repo = await githubRequest(fetchImpl, repoPath(repository), {
    token: userToken,
    operation: "repository authorization check",
  });
  if (repo.full_name !== `${repository.owner}/${repository.name}` || repo.archived === true || repo.disabled === true) {
    throw new HttpError(403, "repository_not_allowed", "The account cannot edit the configured repository");
  }
  return true;
}

export async function mintInstallationToken(env, { fetchImpl = fetch, now }) {
  const repository = getRepositoryConfig(env);
  const installationId = requiredEnv(env, "GITHUB_APP_INSTALLATION_ID");
  if (!/^\d+$/.test(installationId)) throw new Error("GITHUB_APP_INSTALLATION_ID must be numeric");
  const appJwt = await createGitHubAppJwt({
    appId: requiredEnv(env, "GITHUB_APP_ID"),
    privateKey: requiredEnv(env, "GITHUB_APP_PRIVATE_KEY"),
    now,
  });
  const payload = await githubRequest(fetchImpl, `/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    token: appJwt,
    operation: "installation token creation",
    body: {
      repositories: [repository.name],
      permissions: {
        contents: "write",
        pull_requests: "write",
      },
    },
  });
  if (typeof payload.token !== "string" || !payload.token) {
    throw new GitHubUpstreamError(502, "installation token creation");
  }
  return payload.token;
}

async function currentBranchSha(fetchImpl, token, repository) {
  const ref = await githubRequest(fetchImpl, `${repoPath(repository)}/git/ref/heads/${encodeURIComponent(repository.branch)}`, {
    token,
    operation: "base branch lookup",
  });
  if (typeof ref.object?.sha !== "string") throw new GitHubUpstreamError(502, "base branch lookup");
  return ref.object.sha.toLowerCase();
}

async function currentFile(fetchImpl, token, repository, path, ref) {
  const file = await githubRequest(
    fetchImpl,
    `${repoPath(repository)}/contents/${contentPath(path)}?ref=${encodeURIComponent(ref)}`,
    { token, operation: "content lookup" },
  );
  if (
    file.type !== "file"
    || typeof file.sha !== "string"
    || file.encoding !== "base64"
    || typeof file.content !== "string"
    || !Number.isInteger(file.size)
    || file.size > MAX_GITHUB_FILE_BYTES
  ) {
    throw new GitHubUpstreamError(502, "content lookup");
  }
  return file;
}

export async function readRepositoryFile(env, path, {
  fetchImpl = fetch,
  now,
  mintToken = mintInstallationToken,
} = {}) {
  const repository = getRepositoryConfig(env);
  const token = await mintToken(env, { fetchImpl, now });
  const baseCommitSha = await currentBranchSha(fetchImpl, token, repository);
  const file = await currentFile(fetchImpl, token, repository, path, baseCommitSha);
  let content;
  try {
    content = decodeBase64Utf8(file.content);
  } catch {
    throw new HttpError(415, "not_utf8", "The browser editor only supports UTF-8 text files");
  }
  return {
    path,
    content,
    blob_sha: file.sha.toLowerCase(),
    base_commit_sha: baseCommitSha,
    branch: repository.branch,
  };
}

function branchSlug(path) {
  const filename = path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? "content";
  return filename.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "content";
}

async function deleteNewBranch(fetchImpl, token, repository, branch) {
  try {
    await githubRequest(fetchImpl, `${repoPath(repository)}/git/refs/heads/${contentPath(branch)}`, {
      method: "DELETE",
      token,
      operation: "failed draft branch cleanup",
      parse: false,
    });
  } catch {
    // A failed cleanup leaves an isolated non-main branch, never a main write.
  }
}

export async function openEditorPullRequest(env, input, {
  fetchImpl = fetch,
  now,
  randomBytes,
  mintToken = mintInstallationToken,
} = {}) {
  const repository = getRepositoryConfig(env);
  const token = await mintToken(env, { fetchImpl, now });

  const firstBaseCheck = await currentBranchSha(fetchImpl, token, repository);
  if (firstBaseCheck !== input.baseCommitSha) {
    throw new HttpError(409, "stale_base", "The main branch changed after this file was loaded", {
      current_base_commit_sha: firstBaseCheck,
    });
  }

  const file = await currentFile(fetchImpl, token, repository, input.path, input.baseCommitSha);
  if (file.sha.toLowerCase() !== input.blobSha) {
    throw new HttpError(409, "stale_file", "The file changed after it was loaded", {
      current_blob_sha: file.sha.toLowerCase(),
    });
  }

  // Recheck immediately before the first mutation. GitHub still resolves any
  // later race as an ordinary pull-request conflict rather than an overwrite.
  const secondBaseCheck = await currentBranchSha(fetchImpl, token, repository);
  if (secondBaseCheck !== input.baseCommitSha) {
    throw new HttpError(409, "stale_base", "The main branch changed while the edit was being checked", {
      current_base_commit_sha: secondBaseCheck,
    });
  }

  const timestamp = new Date(now * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  const branch = `editor/${branchSlug(input.path)}-${timestamp}-${randomHex(6, randomBytes)}`;
  await githubRequest(fetchImpl, `${repoPath(repository)}/git/refs`, {
    method: "POST",
    token,
    operation: "draft branch creation",
    body: {
      ref: `refs/heads/${branch}`,
      sha: input.baseCommitSha,
    },
  });

  try {
    const commit = await githubRequest(fetchImpl, `${repoPath(repository)}/contents/${contentPath(input.path)}`, {
      method: "PUT",
      token,
      operation: "content commit",
      body: {
        message: input.commitMessage,
        content: encodeBase64Utf8(input.content),
        sha: input.blobSha,
        branch,
      },
    });
    if (typeof commit.commit?.sha !== "string") throw new GitHubUpstreamError(502, "content commit");

    const pullRequest = await githubRequest(fetchImpl, `${repoPath(repository)}/pulls`, {
      method: "POST",
      token,
      operation: "pull request creation",
      body: {
        title: input.pullRequestTitle,
        body: input.pullRequestBody,
        head: branch,
        base: repository.branch,
        maintainer_can_modify: false,
      },
    });
    if (!Number.isInteger(pullRequest.number) || typeof pullRequest.html_url !== "string") {
      throw new GitHubUpstreamError(502, "pull request creation");
    }

    return {
      pull_request: {
        number: pullRequest.number,
        url: pullRequest.html_url,
      },
      branch,
      base_commit_sha: input.baseCommitSha,
      commit_sha: commit.commit.sha,
    };
  } catch (error) {
    await deleteNewBranch(fetchImpl, token, repository, branch);
    throw error;
  }
}
