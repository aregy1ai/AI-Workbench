/**
 * CI entrypoint for security-specific tests.
 * Sets the required test-only signer secret before dynamic imports.
 */
process.env.NODE_ENV = "test";
process.env.EAGLE_CONTEXT_SIGNER_SECRET =
  process.env.EAGLE_CONTEXT_SIGNER_SECRET ??
  "ci-test-only-secret-do-not-use-in-production-2026";

const security = await import("./security/tenant-isolation.test");
const gateway = await import("./security/tool-gateway.test");
const audit = await import("./security/audit-hash-chain.test");

const securityResults = security.runSecurityTestSuite();
const gatewayResults = await gateway.runGatewayTestSuite();
const auditResults = audit.runAuditHashChainTestSuite();

const failures = [
  ...securityResults.filter((r) => !r.passed).map((r) => "SECURITY: " + r.testName + " :: " + (r.details ?? "")),
  ...gatewayResults.filter((r) => !r.passed).map((r) => "GATEWAY: " + r.name + " :: " + (r.details ?? "")),
  ...auditResults.filter((r) => !r.passed).map((r) => "AUDIT: " + r.name + " :: " + (r.details ?? "")),
];

console.log(
  "SECURITY=" + securityResults.filter((r) => r.passed).length + "/" + securityResults.length +
  " GATEWAY=" + gatewayResults.filter((r) => r.passed).length + "/" + gatewayResults.length +
  " AUDIT=" + auditResults.filter((r) => r.passed).length + "/" + auditResults.length,
);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
