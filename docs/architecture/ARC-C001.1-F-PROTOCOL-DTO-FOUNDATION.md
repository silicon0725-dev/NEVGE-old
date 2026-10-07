# ARC-C001.1-F｜Protocol DTO Foundation

**Status:** Complete
**Date:** 2026-08-11
**Parent:** ARC-C001 / ARC-0001

## Objective

Establish the first generic NGVGE-owned Engine Protocol DTO vocabulary so Commands, Queries, Events and structured Protocol Errors can cross Runtime/Editor/Adapter boundaries as versioned plain data rather than mutable services or backend-native objects.

## Implemented

```text
src/core/protocol/
├── portable-value.js
├── protocol-dto.js
├── index.js
└── README.md
```

The foundation defines:

```text
Protocol: ngvge.engine-protocol
Version:  1

DTO kinds:
- command
- query
- event
- error
```

Public constructors:

```text
createEngineCommand(type, payload)
createEngineQuery(type, payload)
createEngineEvent(type, payload)
createProtocolError(code, message, details)
createQuerySnapshot(value)
```

## Key decisions

1. Every generic Engine DTO carries explicit protocol identity and version.
2. Command / Query / Event DTOs use a semantic `type` token plus portable data-only `payload`.
3. ProtocolError is a data DTO (`code`, `message`, `details`) rather than an Error/class instance crossing the boundary.
4. Protocol payloads reject functions, Promises, custom class instances, symbols, BigInt/native integer handles, non-finite numbers, accessors, cycles, sparse/custom arrays and unsafe object keys.
5. Query snapshots are cloned away from live state and deeply frozen before exposure.
6. Existing Runtime Node snapshot/API contracts and Scene controller JSON remain subsystem-specific protocols. F does not rename or migrate them merely to manufacture generic coverage.
7. Core Protocol remains independent from Scratch, React, DOM, Runtime Node internals and concrete backends.

## Conformance

Active/manual:

```text
test:conformance:protocol-dto
test:conformance:protocol-dto:self-test
test:conformance:c001.1-f
```

Permanent regression:

```text
protocol-dto-boundary
```

## Scope boundary

C001.1-F is a DTO **foundation**, not full ARC-0002.

Explicitly deferred:

- repository-wide Editor Mutation → Engine Command mapping;
- Transactions / atomic commit semantics;
- event publication-after-commit rules;
- request/correlation identifiers;
- pagination / incremental query contracts;
- capability negotiation;
- protocol version negotiation;
- IPC / WebSocket / WASM transport framing;
- transport error mapping;
- generic runtime brand registry for primitive backend handles.

A structural DTO gate cannot infer that an arbitrary plain number/string has secretly been assigned backend-handle semantics. Such semantic leakage remains forbidden by ARC-0001 and is enforced by ownership/domain gates; broader Runtime Brand Detection is scheduled for C001.2.

## Automated verification

```text
Protocol DTO self-test             15 / 15 PASS
Protocol DTO unit                  13 / 13 PASS
ARC-C001.1-F cumulative gate        PASS
Permanent Regression               12 / 12 PASS
Unit / Node                        68 suites / 347 tests PASS
Unit / DOM                          3 suites / 21 tests PASS
Unit total                         71 suites / 368 tests PASS
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

The production build result is intentionally not reported as PASS or FAIL because the execution harness terminated the long-running Webpack/Babel process after 180 seconds. The emitted Babel deoptimisation note for the existing `spine-webgl.js` >500KB file is informational and was not a compile error.

## Minimum baseline effect

```text
Import Boundary Gate          COVERED
Stable Identity Types         COVERED
Persistent DTO Validator      COVERED
Schema Registry Foundation    COVERED
Authority Registry            COVERED
Protocol Command Foundation   COVERED
Scratch Adapter Boundary      HISTORICAL

Satisfied                     6 / 7
0009                          BLOCKED
```

The remaining C001.1 minimum blocker is the active Scratch Adapter Boundary Gate and final baseline certification.

## Next

`ARC-C001.1-G｜Scratch Adapter Boundary Gate`.
