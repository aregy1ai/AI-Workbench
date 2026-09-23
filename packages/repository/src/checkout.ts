/**
 * AI Workbench - Git Checkout & Tree Helpers
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface CheckoutOptions {
  repositoryId: string;
  ref: string;
  sparsePaths?: string[];
  clean?: boolean;
}

export function formatGitCheckoutCommand(options: CheckoutOptions): {
  executable: string;
  args: string[];
} {
  return {
    executable: "git",
    args: ["checkout", options.ref, "--force"],
  };
}
