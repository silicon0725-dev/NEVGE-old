# ARC-C001.0-B Existing Gate Inventory

**Schema:** `ngvge-arc-c001-existing-gate-inventory/v1`
**Baseline:** NGVGE 0008.9.7 + Scene System V2.1 + ARC-C001.0-A
**Phase:** ARC-C001.0-B
**Updated:** 2026-08-10

## Purpose

This inventory answers one question: **what ARC-0001 conformance behavior already exists in the frozen 0008 codebase, and how authoritative is it today?**

C001.0-B does not migrate tests, create `src/core`, add new validators, or change Runtime behavior. It classifies existing executable assets so C001.1 can reuse semantics instead of duplicating them.

## Executive findings

- `package.json` exposes **12** `test:architecture:*` entrypoints.
- Those entrypoints reference **27 unique active architecture validators**.
- **3 historical validators** remain in the repository but are not wired into the active architecture entrypoints.
- The permanent regression layer contains **6 contracts**; **5** have direct ARC-0001 value.
- **No `test:architecture:*` entrypoint is called by the aggregate `test` script or the current Node CI workflow.** Therefore these validators are executable evidence, but not yet Blocking Conformance authority.
- Every ARC-C001 domain has meaningful 0008 evidence, but every domain remains `partial` because the coverage is subsystem/task-specific rather than generic repository-wide enforcement.

## Execution authority

| Layer | Exists | Aggregate `test` | CI workflow | Blocking today |
|---|---:|---:|---:|---:|
| `test:architecture:*` entrypoints | 12 | No | No | No |
| Permanent regression contracts | 6 | Yes | Yes | Yes |
| Smoke | 1 suite | Yes | Yes | Yes |
| Integration | 3 suites | Yes | Yes | Yes |
| Correctness lint | Yes | Yes | Yes | Yes |
| Scoped typecheck | Yes | Yes | Yes | Yes |

**C001 consequence:** C001.1 must not merely rename the existing `test:architecture:*` scripts. It must decide which invariants are promoted into durable conformance domains and eventually wire them into an explicit conformance execution path.

## Active architecture entrypoints

| Entrypoint | Validator count | ARC domains | Current authority |
|---|---:|---|---|
| `test:architecture:runtime-node-boundary` | 2 | identity, protocol, serialization, compatibility | Manual/invokable; not aggregate/CI |
| `test:architecture:runtime-node-lifecycle` | 5 | authority, protocol, lifecycle, serialization, compatibility | Manual/invokable; not aggregate/CI |
| `test:architecture:runtime-component-boundary` | 18 | identity, schema, authority, protocol, lifecycle, serialization | Manual/invokable; not aggregate/CI |
| `test:architecture:module-deferred-authority-service-lifetime` | 1 | authority, protocol, lifecycle | Manual/invokable; not aggregate/CI |
| `test:architecture:cross-boundary-exception-authority` | 1 | authority, protocol | Manual/invokable; not aggregate/CI |
| `test:architecture:runtime-error-contract` | 1 | protocol, serialization | Manual/invokable; not aggregate/CI |
| `test:architecture:runtime-snapshot-contract` | 3 | identity, schema, authority, protocol | Manual/invokable; not aggregate/CI |
| `test:architecture:module-bootstrap-integrity` | 1 | lifecycle, compatibility | Manual/invokable; not aggregate/CI |
| `test:architecture:module-bootstrap-recovery` | 1 | authority, protocol, lifecycle | Manual/invokable; not aggregate/CI |
| `test:architecture:module-capability-publication` | 1 | authority, protocol, lifecycle | Manual/invokable; not aggregate/CI |
| `test:architecture:runtime-mutation-commit` | 1 | authority, protocol, lifecycle, serialization | Manual/invokable; not aggregate/CI |
| `test:architecture:service-facade-array-callback-locality` | 1 | authority, protocol | Manual/invokable; not aggregate/CI |

### Unique active validator assets

