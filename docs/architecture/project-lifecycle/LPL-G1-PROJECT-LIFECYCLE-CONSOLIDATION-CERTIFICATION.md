# LPL-G1 | Project Lifecycle Consolidation Certification

**Gate Status:** PASS / CERTIFIED
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Certified Implementation:** LPL-1 | COMPLETE / VERIFIED
**Predecessor Gate:** LRC-G1 | PASS / CERTIFIED
**Current downstream consumer boundary:** COL-0 | COMPLETE / VERIFIED

## 1. Certification statement

LPL-G1 certifies the following invariant:

> Project load/deserialization and project JSON/asset/archive serialization have one NGVGE Host-owned
> lifecycle authority. Legacy callers may use compatibility VM facades, but no subsystem may replace those
> facades or create a second project-lifecycle writer. Lifecycle participants extend the Host through
> deterministic hooks, and Scratch remains a replaceable project backend.

This gate certifies the LPL-1 contract. It does not promote LPL-1 to a new Schema version and does not
claim that every legacy project-storage product workflow has already been redesigned.

## 2. Certified stable identities

```text
Host        ngvge.project-lifecycle-host@1
Client      ngvge.project-lifecycle-client@1
Domain      ngvge.project.lifecycle
Writer      authority:ngvge.project-lifecycle-host
```

Only the Project Lifecycle Host may assign the compatibility facades for:

```text
vm.loadProject
vm.deserializeProject
vm.toJSON
vm.serializeAssets
vm.saveProjectSb3
vm.saveProjectSb3DontZip
```

The runtime-visible surface remains diagnostics-only.

## 3. Root transaction certification

### Load

A real Scratch `vm.loadProject()` was executed through the installed Host.

```text
load (root)
  └─ deserialize (nested)
```

The nested deserialize operation inherits the root operation id/kind and one successful root load increments
`projectGeneration` exactly once.

A failed root load:

- returns lifecycle state to `idle`;
- records one failed lifecycle operation;
- does not increment `projectGeneration`;
- propagates the backend failure fail-visibly.

### File serialization

A real `vm.saveProjectSb3DontZip()` was certified as:

```text
serialize-files (root)
  ├─ serialize-json   (nested)
  └─ serialize-assets (nested)
```

### Archive serialization

A real `vm.saveProjectSb3()` was certified as:

```text
serialize-archive (root)
  ├─ serialize-json   (nested)
  └─ serialize-assets (nested)
```

Neither serialization path mutates project generation.

## 4. Hook and API semantics

Lifecycle hooks are deterministic by priority and stable id rather than wrapper installation order.

Synchronous lifecycle APIs remain synchronous. If a synchronous serialization hook returns a Promise, the
Host fails visibly with `PROJECT_LIFECYCLE_ASYNC_SYNC_HOOK`; it does not silently convert the Scratch API
contract into an asynchronous one.

The Host can execute against an injected project backend without exposing that backend or VM handle through
its public surface. This is the certified backend-replacement seam required by ARC-0001.

## 5. Certified consumers

The following systems are certified as lifecycle consumers rather than lifecycle authorities:

- Project Persistence — project metadata transform/restore hooks;
- Global Asset Database — project reset and `serializeAssets` hook;
- Node Database — project reset hook;
- First-party Module Framework — project reset hook;
- VM Project I/O / Scene portable snapshot — Host deserialize/file serialization;
- COL-0 project synchronization — Host `loadProject` path;
- legacy GUI/Git/Restore callers — compatibility facade consumers only.

The important distinction is:

```text
calling vm.loadProject()
!=
owning/replacing vm.loadProject
```

## 6. Machine certification

`node scripts/validate-lpl-g1-project-lifecycle-consolidation-certification.js`

Result:

```text
17 / 17 PASS
```

Focused E2E:

```text
1 suite / 9 tests PASS
```

Production-module Webpack entry:

```text
entry: src/lib/project-lifecycle/index.js
webpack config: webpack.config.js[0]
exit: 0
errors: 0
warnings: 0
```

## 7. Cumulative evidence

- LPL-1 Machine DoD — 13/13 PASS;
- LPL-1 focused — 6 suites / 32 tests PASS;
- LRC-G1 — 15/15 PASS + 9/9 E2E PASS;
- LEX-1 — 14/14 PASS + 4 suites / 9 tests PASS;
- COL-0 — 15/15 PASS + 4 suites / 12 tests PASS;
- ARC-C001.1 — 7/7 PASS;
- 0009-E — 12/12 PASS;
- Permanent Regression — 19/19 PASS;
- Unit / Node — 99 suites / 526 tests PASS;
- Unit / DOM — 3 suites / 26 tests PASS;
- Unit total — 102 suites / 552 tests PASS;
- Integration — 4 suites / 5 tests PASS;
- Smoke — 1 suite / 1 test PASS;
- RE-3 through RE-5 — PASS;
- WS-0 through WS-2 — PASS;
- LSC-0 — 2 suites / 5 tests PASS;
- TypeScript — PASS;
- ESLint correctness — PASS.

`npm run test:project-lifecycle:lpl-g1` was also executed through its final correctness-lint stage with all
constituent commands passing. The surrounding tool connection did not retain the final npm wrapper exit
code, so the certificate does not fabricate an aggregate `exit 0`; certification relies on the explicit
constituent exit results above plus the focused and Webpack gates, both of which returned exit 0.

## 8. Governance result

```text
LPL-1
COMPLETE / VERIFIED
        ↓
LPL-G1
PASS / CERTIFIED
```

LPL-G1 does not declare a new Architecture Frozen schema. It certifies the single-Host Project Lifecycle
invariant. Any future change which adds another lifecycle facade assignment owner, exposes lifecycle mutation
on the runtime diagnostics facade, changes root/nested transaction semantics, or lets a backend/library own
NGVGE lifecycle identity must fail this gate or be accompanied by an explicit architecture/version decision.
