# Protocol DTO Conformance

**Foundation:** ARC-C001.1-F
**Status:** Active / Manual
**Core authority:** `src/core/protocol`

## Contract

The Core Protocol boundary owns the generic, backend-independent DTO vocabulary used to express NGVGE Engine Commands, Queries, Events and structured Protocol Errors.

Current protocol identity:

```text
protocol:        ngvge.engine-protocol
protocolVersion: 1
```

Generic DTO kinds:

```text
command
query
event
error
```

Command / Query / Event shape:

```text
{
  protocol,
  protocolVersion,
  kind,
  type,
  payload
}
```

ProtocolError shape:

```text
{
  protocol,
  protocolVersion,
  kind: "error",
  code,
  message,
  details
}
```

## Portable value rule

Protocol payloads and error details must be detached plain data. The current gate rejects:

- Function / callable services;
- Promise;
- custom class instances and native/backend object wrappers;
- Symbol / symbol keys;
- BigInt/native integer handle representations;
- non-finite numbers;
- circular references;
- accessors and non-enumerable fields;
- sparse arrays and custom array properties;
- unsafe prototype-oriented keys.

Validation is descriptor-based and does not invoke getters.

## Query snapshot rule

`createQuerySnapshot()` clones protocol-safe data away from the live source and recursively freezes the result. A Query result must therefore be a snapshot, not a retained Runtime service/object reference.

## Enforcement

```text
test:conformance:protocol-dto
test:conformance:protocol-dto:self-test
test:conformance:c001.1-f
```

Permanent regression:

```text
protocol-dto-boundary
```

## Non-claims

This foundation does not yet enforce every Editor mutation as an Engine Command, transaction ordering, commit-time event publication, pagination, protocol negotiation, transport framing or full ARC-0002 semantics. Those remain later conformance work.

Structural validation also cannot infer hidden semantics assigned to an otherwise ordinary primitive number/string. Primitive backend-handle leakage remains forbidden by ARC-0001 and must be caught by semantic ownership/domain gates; generic Runtime Brand Detection is deferred to C001.2.
