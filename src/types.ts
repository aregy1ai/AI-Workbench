/**
 * AI Workbench - UI Types & Shared Interfaces
 */

export interface TenantInfo {
  id: string;
  name: string;
  plan: string;
  budgetLimit: number;
  workspaces: WorkspaceInfo[];
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  repositories: RepoInfo[];
}

export interface RepoInfo {
  id: string;
  fullName: string;
  defaultBranch: string;
  language: string;
}

export interface DiffHunk {
  file: string;
  oldPath: string;
  newPath: string;
  changes: {
    type: "add" | "delete" | "context";
    line: string;
  }[];
}
