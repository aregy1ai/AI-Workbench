import { Evidence } from "../contracts/evidence";
import { digestJson, deterministicEvidenceId } from "./digest";
import { PinnedSource } from "./types";
import { GitHistoryProvider } from "../source/github-history";

export class GitHistoryEvidenceCollector {
  public readonly id = "git-history";
  public readonly evidenceType = "git" as const;

  constructor(
    private readonly historyProvider: GitHistoryProvider,
    private readonly windowDays = 90,
  ) {}

  async collect(source: PinnedSource): Promise<Evidence[]> {
    const commits = await this.historyProvider.listCommits(source, this.windowDays);
    const payload = {
      repositoryId: source.repositoryId,
      commitSha: source.commitSha,
      windowDays: this.windowDays,
      changeFrequency: commits.length,
      commitShas: commits.map((commit) => commit.sha),
    };
    const contentDigest = digestJson(payload);
    return [{
      id: deterministicEvidenceId({
        tenantId: source.tenantId,
        workspaceId: source.workspaceId,
        repositoryId: source.repositoryId,
        commitSha: source.commitSha,
        evidenceType: "git",
        source: "github:commit-history",
        contentDigest,
      }),
      type: "git",
      tenantId: source.tenantId,
      workspaceId: source.workspaceId,
      repositoryId: source.repositoryId,
      commitSha: source.commitSha,
      source: "github:commit-history",
      collectedAt: new Date().toISOString(),
      contentDigest,
      data: payload,
    }];
  }
}
