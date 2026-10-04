# TDI Project Coverage & Reuse Map

Status: Active implementation ledger
Date: 2026-10-04
Branch: `tdi-v1-foundation`
Baseline: `22c1ace005ee89f4bd5c16df9f60a4592fa972cb`

## Purpose

TDI is implemented as a governance/intelligence layer over mature internal and external components. It must not duplicate capabilities already provided by the workbench or by mature open-source analyzers.

The operating rule is:

> Reuse mature components. Write adapters where necessary. Keep authority, provenance, policy, and reproducibility inside Eagle.

## Complete internal component coverage

| Area | Existing component | TDI use | Status |
|---|---|---|---|
| API | `packages/api` | Future scan/report API surface | Reuse |
| Approvals | `packages/approvals` | Human REVIEW/approval path | Reuse |
| Artifacts | `packages/artifacts` | Result/manifest provenance | Reuse |
| Audit | `packages/audit` | Decision/evidence audit trail | Hardened: real SHA-256 |
| Auth | `packages/auth` | Request/tenant context | Reuse |
| Authorization | `packages/authorization` | Tenant/role boundary | Reuse |
| Billing/Budget | `packages/billing`, `packages/budget` | Cost and execution constraints | Reuse |
| Config | `packages/config` | Tool/config source | Reuse |
| Contracts | `packages/contracts` | Shared platform contracts | Reuse |
| Database | `packages/database` | Persistence/RLS | Reuse |
| Events/Webhooks | `packages/events`, `packages/webhooks` | Scan lifecycle/event triggers | Reuse |
| GitHub | `packages/github` | GitHub source/provider boundary | Adapter boundary; current client is simulated |
| Governance | `packages/governance` | Human governance and risk controls | Reuse |
| Integrations | `packages/integrations` | External provider abstraction | Reuse |
| Intelligence | `packages/intelligence` | TDI core | Implemented |
| LLM Workbench | `packages/llm-workbench` | Future AI Analyzer with schema validation | Reuse later |
| Marketplace | `packages/marketplace` | Tool metadata/discovery | Reuse where appropriate |
| Observability | `packages/observability` | Logs/telemetry | Reuse |
| Ops/Performance | `packages/ops`, `packages/performance` | Operational metrics and execution health | Reuse |
| Policy | `packages/policy` | Existing execution policy authority | Reuse; TDI gate is an adjacent policy |
| Policy-as-Code | `packages/policy-as-code` | Versioned policies, linting, compilation, simulation | Reuse |
| Queue/Worker | `packages/queue`, `packages/worker` | Scan orchestration | Reuse |
| Repository | `packages/repository` | Pinned source abstraction | Interface reusable; current snapshot implementation is prototype |
| Runs | `packages/runs` | Lifecycle, cancellation, concurrency controls | Reuse |
| Sandbox | `packages/sandbox` | Tool execution isolation | Contract reusable; current runtime is simulated |
| Secrets | `packages/secrets` | Ephemeral secret lease boundary | Reuse |
| Security | `packages/security` | Signed execution context and replay defense | Hardened: HMAC-SHA256 |
| Test Runner | `packages/test-runner` | Test execution orchestration | Reuse |
| Tools | `packages/tools` | Gateway, idempotency, tool capabilities | Reuse |
| SDK | `packages/sdk` | Future external API/SDK exposure | Future |

## Internal reuse rules

### Repository snapshots

Use the existing repository snapshot contract, but do not treat the current in-memory `SnapshotService` as production evidence storage. It currently generates IDs/tree hashes using non-deterministic in-memory behavior.

Production TDI requires a provider that returns:

- exact commit SHA;
- immutable source reference;
- trusted object/tree digest;
- tenant/workspace/repository identity;
- bounded content access.

No working tree is a source of truth for a pinned scan.

### Test Runner

