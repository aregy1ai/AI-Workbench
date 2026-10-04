import { Evidence } from "../contracts/evidence";
import { digestJson, deterministicEvidenceId, sha256Digest } from "./digest";
import {
  GitHubSourceRequest,
  PinnedRepositorySnapshot,
} from "../source/github";

export interface RepositoryEvidenceSource extends GitHubSourceRequest {
  snapshot?: PinnedRepositorySnapshot;
}

export interface RepositoryCollectorOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  includeExtensions?: ReadonlySet<string>;
}

export interface RepositoryFileReader {
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

const DEFAULT_EXTENSIONS = new Set([
  ".cjs", ".css", ".go", ".h", ".hpp", ".html", ".java", ".js",
  ".jsx", ".json", ".md", ".mjs", ".py", ".rs", ".sh", ".sql",
  ".ts", ".tsx", ".toml", ".vue", ".xml", ".yml", ".yaml",
]);

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index).toLowerCase() : "";
}

function lineCount(content: string): number {
  if (content.length === 0) return 0;
  return content.split("\n").length;
}

export class RepositoryEvidenceCollector {
  public readonly id = "repository-snapshot";
  public readonly evidenceType = "architecture" as const;
  private readonly options: Required<RepositoryCollectorOptions>;

  constructor(
    private readonly sourceProvider: RepositoryFileReader,
    options: RepositoryCollectorOptions = {},
  ) {
    this.options = {
      maxFiles: options.maxFiles ?? 5000,
      maxFileBytes: options.maxFileBytes ?? 1024 * 1024,
      includeExtensions: options.includeExtensions ?? DEFAULT_EXTENSIONS,
    };
  }

  public async collect(input: RepositoryEvidenceSource): Promise<Evidence[]> {
    const snapshot =
      input.snapshot ??
      await this.sourceProvider.getSnapshot({
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        repositoryId: input.repositoryId,
        commitSha: input.commitSha,
      });

    if (!snapshot.commitVerified) {
      throw new Error("TDI_SNAPSHOT_COMMIT_UNVERIFIED");
    }
    if (snapshot.commitSha !== input.commitSha) {
      throw new Error("TDI_SNAPSHOT_COMMIT_MISMATCH");
    }

    const selected = snapshot.files
      .filter((file) => file.type === "blob")
      .filter((file) => this.options.includeExtensions.has(extension(file.path)))
      .slice(0, this.options.maxFiles);

    const evidence: Evidence[] = [];

    for (const file of selected) {
      if (file.size !== undefined && file.size > this.options.maxFileBytes) continue;

      const result = await this.sourceProvider.readFile({
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        repositoryId: input.repositoryId,
        commitSha: input.commitSha,
        blobSha: file.sha,
      });

      if (result.blobSha !== file.sha) {
        throw new Error("TDI_BLOB_PIN_MISMATCH");
      }

      const contentDigest = sha256Digest(result.content);
      if (contentDigest !== result.contentDigest) {
        throw new Error("TDI_BLOB_DIGEST_MISMATCH");
      }

      const payload = {
        repositoryId: input.repositoryId,
        commitSha: input.commitSha,
        treeDigest: snapshot.treeDigest,
        path: file.path,
        blobSha: file.sha,
        mode: file.mode,
        sizeBytes: Buffer.byteLength(result.content, "utf8"),
        lineCount: lineCount(result.content),
        contentDigest,
      };
      const evidenceRecordDigest = digestJson(payload);

      const evidenceKey = deterministicEvidenceId({
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        repositoryId: input.repositoryId,
        commitSha: input.commitSha,
        evidenceType: "architecture",
        source: "repository-snapshot",
        path: file.path,
        contentDigest,
      });

      evidence.push({
        id: evidenceKey,
        type: "architecture",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        repositoryId: input.repositoryId,
        commitSha: input.commitSha,
        source: "repository-snapshot",
        path: file.path,
        collectedAt: new Date().toISOString(),
        contentDigest,
        data: { ...payload, evidenceRecordDigest },
      });
    }

    return evidence;
  }
}

export const DEFAULT_REPOSITORY_EVIDENCE_EXTENSIONS = DEFAULT_EXTENSIONS;
