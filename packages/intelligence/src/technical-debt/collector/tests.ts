import { Evidence } from "../contracts/evidence";
import { TestRunResult, parseJUnitXml } from "../../../../test-runner/src/reports";
import { digestJson, deterministicEvidenceId } from "./digest";
import { PinnedSource } from "./types";

export interface TdiTestEvidenceInput {
  source: PinnedSource;
  result: TestRunResult;
  junitXml?: string;
  coverage?: Record<string, unknown>;
}

export class TestEvidenceCollector {
  public readonly id = "test-runner";
  public readonly evidenceType = "test" as const;

  collect(input: TdiTestEvidenceInput): Evidence[] {
    const suites = input.junitXml ? parseJUnitXml(input.junitXml) : [];
    const summary = {
      passed: input.result.passed,
      commands: input.result.results.map((item) => ({
        name: item.name,
        required: item.required,
        exitCode: item.exitCode,
        hasStdout: item.stdout.length > 0,
        hasStderr: item.stderr.length > 0,
      })),
      suites: suites.map((suite) => ({
        name: suite.name,
        tests: suite.tests,
        failures: suite.failures,
        skipped: suite.skipped,
        durationSeconds: suite.durationSeconds,
      })),
      coverage: input.coverage ?? null,
    };
    const contentDigest = digestJson({
      repositoryId: input.source.repositoryId,
      commitSha: input.source.commitSha,
      summary,
    });
    return [{
      id: deterministicEvidenceId({
        tenantId: input.source.tenantId,
        workspaceId: input.source.workspaceId,
        repositoryId: input.source.repositoryId,
        commitSha: input.source.commitSha,
        evidenceType: "test",
        source: "test-runner",
        contentDigest,
      }),
      type: "test",
      tenantId: input.source.tenantId,
      workspaceId: input.source.workspaceId,
      repositoryId: input.source.repositoryId,
      commitSha: input.source.commitSha,
      source: "test-runner",
      collectedAt: new Date().toISOString(),
      contentDigest,
      data: summary,
    }];
  }
}
