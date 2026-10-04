/**
 * CI test entrypoint for the current repository test suites.
 * Environment variables are established before loading modules that instantiate
 * security singletons.
 */
process.env.NODE_ENV = "test";
process.env.EAGLE_CONTEXT_SIGNER_SECRET =
  process.env.EAGLE_CONTEXT_SIGNER_SECRET ??
  "ci-test-only-secret-do-not-use-in-production-2026";

const tdi = await import("./intelligence/technical-debt-gate.test");
const collectors = await import("./intelligence/technical-debt-collectors.test");
const source = await import("./intelligence/technical-debt-source.test");
const repository = await import("./intelligence/technical-debt-repository.test");
const orchestrator = await import("./intelligence/technical-debt-orchestrator.test");
const evidenceCollectors = await import("./intelligence/technical-debt-evidence-collectors.test");
const security = await import("./security/tenant-isolation.test");
const gateway = await import("./security/tool-gateway.test");
const audit = await import("./security/audit-hash-chain.test");
const sandbox = await import("./security/sandbox-tool-allowlist.test");

const tdiResults = tdi.runTechnicalDebtGateTestSuite();
const collectorResults = collectors.runTechnicalDebtCollectorTestSuite();
const sourceResults = await source.runTechnicalDebtSourceTestSuite();
const repositoryResults = await repository.runTechnicalDebtRepositoryTestSuite();
const orchestratorResults = await orchestrator.runTechnicalDebtOrchestratorTestSuite();
const evidenceCollectorResults = await evidenceCollectors.runTechnicalDebtEvidenceCollectorSuite();
const securityResults = security.runSecurityTestSuite();
const gatewayResults = await gateway.runGatewayTestSuite();
const auditResults = audit.runAuditHashChainTestSuite();
const sandboxResults = sandbox.runSandboxToolAllowlistTestSuite();

const failures = [
  ...tdiResults.filter((r) => !r.passed).map((r) => "TDI: " + r.name + " :: " + (r.details ?? "")),
  ...collectorResults.filter((r) => !r.passed).map((r) => "COLLECTOR: " + r.name + " :: " + (r.details ?? "")),
  ...sourceResults.filter((r) => !r.passed).map((r) => "SOURCE: " + r.name + " :: " + (r.details ?? "")),
  ...repositoryResults.filter((r) => !r.passed).map((r) => "REPOSITORY: " + r.name + " :: " + (r.details ?? "")),
  ...orchestratorResults.filter((r) => !r.passed).map((r) => "ORCHESTRATOR: " + r.name + " :: " + (r.details ?? "")),
  ...evidenceCollectorResults.filter((r) => !r.passed).map((r) => "EVIDENCE: " + r.name + " :: " + (r.details ?? "")),
  ...securityResults.filter((r) => !r.passed).map((r) => "SECURITY: " + r.testName + " :: " + (r.details ?? "")),
  ...gatewayResults.filter((r) => !r.passed).map((r) => "GATEWAY: " + r.name + " :: " + (r.details ?? "")),
  ...auditResults.filter((r) => !r.passed).map((r) => "AUDIT: " + r.name + " :: " + (r.details ?? "")),
  ...sandboxResults.filter((r) => !r.passed).map((r) => "SANDBOX: " + r.name + " :: " + (r.details ?? "")),
];

console.log(
  "TDI=" + tdiResults.filter((r) => r.passed).length + "/" + tdiResults.length +
  " EVIDENCE=" + evidenceCollectorResults.filter((r) => r.passed).length + "/" + evidenceCollectorResults.length +
  " COLLECTOR=" + collectorResults.filter((r) => r.passed).length + "/" + collectorResults.length +
  " SOURCE=" + sourceResults.filter((r) => r.passed).length + "/" + sourceResults.length +
  " REPOSITORY=" + repositoryResults.filter((r) => r.passed).length + "/" + repositoryResults.length +
  " ORCHESTRATOR=" + orchestratorResults.filter((r) => r.passed).length + "/" + orchestratorResults.length +
  " SECURITY=" + securityResults.filter((r) => r.passed).length + "/" + securityResults.length +
  " GATEWAY=" + gatewayResults.filter((r) => r.passed).length + "/" + gatewayResults.length +
  " AUDIT=" + auditResults.filter((r) => r.passed).length + "/" + auditResults.length +
  " SANDBOX=" + sandboxResults.filter((r) => r.passed).length + "/" + sandboxResults.length,
);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
