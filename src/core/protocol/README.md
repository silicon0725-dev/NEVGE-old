# Protocol DTO Foundation

`src/core/protocol` is the NGVGE-owned, backend-independent protocol vocabulary established by **ARC-C001.1-F**.

It defines the minimum DTO boundary required before 0009:

- `EngineCommand`;
- `EngineQuery`;
- `EngineEvent`;
- `ProtocolError`;
- portable protocol value validation;
- detached, deeply frozen Query snapshots;
- explicit `ngvge.engine-protocol` protocol version `1`.

All DTO payloads are data-only. Functions, Promises, custom class instances, DOM/backend/native objects, symbols, BigInt/native integer handles, non-finite numbers, accessors and circular references fail closed rather than crossing the Runtime Boundary.

This foundation intentionally does **not** define Editor mutation mapping, transactions, request correlation, pagination, capability negotiation, event commit timing, protocol transport, IPC/WASM framing, or version negotiation. Those belong to later ARC-C001.3 / ARC-0002 work.

Existing subsystem-specific contracts such as Runtime Node snapshots and Scene controller JSON remain valid subsystem protocols. They are not renamed into the generic Core contract merely to satisfy this phase.
