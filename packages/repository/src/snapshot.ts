/**
 * AI Workbench - Repository Snapshots & Object Key Management
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface SnapshotInput {
  tenantId: string;
  workspaceId?: string;
  repositoryId: string;
  commitSha: string;
}

export interface RepositorySnapshot {
  id: string;
  tenantId: string;
  workspaceId?: string;
  repositoryId: string;
  commitSha: string;
  objectKey: string;
  treeHash: string;
  status: "available" | "refreshing" | "failed" | "expired";
  createdAt: string;
  expiresAt: string;
}

export class SnapshotService {
  private snapshots: Map<string, RepositorySnapshot> = new Map();

  private getCompositeKey(tenantId: string, repositoryId: string, commitSha: string): string {
    return `${tenantId}:${repositoryId}:${commitSha}`;
  }

  public async getOrCreate(input: SnapshotInput): Promise<RepositorySnapshot> {
    const key = this.getCompositeKey(input.tenantId, input.repositoryId, input.commitSha);
    const existing = this.snapshots.get(key);

    if (existing && existing.status === "available") {
      return existing;
    }

    // In a real system, clone repository with ephemeral lease and calculate treeHash
    const treeHash = `tree_${Math.random().toString(36).substring(2, 12)}_${input.commitSha.substring(0, 7)}`;
    const objectKey = `snapshots/${input.repositoryId}/${input.commitSha}.tar.zst`;
    const now = Date.now();

    const snapshot: RepositorySnapshot = {
      id: `snp_${Math.random().toString(36).substring(2, 10)}`,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      repositoryId: input.repositoryId,
      commitSha: input.commitSha,
      objectKey,
      treeHash,
      status: "available",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 24 * 3600 * 1000).toISOString(), // 24h TTL
    };

    this.snapshots.set(key, snapshot);
    return snapshot;
  }

  public findAvailable(input: SnapshotInput): RepositorySnapshot | undefined {
    const key = this.getCompositeKey(input.tenantId, input.repositoryId, input.commitSha);
    return this.snapshots.get(key);
  }

  public clear(): void {
    this.snapshots.clear();
  }
}

export const snapshotService = new SnapshotService();
