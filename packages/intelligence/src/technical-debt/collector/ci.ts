import { Evidence } from "../contracts/evidence";
import { digestJson, deterministicEvidenceId } from "./digest";
import { PinnedSource } from "./types";
import { GitHistoryProvider } from "../source/github-history";

export class CiEvidenceCollector {
  public readonly id = "github-ci";
  public readonly evidenceType = "ci" as const;

  constructor(private readonly historyProvider: GitHistoryProvider) {}

  async collect(source: PinnedSource): Promise<Evidence[]> {
    const runs = await this.historyProvider.listWorkflowRuns(source);
    const summary = {
      total: runs.length,
      successful: runs.filter((run) => run.conclusion === "success").length,
      failed: runs.filter((run) => run.conclusion === "failure").length,
      cancelled: runs.filter((run) => run.conclusion === "cancelled").length,
      inProgress: runs.filter((run) => run.status === "in_progress" || run.status === "queued").length,
      runs: runs.map((run) => ({
        id: run.id,
        name: run.name ?? null,
        event: run.event ?? null,
        status: run.status ?? null,
        conclusion: run.conclusion ?? null,
        headSha: run.headSha ?? null,
      })),
    };
    const contentDigest = digestJson({
      repositoryId: source.repositoryId,
      commitSha: source.commitSha,
      summary,
    });
    return [{
      id: deterministicEvidenceId({
        tenantId: source.tenantId,
        workspaceId: source.workspaceId,
        repositoryId: source.repositoryId,
        commitSha: source.commitSha,
        evidenceType: "ci",
        source: "github:workflow-runs",
        contentDigest,
      }),
      type: "ci",
      tenantId: source.tenantId,
      workspaceId: source.workspaceId,
      repositoryId: source.repositoryId,
      commitSha: source.commitSha,
      source: "github:workflow-runs",
      collectedAt: new Date().toISOString(),
      contentDigest,
      data: summary,
    }];
  }
}
