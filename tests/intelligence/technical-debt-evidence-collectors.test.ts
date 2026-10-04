import {
  CiEvidenceCollector,
  GitHistoryEvidenceCollector,
  TestEvidenceCollector,
} from "../../packages/intelligence/src/technical-debt";

const source = {
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  repositoryId: "aregy1ai/AI-Workbench",
  commitSha: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb",
  sourceRoot: "/workspace/pinned",
};

export async function runTechnicalDebtEvidenceCollectorSuite(): Promise<{
  name: string;
  passed: boolean;
  details?: string;
}[]> {
  const results: { name: string; passed: boolean; details?: string }[] = [];
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (e) {
      results.push({ name, passed: false, details: e instanceof Error ? e.message : String(e) });
    }
  };

  await test("git collector calculates deterministic commit frequency", async () => {
    const provider = {
      async listCommits() {
        return [
          { sha: "a".repeat(40) },
          { sha: "b".repeat(40) },
          { sha: "c".repeat(40) },
        ];
      },
      async listWorkflowRuns() { return []; },
    };
    const collector = new GitHistoryEvidenceCollector(provider, 90);
    const first = await collector.collect(source);
    const second = await collector.collect(source);
    if (first[0].data.changeFrequency !== 3) throw new Error("wrong change frequency");
    if (first[0].id !== second[0].id) throw new Error("git evidence identity is not stable");
    if (first[0].contentDigest !== second[0].contentDigest) throw new Error("git digest is not stable");
  });

  await test("ci collector binds workflow evidence to the pinned commit", async () => {
    const provider = {
      async listCommits() { return []; },
      async listWorkflowRuns() {
        return [
          { id: 1, status: "completed", conclusion: "success", headSha: source.commitSha },
          { id: 2, status: "completed", conclusion: "failure", headSha: source.commitSha },
          { id: 3, status: "in_progress", conclusion: null, headSha: source.commitSha },
        ];
      },
    };
    const collector = new CiEvidenceCollector(provider);
    const evidence = await collector.collect(source);
    if (evidence.length !== 1) throw new Error("expected CI evidence");
    if (evidence[0].data.total !== 3) throw new Error("wrong CI total");
    if (evidence[0].data.successful !== 1 || evidence[0].data.failed !== 1) {
      throw new Error("wrong CI outcome counts");
    }
    if (evidence[0].commitSha !== source.commitSha) throw new Error("CI commit binding lost");
  });

  await test("test collector identity excludes runtime duration", () => {
    const collector = new TestEvidenceCollector();
    const first = collector.collect({
      source,
      result: {
        passed: true,
        results: [
          {
            name: "unit",
            required: true,
            exitCode: 0,
            stdout: "ok",
            stderr: "",
            durationMs: 10,
          },
        ],
      },
    });
    const second = collector.collect({
      source,
      result: {
        passed: true,
        results: [
          {
            name: "unit",
            required: true,
            exitCode: 0,
            stdout: "ok",
            stderr: "",
            durationMs: 9000,
          },
        ],
      },
    });
    if (first[0].id !== second[0].id) throw new Error("runtime duration changed evidence identity");
    if (first[0].contentDigest !== second[0].contentDigest) {
      throw new Error("runtime duration changed evidence digest");
    }
  });

  await test("JUnit reports are normalized into test evidence", () => {
    const collector = new TestEvidenceCollector();
    const evidence = collector.collect({
      source,
      result: { passed: false, results: [] },
      junitXml: '<testsuites><testsuite name="unit" tests="3" failures="1" time="1.5"></testsuite></testsuites>',
    });
    const suites = evidence[0].data.suites as Array<Record<string, unknown>>;
    if (suites[0].tests !== 3 || suites[0].failures !== 1) {
      throw new Error("JUnit suite data was not normalized");
    }
  });

  return results;
}