Use the existing `TestExecutor` abstraction rather than creating a second process runner. TDI should request test execution through the platform sandbox and normalize the resulting reports into evidence.

### Sandbox

Keep all third-party analyzers behind the sandbox/tool gateway. The current runtime is a safety-oriented simulation, not a production container implementation. Therefore the execution contract is reusable, while real production execution must be backed by the project’s actual container/gVisor infrastructure.

### Policy

TDI is not a replacement for the existing Tool Policy. Tool Policy governs whether actions may run; TDI Debt Gate governs what a debt finding means for the consolidation gate.

### Audit

TDI decisions and evidence provenance should be auditable. The audit chain was hardened to use real SHA-256 rather than the previous demo/pseudo hash.

## External tool coverage

### Tier A

| Tool | Primary evidence | Integration | Version recorded |
|---|---|---|---|
| CodeQL | semantic security/static analysis | SARIF adapter | 2.27.1 |
| Semgrep | pattern-based security/correctness/maintainability | SARIF adapter | 1.179.0 |
| OSV-Scanner | dependency vulnerabilities | SARIF adapter | 2.6.0 |
| Trivy | vulnerability/misconfiguration/secret/supply chain | SARIF adapter | 0.74.0 |
| actionlint | GitHub Actions correctness | JSON adapter | 1.7.12 |
| dependency-cruiser | architecture dependency rules | JSON adapter | 18.1.0 |
| Knip | unused code/dependencies/exports | JSON adapter | 6.31.0 |

### Tier B

| Tool | Primary evidence | Integration | Version recorded |
|---|---|---|---|
| OpenSSF Scorecard | repository/supply-chain posture | JSON adapter | 5.5.0 |
| Syft | SBOM/package inventory | SPDX JSON adapter | 1.54.0 |
| Gitleaks | secret detection | redacted JSON adapter | Pin at adoption |

### Optional benchmark

SonarQube may be used as a comparative maintainability/technical-debt evidence source. It does not receive Eagle policy authority.

## Tool trust boundary

All third-party tool output is untrusted input.

Every adapter must preserve or derive:

- tenant;
- workspace;
- repository;
- exact commit;
- tool ID and version;
- invocation/config digest;
- rule/query-set identity;
- database version when relevant;
- raw output digest;
- normalized evidence digest;
- path/line where available;
- original tool severity;
- redaction state for sensitive data.

A third-party result never directly becomes PASS/REVIEW/BLOCK.

## Reproducibility target

A reproducible scan is defined as equivalent evidence for the same:

```text
commit
+ tool version
+ tool configuration
+ query/rule set
+ relevant vulnerability/SBOM database version
```

Runtime timestamps are metadata, not decision inputs.

## AI boundary

Future AI analysis uses `Finding` only.

AI may:

- explain;
- classify provisionally;
- suggest recommendation;
- estimate confidence.

AI may not:

- emit PASS;
- emit REVIEW;
- emit BLOCK;
- supply trusted severity for blocking;
- bypass evidence/provenance checks.

The enforced path is:

```text
External / deterministic evidence
        ↓
Verified Evidence
        ↓
AI Finding (optional)
        ↓
Deterministic Scorer
        ↓
PolicyFacts
        ↓
Debt Gate
        ↓
PASS / REVIEW / BLOCK
```

## Current blocking gaps

1. Real production repository snapshot provider.
2. Real sandbox/container executor behind the existing sandbox contract.
3. Actual execution of external binaries in isolated CI/tool jobs.
4. Database migration execution against PostgreSQL.
5. Main branch protection/ruleset configuration.
6. Full CI execution proof on the latest branch commit.
7. Production secret provisioning for `EAGLE_CONTEXT_SIGNER_SECRET`.
8. Tool supply-chain pinning/attestation for the CI action/tool installation layer.
9. Migration of legacy evidence ID arrays to junction relationships and eventual removal of the arrays.

These are implementation/verification gaps, not reasons to rebuild the architecture.
