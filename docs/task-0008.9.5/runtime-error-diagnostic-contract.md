# 0008.9.5 Runtime Error and Diagnostic Contract

Status: Implemented / Frozen  
Scene System: `0.8.9.5`  
Error Contract: `ngvge.runtime-error@1`

## Single frozen boundary

This task freezes the distinction between a Runtime error instance, its portable public error record, and implementation-local diagnostics.

```text
Runtime Error Instance
├── normative public semantic fields
└── runtime-local diagnostic properties

Portable / Protocol Boundary
└── normative public error record only
```

A JavaScript `Error` may expose implementation-specific properties such as V8's local `stack` accessor. Their presence does not enlarge the portable error schema and does not create bearer authority.

## Runtime error instance

A membrane-created `ModuleBoundaryError` remains a frozen local JavaScript `Error` instance. The current JavaScript host may provide an own, non-enumerable `stack` property or accessor.

The error instance is Runtime-only. It is not itself a Persistent DTO, protocol packet, Capability payload, IPC envelope or Native ABI record.

## Normative public fields

The normative public fields are:

```text
name
message
code
direction
operation
serviceId
portableDetails
```

The wording is deliberately **normative public fields**, not **the only own properties on the JavaScript Error object**.

`toRuntimeErrorPublicRecord(error)` creates a deeply frozen, portable plain-data projection containing exactly those fields. The projection never includes:

```text
stack
cause
original thrown value
Host or Module object
Manager, Runtime or VM
Backend handle
Provider record
registration authority token
```

The record is JSON-round-trip stable and is the only error representation eligible for future in-process protocol, IPC, Worker, WASM or Native Kernel transport.

## Runtime-local diagnostics

`getRuntimeErrorLocalDiagnostics(error)` returns a separate frozen Runtime-only diagnostic snapshot.

The JavaScript implementation currently defines one local diagnostic field:

```text
stack: string | null
```

The stack:

- belongs to the boundary error itself;
- reports the local boundary-error creation path;
- is not copied from the original thrown value;
- is not part of `ngvge.runtime-error@1` public semantics;
- may be absent or differ across JavaScript engines;
- must not be persisted or transmitted as a portable contract field.

Future hosts may expose other local diagnostics, but those additions do not change the public error record unless a later versioned error contract explicitly promotes them.

## Authenticity

Public-record and local-diagnostic projection helpers accept only errors created by the Runtime boundary-error factory. A structurally similar arbitrary object or ordinary `Error` is rejected with:

```text
RUNTIME_ERROR_CONTRACT_INVALID_ERROR
```

This prevents callers from presenting spoofed objects as trusted Runtime boundary errors.

## Current API

Supported public projection API:

```js
RUNTIME_ERROR_CONTRACT_ID
RUNTIME_ERROR_PUBLIC_FIELDS
RUNTIME_ERROR_LOCAL_DIAGNOSTIC_FIELDS
isRuntimeBoundaryError(value)
toRuntimeErrorPublicRecord(error)
getRuntimeErrorLocalDiagnostics(error)
```

`createRuntimeBoundaryError()` and diagnostic sanitization helpers remain Host-internal construction authority and are not exported by the supported Runtime Error API.

The Service and consumed-Capability membrane uses the same shared Runtime error registry, so a sanitized error remains trusted across different Service facade factories without structural trust.

## Persistent and Runtime-only state

No persistent format changes are introduced.

Persistent / portable:

```text
toRuntimeErrorPublicRecord(error)
```

Runtime-only:

```text
JavaScript Error identity
V8 stack accessor or stack string
trusted-error WeakSet
local diagnostic snapshot
raw stack formatting and source locations
```

## Native Kernel equivalence

A future Native Kernel may represent failure with a tagged result, status record, native exception, IPC envelope or C ABI error structure.

It must preserve:

```text
stable public error fields
portableDetails
no raw cross-domain reference
no backend handle leakage
```

It does not need to reproduce V8 stack formatting or JavaScript `Error` property descriptors.

## Explicit scope

This task freezes the current Runtime boundary-error projection and diagnostic separation. It does not define the complete future ARC-0002 protocol error taxonomy, localization policy, telemetry retention, trace correlation or remote symbolication system.

It clarifies `0008.9.4.1.6` without reopening the Component Schema or Migration Authority freeze.

## ARC-C001 Import Boundary follow-up

The supported public `src/lib/runtime-errors/index.js` intentionally does not export Host-only boundary-error construction authority. The current Service membrane imports the internal factory directly from `runtime-error-contract.js`.

When ARC-C001 establishes the Import Boundary Gate, direct internal-factory imports should be allowlisted only for:

```text
runtime-errors/index.js
first-party-modules/service-facade.js
explicitly registered Host-internal implementations
```

Module, Editor and Compatibility code should be statically forbidden from directly importing `runtime-error-contract.js`.

This is a non-blocking future conformance rule and does not reopen this frozen Error contract.

## Final state

```text
TASK 0008.9.5

Runtime Error Instance:              Frozen
Normative Public Error Fields:       Frozen
Portable Error Record:               Frozen
Local Diagnostic Separation:         Frozen
JavaScript stack classification:     Frozen
Boundary Error Authenticity:         Frozen
Native-portable Error Semantics:     Frozen

TASK 0008.9.4
Component Schema Contract:           Frozen
```
