# ARC-C001.1-G｜Scratch Adapter Boundary Gate

**Status:** Complete / Freeze Ready  
**Date:** 2026-08-11  
**Parent:** ARC-C001｜ARC-0001 Conformance Suite  
**Authority:** ARC-0001 Kernel Independence Contract

## 1. Goal

Promote the historical `0008.7.3 Scratch Adapter Boundary Stabilization` behavior corpus into a durable ARC-C001 compatibility gate.

C001.1-G closes the final implementation requirement in the seven-item ARC-C001.1 minimum baseline. It does not certify the baseline by itself; that final unlock decision is reserved for C001.1-H.

## 2. Architectural boundary

The required ownership model remains:

```text
NGVGE semantic Sprite Node
    ngvge.sprite-node
            │
            └── ScratchBindingComponent
                    │
                    ▼
             Compatibility Adapter
                    │
                    ▼
              Scratch Target
```

The forbidden inversion is:

```text
Scratch Target / target.id / targetRuntimeId
                    │
                    ▼
       NGVGE semantic or persistent identity
```

## 3. Active gate

C001.1-G adds:

```text
tools/conformance/check-scratch-adapter-boundary.js
tools/conformance/check-scratch-adapter-boundary.self-test.js
docs/architecture/conformance/compatibility.md
test/regression/contracts/scratch-adapter-boundary.js
```

and package entry points:

```text
test:conformance:scratch-adapter-boundary
test:conformance:scratch-adapter-boundary:self-test
test:conformance:c001.1-g
```

The new gate is independent of the old task validator. `scripts/validate-ngvge-task-0008.7.3.js` is retained as supporting historical behavior corpus rather than being renamed into architecture authority.

## 4. Machine-enforced invariants

The active gate verifies:

- semantic Sprite owner identity is distinct from the legacy Scratch-specific node type;
- persistent binding records contain stable `BindingId` / `NodeId`, not live Target objects or `targetRuntimeId`;
- runtime binding views are immutable and Target-object-free;
- volatile target identity persistence fails closed with `SCRATCH_BINDING_VOLATILE_TARGET_ID_PERSISTED`;
- tree projection rejects stale bindings whose semantic owner node no longer exists;
- `src/core`, `src/lib/runtime-nodes` and `src/lib/persistence` do not import the Scratch adapter or carry Scratch runtime representation.

The retained 0008.7.3/unit corpus additionally verifies scene-scoped target indexing, target recreation without stable identity loss, semantic owner deletion cleanup and lifecycle disposal.

## 5. Permanent regression

`test/regression/contracts/scratch-adapter-boundary.js` protects the minimum boundary against future regression:

```text
stable BindingId + NodeId
volatile target identity runtime-only
no live Scratch Target in public binding view
no targetRuntimeId persistence
semantic-owner tree projection
no Scratch representation in selected semantic/Core contracts
```

## 6. Governance effect

`GOV-DEBT-0002` is resolved by this phase: Scratch Adapter boundary semantics are no longer historical-only evidence.

ARC-C001.1 minimum readiness becomes:

```text
Import Boundary Gate          COVERED
Stable Identity Types         COVERED
Persistent DTO Validator      COVERED
Schema Registry Foundation    COVERED
Authority Registry            COVERED
Protocol Command Foundation   COVERED
Scratch Adapter Boundary      COVERED

Satisfied                     7 / 7
```

`0009 Transform System` remains **BLOCKED** until C001.1-H performs the explicit minimum baseline certification and unlock decision.

## 7. Non-goals

C001.1-G does not claim that the Compatibility domain is globally complete. Semantic Trace, native-vs-Scratch comparison, full SB3 certification and future authority projection behavior remain later work.

## 8. Acceptance

The phase is accepted when all of the following are green:

- Scratch Adapter Gate self-test;
- active Scratch Adapter Boundary checker;
- historical 0008.7.3 semantic smoke;
- Scratch adapter service/lifecycle/tree-projection unit corpus;
- permanent regression layer;
- cumulative C001.1-G gate;
- repository unit/smoke/integration/lint/typecheck gates.

Production build completion is tracked separately as an existing external evidence hold and does not change the architecture result when the harness terminates without a compiler error.