| Validator | Primary | Secondary | Reuse assessment |
|---|---|---|---|
| `scripts/check-runtime-node-public-boundary.js` | protocol | compatibility | Rejects legacy first-party Runtime Node aliases outside compatibility-owned surfaces. |
| `scripts/validate-ngvge-module-bootstrap-integrity.js` | lifecycle | compatibility | Verifies import-safe lifecycle constants and registered/default module bootstrap state. |
| `scripts/validate-ngvge-module-bootstrap-recovery.js` | lifecycle, authority | protocol | Verifies failed initialize/enable/registration recovery without stale capability authority. |
| `scripts/validate-ngvge-module-capability-publication.js` | authority, lifecycle | protocol | Restricts capability publication to the authorized hook frame and current registration generation. |
| `scripts/validate-ngvge-service-facade-array-callback-locality.js` | protocol, authority | — | Keeps consumer callbacks local while retained facade methods remain provider-generation revocable. |
| `scripts/validate-ngvge-task-0008.9.1.1.js` | protocol, serialization | identity | Freezes exact portable Runtime Node capability surface, portable args/results and structured mutation results. |
| `scripts/validate-ngvge-task-0008.9.2.js` | lifecycle | protocol, serialization | Validates Runtime Node/Component lifecycle ordering, scene activation, error isolation, portable events and restore derivation. |
| `scripts/validate-ngvge-task-0008.9.2.1.js` | lifecycle, authority | protocol | Validates lifecycle reentrancy and runtime generation closure against stale mutations. |
| `scripts/validate-ngvge-task-0008.9.2.2.js` | lifecycle, protocol | authority | Closes observation/reentrant lifecycle mutation boundaries. |
| `scripts/validate-ngvge-task-0008.9.2.2.1.js` | lifecycle, authority | — | Rejects forbidden local-host disposal before cleanup side effects. |
| `scripts/validate-ngvge-task-0008.9.3.js` | identity, schema | serialization, lifecycle | Freezes component identity/schema/ownership persistence and detached snapshot rules. |
| `scripts/validate-ngvge-task-0008.9.3.1.js` | identity, schema, serialization | authority | Closes component identity/cardinality/persistence semantics and portable references. |
| `scripts/validate-ngvge-task-0008.9.3.1.1.js` | schema, authority | serialization | Validates component cardinality authority transitions before commit/persistence. |
| `scripts/validate-ngvge-task-0008.9.3.1.2.js` | schema, authority | — | Protects component registry binding ownership from conflicts/stale bindings. |
| `scripts/validate-ngvge-task-0008.9.4.js` | schema, authority | serialization | Validates component schema versions, migration graph authority and persistent representation. |
| `scripts/validate-ngvge-task-0008.9.4.1.js` | schema, lifecycle, authority | — | Isolates migration bootstrap/execution to valid lifecycle and registry authority. |
| `scripts/validate-ngvge-task-0008.9.4.1.1.js` | authority, lifecycle | schema | Prevents failed module enable batches from leaking partial registry/capability state. |
| `scripts/validate-ngvge-task-0008.9.4.1.2.js` | lifecycle, authority | protocol | Validates completion reentrancy and observer failure isolation. |
| `scripts/validate-ngvge-task-0008.9.4.1.3.js` | lifecycle, authority | — | Rejects module lifecycle mutation outside authorized execution phases. |
| `scripts/validate-ngvge-task-0008.9.4.1.4.js` | authority, protocol | lifecycle | Separates host/client authority surfaces and blocks retained host mutable authority. |
| `scripts/validate-ngvge-task-0008.9.4.1.5.js` | authority, lifecycle | protocol | Revokes deferred/stale service access across module generations/provider lifetime. |
| `scripts/validate-ngvge-task-0008.9.4.1.6.js` | protocol, authority | — | Sanitizes cross-boundary exceptions without leaking thrown objects, handles or authority tokens. |
| `scripts/validate-ngvge-task-0008.9.5.js` | protocol, serialization | — | Freezes portable Runtime Error public records and excludes stack/cause/raw thrown values. |
| `scripts/validate-ngvge-task-0008.9.6.js` | protocol, authority | identity | Defines revision identity, frozen snapshot envelopes, canonical ordering and mixed-revision rejection. |
| `scripts/validate-ngvge-task-0008.9.6.1.js` | protocol, authority | identity | Protects revision authority and canonical snapshot semantics from forgery. |
| `scripts/validate-ngvge-task-0008.9.6.1.1.js` | authority, protocol | schema | Protects internal dispatch/provider graph and private registry/listener authority. |
| `scripts/validate-ngvge-task-0008.9.7.js` | authority, protocol | serialization, lifecycle | Enforces single-command prepare/commit semantics with no partial state/events on persistence failure. |

