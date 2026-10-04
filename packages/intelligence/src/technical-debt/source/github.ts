import { createHash } from "node:crypto";
import { stableStringify } from "../collector/canonical-json";

export interface GitHubSourceRequest {
  tenantId: string;
  workspaceId: string;
  repositoryId: string;
  commitSha: string;
}

export interface GitTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

export interface PinnedRepositorySnapshot {
  tenantId: string;
  workspaceId: string;
  repositoryId: string;
  commitSha: string;
  commitVerified: boolean;
  treeSha: string;
  treeDigest: string;
  files: readonly GitTreeEntry[];
}

export interface PinnedSourceProvider {
  getSnapshot(input: GitHubSourceRequest): Promise<PinnedRepositorySnapshot>;
  readFile(
    input: GitHubSourceRequest & { blobSha: string },
  ): Promise<{
    path?: string;
    blobSha: string;
    content: string;
    contentDigest: string;
  }>;
}

export interface GitHubTokenProvider {
  getToken(repositoryId: string): Promise<string>;
}

export interface GitHubFetch {
  (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response>;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertCommitSha(value: string): void {
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error("TDI_COMMIT_SHA_INVALID");
  }
}

function assertRepositoryId(value: string): { owner: string; repo: string } {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
  if (!match) throw new Error("TDI_REPOSITORY_ID_INVALID");
  return { owner: match[1], repo: match[2] };
}

function normalizeTree(
  entries: unknown[],
): GitTreeEntry[] {
  const files: GitTreeEntry[] = [];

  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const type = item.type;
    if (type !== "blob" && type !== "tree" && type !== "commit") continue;
    if (typeof item.path !== "string" || typeof item.sha !== "string" || typeof item.mode !== "string") {
      throw new Error("TDI_TREE_ENTRY_INVALID");
    }

    files.push({
      path: item.path,
      mode: item.mode,
      type,
      sha: item.sha,
      size: typeof item.size === "number" ? item.size : undefined,
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function treeDigest(entries: readonly GitTreeEntry[]): string {
  return "sha256:" + sha256Hex(stableStringify(entries));
}

export class GitHubCommitSourceProvider implements PinnedSourceProvider {
  private readonly fetchImpl: GitHubFetch;
  private readonly apiBaseUrl: string;
  private readonly tokenProvider: GitHubTokenProvider;

  constructor(
    tokenProvider: GitHubTokenProvider,
    options: { fetchImpl?: GitHubFetch; apiBaseUrl?: string } = {},
  ) {
    this.tokenProvider = tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/, "");
  }

  private async requestJson(
    repositoryId: string,
    path: string,
  ): Promise<any> {
    const token = await this.tokenProvider.getToken(repositoryId);
    if (!token || token.trim().length < 20) {
      throw new Error("TDI_GITHUB_TOKEN_REQUIRED");
    }

    const response = await this.fetchImpl(this.apiBaseUrl + path, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error("TDI_GITHUB_API_ERROR:" + response.status);
    }

    return response.json();
  }

  public async getSnapshot(
    input: GitHubSourceRequest,
  ): Promise<PinnedRepositorySnapshot> {
    assertCommitSha(input.commitSha);
    const { owner, repo } = assertRepositoryId(input.repositoryId);

    const commit = await this.requestJson(
      input.repositoryId,
      `/repos/${owner}/${repo}/commits/${input.commitSha}`,
    );

    if (String(commit?.sha).toLowerCase() !== input.commitSha.toLowerCase()) {
      throw new Error("TDI_COMMIT_PIN_MISMATCH");
    }

    const tree = await this.requestJson(
      input.repositoryId,
      `/repos/${owner}/${repo}/git/trees/${input.commitSha}?recursive=1`,
    );

    if (tree?.truncated === true) {
      throw new Error("TDI_TREE_TRUNCATED_FAIL_CLOSED");
    }

    const entries = normalizeTree(Array.isArray(tree?.tree) ? tree.tree : []);
    const files = entries.filter((entry) => entry.type === "blob");

    if (typeof tree?.sha !== "string" || tree.sha.length < 7) {
      throw new Error("TDI_TREE_SHA_INVALID");
    }

    return {
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      repositoryId: input.repositoryId,
      commitSha: input.commitSha,
      commitVerified: true,
      treeSha: tree.sha,
      treeDigest: treeDigest(files),
      files,
    };
  }

  public async readFile(
    input: GitHubSourceRequest & { blobSha: string },
  ): Promise<{
    path?: string;
    blobSha: string;
    content: string;
    contentDigest: string;
  }> {
    assertCommitSha(input.commitSha);
    const { owner, repo } = assertRepositoryId(input.repositoryId);

    if (!/^[0-9a-f]{40}$/.test(input.blobSha)) {
      throw new Error("TDI_BLOB_SHA_INVALID");
    }

    const blob = await this.requestJson(
      input.repositoryId,
      `/repos/${owner}/${repo}/git/blobs/${input.blobSha}`,
    );

    if (String(blob?.sha).toLowerCase() !== input.blobSha.toLowerCase()) {
      throw new Error("TDI_BLOB_PIN_MISMATCH");
    }

    if (blob?.encoding !== "base64" || typeof blob?.content !== "string") {
      throw new Error("TDI_BLOB_ENCODING_UNSUPPORTED");
    }

    const normalized = String(blob.content).replace(/\s+/g, "");
    const bytes = Buffer.from(normalized, "base64");
    const content = bytes.toString("utf8");

    if (!bytes.equals(Buffer.from(content, "utf8"))) {
      throw new Error("TDI_BLOB_BINARY_CONTENT");
    }

    return {
      blobSha: input.blobSha,
      content,
      contentDigest: "sha256:" + sha256Hex(content),
    };
  }
}
