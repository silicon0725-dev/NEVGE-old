# ARC-C001.0-A｜Architecture Repository Baseline

## Decision

**Status: COMPLETE / BASELINE ESTABLISHED**

C001.0-A formalizes the architecture repository on top of the R10 Architecture Frozen source. This phase changes governance/documentation only and makes no Runtime or product behavior changes.

## Baseline inputs

- ARC Master Plan v1.0, prepared 2026-08-05;
- R10 Final Freeze Certification for NGVGE 0008.9.7 + Scene System V2.1;
- R10 Known Debt Register and Freeze Certificate.

## Files established

```text
docs/architecture/
├── ARC-0001-kernel-independence-contract.md
├── ARC-MASTER-PLAN.md
├── ARC-INDEX.md
├── ARC-STATUS-MATRIX.md
├── ARC-STATUS-MATRIX.json
├── ARC-C001.0-A-ARCHITECTURE-REPOSITORY-BASELINE.md
└── conformance/
    ├── README.md
    └── ARC-C001-arc-0001-conformance-suite.md
```

## Status transitions recorded

```text
0008 Runtime Scene Graph:
Active → Completed / Architecture Frozen

ARC-0001:
Architecture Frozen (principle) → Formal Freeze Complete / Enforced Authority

ARC-C001:
Approved / Planned / Deferred → Approved / Active

Current execution:
ARC-C001.0-A Architecture Repository Baseline

0009 Transform System:
remains BLOCKED until ARC-C001.1 minimum gates
```

## Scope intentionally deferred

C001.0-A does not:

- migrate or rewrite existing `0008.x` architecture validators;
- classify existing validators into ARC-C001 domains;
- create legacy waivers;
- create `src/core`;
- introduce Stable Identity branded types;
- implement Persistent DTO validation;
- implement Authority or Schema registries;
- activate Blocking CI.

Those belong to C001.0-B/C/D and C001.1+.

## Architecture isolation requirement

The phase is accepted only if:

```text
src/                         unchanged
package.json                 unchanged
bun.lock                     unchanged
webpack.config.js            unchanged
tsconfig.02agent.json        unchanged
.nvmrc                       unchanged
.github/workflows/           unchanged
```

The only repository additions are under `docs/architecture/`.

## Verification evidence

Final C001.0-A verification:

```text
R10 pre-existing files unchanged: 3498 / 3498 SHA-256 PASS
Architecture repository additions: 8 files
ARC status matrix JSON: PASS
ARC-0001 required metadata: PASS
ARC-C001 required metadata: PASS
Master Plan v1.1 execution state: PASS
Premature src/core creation: NONE
Premature conformance domain specs: NONE
Patch round-trip against clean R10: 8 / 8 byte-identical PASS
```

Because no pre-existing source/tooling/configuration file changed, R10 correctness and architecture evidence remains the runtime authority for this documentation-only phase. C001.0-A does not re-certify release reproducibility and does not alter the existing external CI evidence hold.

## Next phase

**ARC-C001.0-B｜Existing Gate Inventory**

C001.0-B should map existing R1–R10 / 0008.x validators and permanent regression contracts to ARC-0001 domains without moving or rewriting them first.
