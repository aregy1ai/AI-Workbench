/**
 * AI Workbench - Test Reports & Parser
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface TestCommandResult {
  name: string;
  required: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface TestRunResult {
  passed: boolean;
  results: TestCommandResult[];
}

export interface ParsedTestSuite {
  name: string;
  tests: number;
  failures: number;
  skipped: number;
  durationSeconds: number;
}

export function parseJUnitXml(xml: string): ParsedTestSuite[] {
  const suites: ParsedTestSuite[] = [];
  const suiteMatches = xml.match(/<testsuite[\s\S]*?<\/testsuite>|<testsuite[^>]*\/>/g) || [];

  for (const suiteTag of suiteMatches) {
    const nameMatch = suiteTag.match(/name="([^"]+)"/);
    const testsMatch = suiteTag.match(/tests="(\d+)"/);
    const failuresMatch = suiteTag.match(/failures="(\d+)"/);
    const timeMatch = suiteTag.match(/time="([^"]+)"/);

    suites.push({
      name: nameMatch ? nameMatch[1] : "default",
      tests: testsMatch ? parseInt(testsMatch[1], 10) : 0,
      failures: failuresMatch ? parseInt(failuresMatch[1], 10) : 0,
      skipped: 0,
      durationSeconds: timeMatch ? parseFloat(timeMatch[1]) : 0,
    });
  }

  return suites;
}