## Historical validators that are not current gate authority

These files remain useful evidence, but **file existence is not equivalent to active conformance**.

| Validator | ARC domains | Assessment |
|---|---|---|
| `scripts/validate-ngvge-task-0008.7.3.js` | compatibility, identity, serialization, lifecycle | Scratch Adapter boundary: stable NodeId/BindingId vs volatile target.id, scene scope, migration and no targetRuntimeId persistence. |
| `scripts/validate-ngvge-task-0008.8.js` | serialization, compatibility, schema, identity | Scene Graph persistence review: plain-data validation, future-version protection and Scratch binding persistence. |
| `scripts/validate-ngvge-task-0008.9.1.js` | protocol, identity, serialization | Original Runtime Node API Freeze, superseded by 0008.9.1.1. |

Key conclusion:

- `0008.7.3` is a strong candidate for promotion into the future Scratch Adapter Boundary Gate.
- `0008.8` contains the strongest existing Persistent Data baseline, but it must be extracted from task-specific wiring.
- `0008.9.1` is historical API-freeze evidence and is superseded by `0008.9.1.1` for current public-boundary semantics.

## Permanent regression contracts

| Contract | ARC value | Domains | Assessment |
|---|---|---|---|
| `runtime-detached-persistence` | direct | identity, serialization | Detached roots/subtrees persist canonically and restore with stable IDs. |
| `git-myers-diff` | supporting-correctness | — | Algorithm correctness regression; not itself an ARC-0001 invariant. |
| `git-sb3-reconstruction` | direct | compatibility, serialization | Git working-tree reconstruction preserves Scratch graph/assets and fails closed. |
| `scene-binary-asset-boundary` | direct | compatibility, protocol, serialization | Scratch binary assets cross Scene module boundary only as Base64 strings. |
| `scene-v2-boundary` | direct | protocol, lifecycle, authority, compatibility | Scene V2 uses primitive JSON controller protocol and safe module disable without UI-held legacy facades. |
| `scene-v2-scope-navigation` | direct | identity, protocol, compatibility, lifecycle | Protects scene scope projection, explicit Enter Scene navigation and local runtime-tree indexing. |

`git-myers-diff` is intentionally **not** reclassified as ARC conformance. It remains a valuable product correctness regression without a direct ARC-0001 invariant.

## Supporting CI evidence

| Gate | Type | ARC relationship | Domains |
|---|---|---|---|
| `test:smoke` | smoke | supporting | lifecycle, compatibility |
| `runtime-project-persistence.integration` | integration | direct-supporting | identity, serialization |
| `git-sb3-vm-load.integration` | integration | direct-supporting | compatibility, serialization |
| `scene-v2-lifecycle.integration` | integration | direct-supporting | lifecycle, protocol, compatibility, serialization |
| `test:lint` | infrastructure | supporting-correctness | — |
| `test:typecheck` | infrastructure | supporting-correctness | — |
| `test:ci-contract` | infrastructure | governance-support | — |
| `test:gate-contract` | infrastructure | governance-support | — |

Supporting tests may supply destructive scenarios or integration evidence to ARC-C001, but they must not be relabeled as architecture gates merely because they pass.

## ARC-0001 domain coverage

### Identity — `partial`

**Existing strengths**
- Stable Runtime Node/Component IDs survive persistence and restore.
- Detached persistence and Scene scope regressions protect semantic identity.
- Historical Scratch Adapter gate separates NodeId/BindingId from target.id.

**Gaps**
- No repository-wide branded Stable Identity types.
- No generic Identity Registry conflict gate.
- Scratch Adapter identity gate is historical/not active.

### Schema — `partial`

**Existing strengths**
- Runtime Component schema/version/cardinality/migration semantics have strong validators.

**Gaps**
- No generic src/core Schema Registry.
- Coverage is Runtime Component-specific.
- No gate requires every persistent semantic record to use a registered versioned schema.

### Authority — `partial`

**Existing strengths**
- Capability publication/generation/revocation, host-client separation and single-command commit are strongly tested.

