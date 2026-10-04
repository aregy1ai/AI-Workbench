# TDI External Tooling Strategy

Status: Proposed / Phase 2 planning
Branch: `tdi-v1-foundation`
Scope: Technical Debt Intelligence (TDI)

## Decision

TDI should reuse mature, externally maintained analysis engines rather than implement duplicate static-analysis, dependency-analysis, SBOM, or secret-scanning engines.

Eagle/TDI remains responsible for:

1. immutable source/commit attribution;
2. tool execution isolation;
3. evidence normalization;
4. evidence integrity and provenance;
5. deterministic PolicyFacts;
6. deterministic scoring;
7. PASS / REVIEW / BLOCK authority;
8. auditability and reproducibility.

External tools provide evidence only. They never receive authority to issue Eagle decisions.

## Evidence pipeline

```text
Pinned commit / trusted source
        |
        v
Execution Sandbox
        |
        +--> CodeQL
        +--> Semgrep
        +--> OSV-Scanner
        +--> Trivy
        +--> actionlint
        +--> dependency-cruiser
        +--> Knip
        +--> Scorecard
        +--> Syft
        +--> Gitleaks
        |
        v
SARIF / JSON / SBOM / tool-native output
        |
        v
TDI Evidence Normalizer
        |
        v
Verified Evidence
        |
        v
PolicyFacts
        |
        v
Deterministic Scorer
        |
        v
Debt Gate
        |
        +--> PASS
        +--> REVIEW
        +--> BLOCK
```

## Tier A — first integration targets

### CodeQL

Purpose: semantic static analysis and security findings.

Integration contract: CodeQL CLI output in SARIF 2.1.0.

Why: mature semantic analysis, query packs, and a standard machine-readable result format.

Reference:
https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-cli

### Semgrep

Purpose: custom security, correctness, and maintainability patterns.

Integration contract: JSON/SARIF adapter.

Important: Semgrep findings are evidence; their severity must not directly become Eagle authority.

### OSV-Scanner

Purpose: dependency vulnerability evidence.

The project officially supports resolved JavaScript lockfiles including `bun.lock` and `pnpm-lock.yaml`.

Reference:
https://google.github.io/osv-scanner/supported-languages-and-lockfiles/

### Trivy

Purpose: broad vulnerability, misconfiguration, secret, license, and SBOM-related evidence.

Trivy can emit SARIF 2.1.0 and can generate/consume SPDX and CycloneDX SBOM formats.

Reference:
https://trivy.dev/docs/latest/guide/configuration/reporting/
https://trivy.dev/docs/dev/docs/supply-chain/sbom/

### actionlint

Purpose: GitHub Actions workflow validation.

Use as a CI/workflow evidence provider. It should not become a direct Eagle decision authority.

### dependency-cruiser

Purpose: architectural dependency evidence.

Useful rules include circular dependencies, orphan modules, unresolved dependencies, dependency declarations, and production code depending on development-only dependencies.

Reference:
https://github.com/sverweij/dependency-cruiser

## Tier B — additional evidence

### Knip

Purpose: unused files, exports, dependencies, and packages.

Use for maintainability/dead-code evidence.

### OpenSSF Scorecard

Purpose: repository and supply-chain security posture.

Use as contextual evidence, not as a direct BLOCK signal.

### Syft

Purpose: SBOM generation.

Preferred outputs: SPDX or CycloneDX.

Use when supply-chain inventory becomes a required TDI input.

### Gitleaks

Purpose: secret detection, including history-aware scanning where appropriate.

Use as security evidence. Do not expose detected secret material in evidence payloads.

## Optional benchmark

### SonarQube

SonarQube provides an established maintainability/technical-debt model and remediation-cost concepts.

TDI should treat Sonar results as one evidence source rather than delegating policy authority to Sonar.

## Why Eagle must not implement these engines itself

Implementing custom SAST, dependency vulnerability databases, SBOM generation, secret scanning, and architecture analysis would duplicate mature ecosystems and create a large maintenance/security burden.

The TDI value is the layer above them:

```text
Many specialized analyzers
          |
          v
Common Evidence Contract
          |
          v
Trusted deterministic facts
          |
          v
Versioned Eagle policy
          |
          v
Reproducible decision
```

## Normalization rule

Every adapter must preserve:

- tenantId
- workspaceId
- repositoryId
- commitSha
- tool name
- tool version
- invocation/config digest
- source/result digest
- path and location where available
- rule/check identifier
- original severity
- evidence collection timestamp
- raw result reference when retained

Tool timestamps and runtime-specific metadata must not participate in deterministic identity unless explicitly required by the evidence type.

## Trust boundary

External tool output is untrusted input.

The adapter must:

1. validate the output schema;
2. bind it to the exact scanned commit;
3. calculate a real SHA-256 digest;
4. reject mismatched repository/tenant/commit attribution;
5. preserve provenance;
6. normalize severity without granting decision authority;
7. fail closed when provenance or integrity cannot be verified.

## Reproducibility

A scan is reproducible when:

```text
same commit
+ same tool version
+ same tool configuration
+ same rule/query set
+ same dependency database snapshot where applicable
= equivalent evidence
```

Therefore the scan record should capture tool versions, configuration/rule-set identifiers, and relevant database/cache versions.

## Phase 2 execution order

1. Harden the existing TDI contracts and Evidence↔Scan relationships.
2. Establish a real pinned-source provider.
3. Implement a generic Tool Adapter interface.
4. Integrate CodeQL and Semgrep.
5. Integrate OSV-Scanner.
6. Integrate Trivy.
7. Integrate actionlint.
8. Integrate dependency-cruiser and Knip.
9. Add Scorecard/Syft/Gitleaks where justified.
10. Build the TDI normalizer.
11. Add reproducibility and provenance tests.
12. Connect normalized evidence to PolicyFacts.
13. Only then introduce an AI analyzer.

## Explicit non-goals

- No custom SAST engine.
- No custom vulnerability database.
- No direct AI-to-BLOCK path.
- No working-tree evidence for pinned scans.
- No `execSync('git ...')` as the source of truth.
- No remediation agent in TDI v1.
- No production Gate claim until Phase 0 security blockers are resolved.

## Sources

- GitHub CodeQL CLI: https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-cli
- GitHub SARIF: https://docs.github.com/en/code-security/concepts/code-scanning/sarif-files
- OSV-Scanner supported lockfiles: https://google.github.io/osv-scanner/supported-languages-and-lockfiles/
- Trivy reporting: https://trivy.dev/docs/latest/guide/configuration/reporting/
- Trivy SBOM: https://trivy.dev/docs/dev/docs/supply-chain/sbom/
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
