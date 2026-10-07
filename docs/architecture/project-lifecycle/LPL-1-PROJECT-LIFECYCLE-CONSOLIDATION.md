# LPL-1 | Project Lifecycle Consolidation

**Status:** COMPLETE / VERIFIED
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Predecessor Gate:** LRC-G1 | Runtime Policy Containment Certification — PASS / CERTIFIED
**Implementation Identity:** `ngvge.project-lifecycle-host@1`

## 1. Problem

Before LPL-1, project lifecycle behavior was implemented as a stack of independent Scratch VM monkey patches.
Multiple subsystems replaced `vm.loadProject()`, while other subsystems independently replaced
`vm.toJSON()`, `vm.deserializeProject()` and `vm.serializeAssets()`.

The important legacy writers were:

- Project Persistence;
- Global Asset Database;
- Node Database;
- First-party Module Framework;
- Collaboration;
- VM Project I/O / Scene portable snapshot transport.

This produced implicit wrapper ordering and made project lifecycle semantics depend on installation order.
It also made a future Scratch replacement difficult because NGVGE project lifecycle behavior was attached
straight to mutable Scratch VM methods.

## 2. Frozen LPL-1 ownership model

LPL-1 establishes one Host-owned lifecycle seam:

```text
Legacy / Compatibility callers
vm.loadProject / vm.deserializeProject
vm.toJSON / vm.serializeAssets
vm.saveProjectSb3 / vm.saveProjectSb3DontZip
              |
              v
ngvge.project-lifecycle-host@1
              |
              +-- Project Lifecycle Writer Authority
              |   domain: ngvge.project.lifecycle
              |   writer: authority:ngvge.project-lifecycle-host
              |
              +-- deterministic lifecycle hooks
              |
              v
Scratch Project Lifecycle Backend
```

Scratch VM remains the current backend implementation. It no longer owns the NGVGE lifecycle contract.

## 3. Stable identities

```text
Host          ngvge.project-lifecycle-host@1
Client        ngvge.project-lifecycle-client@1
State Domain  ngvge.project.lifecycle
Writer        authority:ngvge.project-lifecycle-host
```

The runtime-visible facade is diagnostics-only. It exposes lifecycle identity/state, but not mutation
methods, Scratch VM references, renderer handles or backend objects.

## 4. Host lifecycle operations

The Host owns the compatibility facade for:

```text
loadProject
 deserializeProject
 serializeProjectJSON / vm.toJSON
 serializeAssets
 saveProjectSb3
 saveProjectSb3DontZip
```

A root `loadProject` transaction keeps the nested Scratch `deserializeProject` operation under the same
root lifecycle identity. Archive/file serialization likewise keeps nested JSON/asset serialization under
the same root serialization operation.

Synchronous serialization paths reject asynchronous hooks fail-visibly rather than silently changing the
Scratch synchronous API contract.

## 5. Former VM wrappers converted to hooks

### Global Asset Database

`ngvge.project-lifecycle.global-assets@1`

- resets project-scoped asset state before load;
- extends `serializeAssets` after backend serialization;
- no longer replaces `vm.loadProject` or `vm.serializeAssets`.

### Node Database

`ngvge.project-lifecycle.node-database@1`

- resets semantic project nodes before load;
- no longer replaces `vm.loadProject`.

### First-party Module Framework

`ngvge.project-lifecycle.first-party-modules@1`

- resets project-scoped module state before load;
- no longer replaces `vm.loadProject`.

### Project Persistence

`ngvge.project-lifecycle.project-persistence@1`

- injects NGVGE project metadata through `afterSerializeProjectJSON`;
- captures NGVGE metadata through `beforeDeserialize`;
- restores metadata after deserialize/load completion;
- no longer replaces `vm.toJSON`, `vm.deserializeProject` or `vm.loadProject`.

### Collaboration

`ngvge.project-lifecycle.collaboration@1`

- observes load start/progress/completion/failure;
- keeps synchronization UX behavior;
- no longer owns a second `vm.loadProject` wrapper.

## 6. VM Project I/O / Scene transport

`vm-project-io-service` now consumes the Project Lifecycle Host when a real VM runtime is available.
Portable Scene snapshot capture uses Host-owned `saveProjectSb3DontZip`; restore uses Host-owned
deserialization. Cross-realm binary normalization remains at the Host/service boundary.

The no-runtime fallback remains only for isolated transport tests and non-production compatibility use.

## 7. Legacy callers

LPL-1 intentionally does not rewrite every existing GUI/Git/Restore Point/Collaboration caller in one step.
Calls such as `vm.loadProject()` or `vm.saveProjectSb3()` remain valid compatibility entry points, but they
now resolve to the Host facade installed at application bootstrap.

The important invariant is:

> Existing callers may use the compatibility facade; only Project Lifecycle Host may assign/replace the
> lifecycle facade methods.

The LPL-1 machine validator scans production source and confirms there is no second assignment owner.

## 8. ARC-0001 conformance

LPL-1 preserves the Kernel Independence Contract:

- NGVGE owns Project Lifecycle identity and Writer Authority;
- Scratch owns only backend execution/serialization implementation;
- lifecycle hooks do not persist Scratch Target, renderer or backend handles;
- Project Persistence, Nodes, Assets, Modules and Collaboration consume a Host seam instead of owning it;
- Runtime Policy v1 and LRC-G1 semantics remain unchanged.

## 9. Verification status

LPL-1 is accepted as **COMPLETE / VERIFIED** based on:

- LPL-1 Machine DoD: 13/13 PASS;
- LPL-1 focused: 6 suites / 32 tests PASS;
- real Scratch VM lifecycle integration PASS;
- LRC-G1 certification PASS;
- 0009-E 12/12 PASS;
- Permanent Regression 19/19 PASS;
- Unit: 94 suites / 526 tests PASS;
- Integration: 4 suites / 5 tests PASS;
- Smoke: 1/1 PASS;
- TypeScript PASS;
- ESLint correctness PASS;
- RE-3 -> RE-5, WS-0 -> WS-2 and LSC-0 PASS;
- real Editor Webpack entry: exit 0, 0 errors, 0 warnings.

## 10. Explicit non-goals

LPL-1 does not:

- replace Scratch project format;
- redesign cloud/server project storage;
- redesign Git history semantics;
- define collaboration CRDT semantics;
- remove all compatibility calls to `vm.*`;
- grant lifecycle mutation authority to modules or runtime observers.

Those systems must consume this lifecycle seam in later stages rather than create a competing lifecycle.