**Gaps**
- No generic StateDomain writer/projection/observer Authority Registry.
- No generic double-writer conflict gate.
- No Authority Switch/projection-loop foundation.

### Protocol — `partial`

**Existing strengths**
- Exact portable Runtime Node API, sanitized errors, frozen snapshots and primitive Scene controller protocol exist.

**Gaps**
- No generic Engine Command/Query/Event DTO foundation.
- No repository-wide Editor mutation→Command rule.
- No generic protocol version negotiation/pagination foundation.

### Lifecycle — `partial`

**Existing strengths**
- Runtime Node/Component and module lifecycle/reentrancy/revocation plus Scene disable/re-enable are strongly tested.

**Gaps**
- No unified full lifecycle harness across all systems.
- No generic leak accounting for Timer/Listener/Worker/DOM/Resource.
- Device Lost/Restore and Hot Reload lifecycle are not generically gated.

### Serialization — `partial`

**Existing strengths**
- Existing persistent-data utility rejects non-plain/runtime values and cycles.
- Runtime Node, Scene V2 and SB3 persistence have regression/integration evidence.

**Gaps**
- Persistent-data utility is not yet a formal repository-wide PersistentDTO conformance gate.
- No schema-aware PersistentDTO brand.
- 0008.8 persistence validator is historical/not active.

### Compatibility — `partial`

**Existing strengths**
- Scratch Adapter validator exists historically; SB3 reconstruction and Scene binary boundary are permanent regressions.

**Gaps**
- Scratch Adapter boundary is not active architecture/CI.
- No src/core Import Boundary Gate yet.
- No Scratch semantic trace/native comparison foundation.

## ARC-C001.1 minimum-entry assessment

Master Plan requires seven minimum foundations before 0009. The current frozen repository does **not** yet satisfy them as formal ARC-C001.1 gates.

| Required before 0009 | Current status | Existing evidence |
|---|---|---|
| Import Boundary Gate | `missing` | — |
| Persistent DTO Validator | `partial-foundation` | `src/lib/persistence/persistent-data.js`, `scripts/validate-ngvge-task-0008.8.js` |
| Stable Identity Types | `missing` | — |
| Authority Registry | `missing` | `src/lib/first-party-modules/capability-registry.js` |
| Protocol Command foundation | `missing` | `src/lib/runtime-nodes/runtime-node-api-contract.js`, `src/lib/scene-system/scene-controller.js` |
| Schema Registry foundation | `partial-foundation` | `src/lib/runtime-nodes/runtime-component-type-registry.js` |
| Scratch Adapter Boundary Test | `historical-not-active` | `scripts/validate-ngvge-task-0008.7.3.js` |

Therefore:

```text
0009 Transform System
STATUS: BLOCKED

Reason:
ARC-C001.1 minimum conformance baseline is not yet established.
```

## Promotion plan for C001.1

1. **Promote semantics, not historical filenames.** `0008.9.4.1.6` should become reusable cross-boundary/portable-error corpus, not remain the long-term name of the rule.
2. **Keep destructive regressions.** Scene binary/capability failures are high-value examples for Backend Leakage and Capability Boundary conformance.
3. **Extract specialized foundations.** Runtime Component schema and Module capability authority should inform generic Schema/Authority foundations without making those old implementations the new core contract.
4. **Restore missing active authority where appropriate.** Scratch Adapter and Persistence semantics must become current gates before they can count toward C001.1.
5. **Do not promote unrelated correctness tests.** Myers diff, ordinary lint and typecheck remain product/tooling gates unless a specific ARC rule is encoded.

## C001.0-B Definition of Done

- [x] Active architecture entrypoints enumerated.
- [x] Unique active validators enumerated.
- [x] Historical/unwired validators separated from active authority.
- [x] Permanent Regression contracts classified.
- [x] Supporting CI gates classified.
- [x] Existing assets mapped to Identity / Schema / Authority / Protocol / Lifecycle / Serialization / Compatibility.
- [x] Direct coverage separated from supporting correctness.
- [x] Current aggregate/CI wiring audited.
- [x] C001.1 minimum requirements assessed.
- [x] Runtime / package / build behavior unchanged.

Machine-readable authority: `EXISTING-GATE-INVENTORY.json`.
