import { GitHubFetch, GitHubTokenProvider } from "./github";
import { PinnedSource } from "../collector/types";

export interface GitHistoryCommit {
  sha: string;
  authoredAt?: string;
  committedAt?: string;
  message?: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name?: string;
  event?: string;
  status?: string;
  conclusion?: string | null;
  createdAt?: string;
  updatedAt?: string;
  headSha?: string;
}

export interface GitHistoryProvider {
  listCommits(
    source: PinnedSource,
    windowDays: number,
  ): Promise<readonly GitHistoryCommit[]>;
  listWorkflowRuns(
    source: PinnedSource,
  ): Promise<readonly GitHubWorkflowRun[]>;
}

function splitRepositoryId(repositoryId: string): { owner: string; repo: string } {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repositoryId);
  if (!match) throw new Error("TDI_REPOSITORY_ID_INVALID");
  return { owner: match[1], repo: match[2] };
}

function assertSha(value: string): void {
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("TDI_COMMIT_SHA_INVALID");
}

export class GitHubHistoryProvider implements GitHistoryProvider {
  private readonly fetchImpl: GitHubFetch;
  private readonly apiBaseUrl: string;
  constructor(
    private readonly tokenProvider: GitHubTokenProvider,
    options: { fetchImpl?: GitHubFetch; apiBaseUrl?: string } = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/, "");
  }

  private async getJson(repositoryId: string, path: string): Promise<any> {
    const token = await this.tokenProvider.getToken(repositoryId);
    if (!token || token.length < 20) throw new Error("TDI_GITHUB_TOKEN_REQUIRED");
    const response = await this.fetchImpl(this.apiBaseUrl + path, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error("TDI_GITHUB_API_ERROR:" + response.status);
    return response.json();
  }

  async listCommits(
    source: PinnedSource,
    windowDays: number,
  ): Promise<readonly GitHistoryCommit[]> {
    assertSha(source.commitSha);
    if (!Number.isInteger(windowDays) || windowDays <= 0 || windowDays > 3650) {
      throw new Error("TDI_HISTORY_WINDOW_INVALID");
    }
    const { owner, repo } = splitRepositoryId(source.repositoryId);
    const pinnedCommit = await this.getJson(
      source.repositoryId,
      `/repos/${owner}/${repo}/commits/${source.commitSha}`,
    );

    if (String(pinnedCommit?.sha).toLowerCase() !== source.commitSha.toLowerCase()) {
      throw new Error("TDI_COMMIT_PIN_MISMATCH");
    }

    const committedAt = pinnedCommit?.commit?.committer?.date ?? pinnedCommit?.commit?.author?.date;
    if (typeof committedAt !== "string" || Number.isNaN(Date.parse(committedAt))) {
      throw new Error("TDI_PINNED_COMMIT_DATE_MISSING");
    }

    const until = new Date(committedAt);
    const since = new Date(until.getTime() - windowDays * 86_400_000);
    const commits: GitHistoryCommit[] = [];

    for (let page = 1; page <= 10; page++) {
      const values = await this.getJson(
        source.repositoryId,
        `/repos/${owner}/${repo}/commits?sha=${source.commitSha}&since=${encodeURIComponent(
          since.toISOString(),
        )}&until=${encodeURIComponent(until.toISOString())}&per_page=100&page=${page}`,
      );

      if (!Array.isArray(values)) throw new Error("TDI_COMMITS_RESPONSE_INVALID");

      for (const value of values) {
        if (!value || typeof value !== "object" || typeof value.sha !== "string") {
          throw new Error("TDI_COMMIT_RECORD_INVALID");
        }
        commits.push({
          sha: value.sha,
          authoredAt: value.commit?.author?.date,
          committedAt: value.commit?.committer?.date,
          message: value.commit?.message,
        });
      }

      if (values.length < 100) break;
    }

    return commits;
  }

  async listWorkflowRuns(source: PinnedSource): Promise<readonly GitHubWorkflowRun[]> {
    assertSha(source.commitSha);
    const { owner, repo } = splitRepositoryId(source.repositoryId);
    const response = await this.getJson(
      source.repositoryId,
      `/repos/${owner}/${repo}/actions/runs?head_sha=${source.commitSha}&per_page=100`,
    );

    if (!Array.isArray(response?.workflow_runs)) {
      throw new Error("TDI_WORKFLOW_RUNS_RESPONSE_INVALID");
    }

    return response.workflow_runs.map((run: any) => ({
      id: Number(run.id),
      name: typeof run.name === "string" ? run.name : undefined,
      event: typeof run.event === "string" ? run.event : undefined,
      status: typeof run.status === "string" ? run.status : undefined,
      conclusion: typeof run.conclusion === "string" ? run.conclusion : run.conclusion ?? null,
      createdAt: typeof run.created_at === "string" ? run.created_at : undefined,
      updatedAt: typeof run.updated_at === "string" ? run.updated_at : undefined,
      headSha: typeof run.head_sha === "string" ? run.head_sha : undefined,
    }));
  }
}
