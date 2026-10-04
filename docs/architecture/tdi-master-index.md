# Eagle TDI Master Index

Date: 2026-10-04
Branch: `tdi-v1-foundation`
Baseline: `22c1ace005ee89f4bd5c16df9f60a4592fa972cb`

## Executive decision

Technical Debt Intelligence (TDI) is implemented as a read-only evidence/governance layer inside AI Workbench.

The project will reuse:

- mature internal platform components;
- mature external analysis engines;
- standard machine-readable formats such as SARIF, SPDX, and JSON;
- existing security, policy, sandbox, test-runner, audit, queue/worker, and approval infrastructure.

TDI will not implement duplicate static-analysis engines, vulnerability databases, SBOM engines, secret databases, or a second execution gateway.

## Authority model

```text
Source / Tool
    |
    v
Evidence
    |
    v
Finding
    |
    v
Debt Record
    |
    v
Versioned Deterministic Scoring Policy
    |
    v
Trusted PolicyFacts
    |
    v
Debt Gate
    |
    v
Decision
    |
    v
Registry / Report / Human Approval
```

AI is an optional analyzer. It cannot produce PASS/REVIEW/BLOCK and cannot manufacture a trusted blocking severity.

## Production safety rule

TDI remains non-production-gate-ready until:

1. `main` branch protection/rulesets are active;
2. audit cryptography is real SHA-256;
3. execution-context signing has no hard-coded secret and a production secret is provisioned;
4. pinned source is truly immutable;
5. third-party analyzers execute inside the real production sandbox;
6. database migrations are applied and verified in PostgreSQL;
7. CI provides passing evidence for the exact branch head;
8. tool versions/config/rules/database versions are recorded;
9. evidence provenance and digests are verified;
10. REVIEW has a human approval path.

## Internal reusable components

### Security and authorization

- `packages/auth`
- `packages/authorization`
- `packages/security`
- `packages/secrets`
- `packages/tools`

Use these for tenant identity, authorization, signed execution context, secret leases, tool policy, idempotency, and audit integration.

### Governance and policy

- `packages/policy`
- `packages/policy-as-code`
- `packages/governance`
- `packages/approvals`

Do not duplicate these concepts inside TDI.

### Execution and lifecycle

- `packages/sandbox`
- `packages/runs`
- `packages/queue`
- `packages/worker`
- `packages/test-runner`

TDI uses adapters/contracts here. The current sandbox and executor implementations include simulation/prototype behavior and must not be represented as proof of a real container boundary.

### Repository and GitHub

- `packages/repository`
- `packages/github`

The current `SnapshotService` and GitHub app client contain simulated/in-memory behavior. The TDI implementation therefore adds a real commit/tree/blob provider behind an injectable interface instead of assuming those prototypes are immutable source storage.

### Evidence and artifacts

- `packages/artifacts`
- `packages/observability`
- `packages/analytics`
- `packages/performance`

These supply provenance, logging, operational context and future metrics integration.

### AI

- `packages/llm-workbench`
- existing AJV/Zod schema infrastructure

AI integration is deliberately deferred until verified Evidence is available.

## External tool reuse map

### Tier A

1. CodeQL 2.27.1 — semantic security/static analysis — SARIF.
2. Semgrep 1.179.0 — pattern security/correctness/maintainability — SARIF.
3. OSV-Scanner 2.6.0 — dependency vulnerabilities — SARIF.
4. Trivy 0.74.0 — vulnerabilities/misconfigurations/secrets/supply chain — SARIF.
5. actionlint 1.7.12 — GitHub Actions correctness — JSON.
6. dependency-cruiser 18.1.0 — dependency architecture — JSON.
7. Knip 6.31.0 — unused code/dependencies/exports — JSON.

### Tier B

8. OpenSSF Scorecard 5.5.0 — repository/supply-chain posture — JSON.
9. Syft 1.54.0 — SBOM — SPDX JSON.
10. Gitleaks 8.30.1 — secret detection — redacted JSON.

### Benchmark

SonarQube may be used as comparative maintainability/technical-debt evidence, never as Eagle policy authority.

## Evidence trust boundary

For every external tool result:

- validate format/schema;
- bind to tenant/workspace/repository/commit;
- record tool and version;
- record configuration/rule-set/database identity;
- compute exact raw-output digest;
- compute normalized evidence digest;
- preserve location/rule identifiers when available;
- redact secrets before persistence;
- fail closed on provenance or integrity mismatch.

Tool severity remains an observation until deterministic PolicyFacts classify it as trusted.

