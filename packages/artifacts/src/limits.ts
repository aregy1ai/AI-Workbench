/**
 * AI Workbench - Artifact Size Limits & Pattern Rules
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { ArtifactType } from "./manifest";

export interface ArtifactRule {
  type: ArtifactType;
  patterns: string[];
  maxBytes: number;
}

export const artifactRules: ArtifactRule[] = [
  {
    type: "log",
    patterns: ["logs/**/*.txt", "**/*.log"],
    maxBytes: 100 * 1024 * 1024,
  },
  {
    type: "test-report",
    patterns: [
      "coverage/**/*",
      "test-results/**/*",
      "junit.xml",
    ],
    maxBytes: 200 * 1024 * 1024,
  },
  {
    type: "diff",
    patterns: ["change.diff", "*.diff"],
    maxBytes: 50 * 1024 * 1024,
  },
];
