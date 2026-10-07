# ARC-C001.1-E｜Authority Registry Foundation

**Status:** Complete
**Date:** 2026-08-11
**Parent:** ARC-C001 / ARC-0001

## Objective

Promote State Domain authority semantics into a generic NGVGE-owned Core Authority Registry without turning existing Module Capability ownership, Scratch compatibility state, Runtime Components, or Editor services into the generic model.

## Implemented

```text
src/core/authority/
├── authority-contract.js
├── authority-registry.js
├── index.js
└── README.md
```

The foundation defines `ngvge-authority-registration/v1`, explicit `writer | projection | observer` roles, projection direction vocabulary, and a backend-independent Registry that rejects a second active writer for one State Domain.

## Key decisions

1. A State Domain may have multiple projections and observers, but at most one active writer registration.
2. `registerMany()` validates duplicate participants and writer conflicts before committing the batch.
3. Registration/query snapshots are immutable and deterministic.
4. `unregister()` releases current ownership but does not claim transactional Authority Switch semantics.
5. Existing `ModuleCapabilityRegistry` remains Module/Runtime-specific and is not renamed, moved, or treated as the generic State Domain Authority Registry.
6. Projection loop prevention, Mutation Context, write authorization, Authority Switch transactions and Transform2D authority wiring are explicitly deferred.

## Conformance

Active/manual:

```text
test:conformance:authority-registry
test:conformance:authority-registry:self-test
test:conformance:c001.1-e
```

Permanent regression:

```text
authority-registry-boundary
```

## Automated verification

```text
Authority Registry self-test       13 / 13 PASS
Authority Registry unit            11 / 11 PASS
ARC-C001.1-E cumulative gate        PASS
Permanent Regression               11 / 11 PASS
Unit / Node                        67 suites / 334 tests PASS
Unit / DOM                          3 suites / 21 tests PASS
Unit total                         70 suites / 355 tests PASS
Smoke                               1 / 1 PASS
Integration                         3 suites / 4 tests PASS
Scene lifecycle --detectOpenHandles 2 / 2 PASS
Architecture entrypoints           12 / 12 PASS
ESLint correctness                  PASS
TypeScript strict / noEmit          PASS
R6 Package Authority                PASS
R8 Gate Integrity                   PASS
Production build                    INCONCLUSIVE: harness timeout; no compiler error observed before termination
```

The production build result is intentionally not reported as PASS or FAIL because the tool execution window terminated the long-running Webpack/Babel process. This is an evidence limitation, not a recorded build failure.

## Minimum baseline effect

```text
Import Boundary Gate          COVERED
Stable Identity Types         COVERED
Persistent DTO Validator      COVERED
Schema Registry Foundation    COVERED
Authority Registry            COVERED
Protocol Command Foundation   MISSING
Scratch Adapter Boundary      HISTORICAL

Satisfied                     5 / 7
0009                          BLOCKED
```

## Explicitly deferred

C001.1-E does not claim completion of:

- Projection Loop Prevention;
- Mutation Context (`origin`, `transactionId`, `projectionId`);
- Authority Switch prepare/commit/rollback;
- generic mutation authorization;
- runtime ownership diagnostics beyond Registry snapshots;
- Transform2D Scratch Compatibility Authority registration;
- ARC-0003 full Authority and Projection Model.

These remain C001.3 / ARC-0003 and 0009 work.

## Next

`ARC-C001.1-F｜Protocol DTO Foundation`.