## Reproducibility

Source evidence is reproducible when the exact commit/tree/blob is pinned.

Tool evidence targets equivalence for:

```text
same commit
+ same tool version
+ same configuration
+ same rule/query set
+ same relevant database snapshot
```

Runtime timestamps are metadata only.

Operational CI evidence is explicitly time-varying and must be treated as observed state rather than immutable source proof.

## Implemented TDI modules

### Contracts

`packages/intelligence/src/technical-debt/contracts/`

- evidence
- finding
- debt-record
- decision

### Deterministic policy

`packages/intelligence/src/technical-debt/scorer/`

- scoring policy v1.0
- deterministic debt metrics

`packages/intelligence/src/technical-debt/policy/`

- PolicyFacts
- deterministic Debt Gate
- policy version v1.1

### Evidence

`packages/intelligence/src/technical-debt/collector/`

- canonical JSON
- SHA-256 digest helpers
- deterministic evidence IDs
- SARIF normalization
- specialized JSON/SBOM normalization
- external tool registry
- adapter registry
- repository evidence
- git history evidence
- CI evidence
- test-runner evidence
- sandbox execution adapter
- scan orchestrator

### Pinned source

`packages/intelligence/src/technical-debt/source/`

- GitHub commit verification
- recursive tree verification
- fail-closed truncated tree handling
- blob SHA verification
- UTF-8 validation
- exact content SHA-256

## Security hardening performed in branch

### Audit

`packages/audit/src/hash-chain.ts`

The hash-chain implementation uses actual SHA-256 and covers event identity, tenant/workspace scope, previous-link, payload hash, sequence and operational metadata in the event fingerprint.

### Execution context

`packages/security/src/context-signer.ts`

Execution context signing uses:

- HMAC-SHA256;
- timing-safe signature comparison;
- cryptographically random nonces;
- mandatory externally supplied secret of sufficient length.

### Sandbox allowlist

Approved TDI analyzer executables are registered in the sandbox allowlist. Unknown executables remain rejected.

### CI

The root scripts now include:

- `typecheck`
- `lint`
- `test`
- `test:security`
- `tdi:verify-live`

CI uses Bun 1.4.2 and the repository's existing lockfile.

## Database hardening

`db/migrations/022_technical_debt.sql`

Creates TDI scans, evidence, findings, debt records and decisions with tenant isolation.

`db/migrations/023_tdi_evidence_relationships.sql`

Adds:

- scan identity constraints;
- evidence-to-scan composite FK;
- unique evidence keys;
- finding-to-evidence junction table;
- debt-to-evidence junction table;
- RLS + FORCE RLS on junction tables;
- decision fingerprint validation.

Legacy evidence ID arrays are transitional and not the authoritative new relationship.

## CI/live verification

### Standard CI

`.github/workflows/ci.yml`

Validates typecheck, lint, unit/security tests and PostgreSQL service startup for `main` and `tdi-v1-foundation`.

### External tool verification

`.github/workflows/tdi-external-tools.yml`

Runs the selected analyzers against the exact `github.sha` checkout, writes raw results, then runs:

`bun run tdi:verify-live`

which invokes the same TDI normalizers used by the application boundary.

Raw and normalized results are retained as Actions artifacts.

## Verification status

### Proven by code review / test fixtures

- deterministic hashes;
- deterministic evidence IDs;
- evidence contract validation;
- AI authority separation;
- PolicyFacts blocking boundary;
- repository snapshot normalization;
- pinned commit/tree/blob behavior;
- tool adapter schema handling;
- Gitleaks redaction;
- sandbox source-scope checks;
- Bun Test Runner detection;
- audit tamper detection.

### Verified in GitHub Actions environment

- GitHub checkout of exact commit;
- Bun 1.4.2 installation;
- frozen lockfile dependency installation;
- CodeQL Action setup has started successfully on the live tool workflow;
- previous CI failures were resolved iteratively when actual TypeScript errors were exposed.

### Not yet claimed

- Full successful live tool matrix for the latest branch head;
- real production container execution;
- PostgreSQL application of migrations;
- main branch protection;
- production secret provisioning;
- final production-gate acceptance.

## Documentation set

- `docs/architecture/tdi-external-tooling-strategy.md`
- `docs/architecture/tdi-project-coverage.md`
- `docs/architecture/tdi-implementation-ledger.md`
- `docs/architecture/tdi-tool-manifest.json`
- this file: `docs/architecture/tdi-master-index.md`

The four documents together are the authoritative design/implementation record for the TDI work performed on this branch.
