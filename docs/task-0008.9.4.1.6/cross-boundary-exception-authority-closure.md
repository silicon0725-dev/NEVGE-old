# 0008.9.4.1.6 Cross-Boundary Exception Authority Closure

Status: Implemented / Frozen  
Scene System: `0.8.9.6.1.1`

## Single frozen boundary

This task freezes the exception channel of the Module Service and consumed Capability membrane.

The portable rule is:

```text
A thrown or rejected JavaScript value is a cross-boundary output.
Host and Module code may exchange only a sanitized boundary error,
never the original thrown value or a raw object reachable from it.
```

Normal return values continue to use generation-scoped Service or Capability facades. Exceptional completion uses a separate structured error contract.

## Directional error contract

Host Service operation to Module:

```text
MODULE_SERVICE_HOST_OPERATION_FAILED
```

Capability Provider operation to consuming Module:

```text
MODULE_CAPABILITY_PROVIDER_OPERATION_FAILED
```

Module callback to Host Service:

```text
MODULE_SERVICE_CALLBACK_FAILED
```

Consuming Module callback to Capability Provider:

```text
MODULE_CAPABILITY_CALLBACK_FAILED
```

Every converted failure is a frozen `ModuleBoundaryError`. Its **normative public fields** are:

```text
name
message
code
direction
operation
serviceId
portableDetails
```

The local JavaScript `Error` may also expose implementation-local diagnostics such as V8's non-enumerable `stack` accessor. Those diagnostics belong to the boundary error itself and are not part of the portable public field contract. See `0008.9.5 Runtime Error and Diagnostic Contract`.

The portable error record never contains:

```text
cause
original Error or thrown object
Host or Module object
Manager, Runtime or VM
Backend handle
Provider record
registration authority token
caller-owned class instance
```

`portableDetails` is a deeply frozen, bounded diagnostic copy. It may contain primitive information from own data properties such as remote `name`, `message`, `code`, and explicitly supplied portable details. Accessors are never invoked while collecting diagnostics. Cycles, functions, symbols, excessive depth, excessive keys, and oversized strings are replaced or truncated into inert descriptions.

## Host-to-Module exceptional completion

The Host operation wrapper covers:

- Service and Capability methods;
- object property getters and setters;
- function apply and construct;
- property descriptor and reflection operations;
- `delete`, `defineProperty`, `has`, `ownKeys`, prototype and extensibility traps;
- synchronous iterator `next()` failures;
- Promise and async-iterator rejection.

A raw object thrown by any of these operations is converted before Module code can catch it.

Promise-like values are identified without eagerly invoking arbitrary `then` accessors. Native, cross-Realm, and descriptor-defined thenables are marked by the facade. Their rejection handler receives a sanitized boundary error before `await`, `.then()` or `.catch()` can expose the rejection value to Module code. A throwing `then` getter is itself treated as a Host operation failure.

## Module-to-Host callback exceptional completion

Callbacks crossing into a Host Service or Capability Provider are wrapped by the same membrane.

The wrapper covers:

- direct callback throw;
- callback Promise rejection;
- getter and setter callbacks carried inside portable argument records;
- callback return conversion failure;
- callbacks retained and invoked later by Host code.

A Module-owned class instance, object, function, symbol, Error with object-valued fields, or other arbitrary thrown value is converted before Host code can catch or retain it.

If a sanitized callback error later escapes back through the surrounding Host operation, it remains the same inert boundary error rather than being wrapped with a raw `cause` or converted into a second object graph.

## Revocation interaction

Boundary errors are inert diagnostic values and do not carry bearer authority. They may remain observable after Module unregister, Capability Provider revocation, same-ID re-registration, or Manager disposal without preserving access to the original Host or Module object.

The underlying Service and Capability facades remain generation- and Provider-record scoped. Exception sanitization does not weaken:

```text
MODULE_CLIENT_AUTHORITY_REVOKED
MODULE_MANAGER_DISPOSED
MODULE_CAPABILITY_AUTHORITY_REVOKED
```

If revocation occurs before an asynchronous callback or Promise reaction executes, the existing revocation failure wins before the raw rejection value is delivered.

## Persistent and Runtime-only state

No persistent format changes are introduced.

Runtime-only implementation state includes:

- the set of membrane-created sanitized boundary errors;
- raw-to-facade and facade-to-raw maps;
- Promise-like identity marks;
- callback and rejection-callback wrapper caches;
- bounded diagnostic sanitization limits.

No exception object, stack, callback, authority token, facade cache, or Provider record is persisted.

## Native Kernel equivalence

A future Native Kernel or IPC implementation must preserve the same semantic result:

```text
success → portable value or revocable handle
failure → structured boundary error with no raw cross-domain reference
```

The Kernel may use status records, tagged unions, IPC error envelopes, native handles, or language-specific exceptions. It must preserve stable error codes, direction, operation identity, bounded portable diagnostics, and the absence of raw Host or Module object references.

JavaScript `try/catch`, `Promise`, `Proxy`, `WeakMap`, and `WeakSet` are implementation mechanisms, not the contract.

## Explicit scope

This task closes JavaScript thrown-value and Promise-rejection authority channels in the supported Service and consumed Capability membrane.

It does not claim to roll back external side effects performed before an operation throws. It also does not serialize arbitrary stacks or preserve arbitrary custom Error subclasses across the boundary. Callers receive a stable boundary failure, not the original exception identity.
