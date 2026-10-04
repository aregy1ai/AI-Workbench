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
const security = await import("./security/tenant-isolation.test");
const gateway = await import("./security/tool-gateway.test");
const audit = await import("./security/audit-hash-chain.test");

const tdiResults = tdi.runTechnicalDebtGateTestSuite();
const collectorResults = collectors.runTechnicalDebtCollectorTestSuite();
const securityResults = security.runSecurityTestSuite();
const gatewayResults = await gateway.runGatewayTestSuite();
const auditResults = audit.runAuditHashChainTestSuite();

const failures = [
  ...tdiResults.filter((r) => !r.passed).map((r) => "TDI: " + r.name + " :: " + (r.details ?? "")),
  ...collectorResults.filter((r) => !r.passed).map((r) => "COLLECTOR: " + r.name + " :: " + (r.details ?? "")),
  ...securityResults.filter((r) => !r.passed).map((r) => "SECURITY: " + r.testName + " :: " + (r.details ?? "")),
  ...gatewayResults.filter((r) => !r.passed).map((r) => "GATEWAY: " + r.name + " :: " + (r.details ?? "")),
  ...auditResults.filter((r) => !r.passed).map((r) => "AUDIT: " + r.name + " :: " + (r.details ?? "")),
];

console.log(
  "TDI=" + tdiResults.filter((r) => r.passed).length + "/" + tdiResults.length +
  " COLLECTOR=" + collectorResults.filter((r) => r.passed).length + "/" + collectorResults.length +
  " SECURITY=" + securityResults.filter((r) => r.passed).length + "/" + securityResults.length +
  " GATEWAY=" + gatewayResults.filter((r) => r.passed).length + "/" + gatewayResults.length +
  " AUDIT=" + auditResults.filter((r) => r.passed).length + "/" + auditResults.length,
);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
