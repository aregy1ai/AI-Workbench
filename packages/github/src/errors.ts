/**
 * AI Workbench - GitHub Error Classifier
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export function classifyGitHubError(error: any): string {
  const msg = error?.message || String(error);
  if (/already exists|reference already exists/i.test(msg)) {
    return "REFERENCE_ALREADY_EXISTS";
  }
  if (/not found/i.test(msg)) {
    return "RESOURCE_NOT_FOUND";
  }
  if (/bad credentials|unauthorized/i.test(msg)) {
    return "UNAUTHORIZED";
  }
  if (/rate limit/i.test(msg)) {
    return "RATE_LIMITED";
  }
  return "GITHUB_API_ERROR";
}

export function isAlreadyExistsError(error: any): boolean {
  const msg = error?.message || String(error);
  return /already exists|reference already exists/i.test(msg);
}
