/**
 * AI Workbench - Unified Diff Utilities
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface DiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export function summarizeDiff(diffText: string): DiffSummary {
  const lines = diffText.split("\n");
  let files = 0;
  let ins = 0;
  let del = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      files++;
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      ins++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      del++;
    }
  }

  return {
    filesChanged: Math.max(files, 1),
    insertions: ins,
    deletions: del,
  };
}
