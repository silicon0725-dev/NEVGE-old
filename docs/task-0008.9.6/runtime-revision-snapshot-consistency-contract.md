# 0008.9.6 Runtime Revision and Snapshot Consistency Contract

Status: Implemented / Frozen  
Scene System: `0.8.9.6.1.1`  
Snapshot Contract: `ngvge.runtime-node-snapshot@1`  
Revision Contract: `ngvge.runtime-node-revision@1`

## Single frozen boundary

This task freezes how a Runtime Node reader identifies one semantic state and captures a portable snapshot from that state.

```text
Revision Token
=
(runtimeGeneration, graphRevision, registryRevision)
```

A snapshot is valid only when all data in its envelope was observed under one equal Revision Token. Mixed-revision snapshots are forbidden.

This task does not introduce a general command transaction, multi-command commit protocol, Undo log or rollback engine. Those remain part of the later ARC-C001 Transaction Gate.

## Split capability

The existing portable mutation/query capability remains unchanged:

```text
ngvge.runtime-node-model@1.3.1
```

Snapshot and revision semantics are published through a separate capability:

```text
ngvge.runtime-node-snapshot@1
```

Public surface:

```text
assertCurrent(token)
capture(query)
getContract()
getRevision()
isCurrent(token)
```

Metadata:

```text
capabilityId
contractId
version
```

The split prevents Revision/Snapshot additions from silently expanding the frozen Runtime Node Model `1.3.1` surface.

## Revision Token

A token contains exactly:

```js
{
    contractId: 'ngvge.runtime-node-revision@1',
    runtimeGeneration,
    graphRevision,
    registryRevision
}
```

All fields are portable integers except the stable contract ID. Unknown fields, missing fields, negative revisions and non-positive generations are rejected with:

```text
RUNTIME_NODE_REVISION_TOKEN_INVALID
```

### runtimeGeneration

`runtimeGeneration` identifies the active Runtime Graph lineage.

It changes after a successful whole-Graph replacement, Import adoption or equivalent Runtime reconstruction. A token from an earlier generation is always stale even when numeric graph contents later appear equal.

### graphRevision

`graphRevision` is a private, monotonically increasing semantic revision within one Runtime generation.

It advances through supported Graph semantic mutation and lifecycle publication. It is not writable through an instance field and is not persistent project data.

### registryRevision

`registryRevision` is a Host-owned, monotonically increasing revision of the semantic type environment observed by the active Runtime Model.

It advances for supported changes including:

```text
Runtime Node type Descriptor registration / replacement / removal
Runtime Node provider binding / unbinding
Runtime Component type Descriptor registration / replacement / removal
Component migration edge binding / replacement / unbinding
```

Registry-only changes invalidate previous tokens without pretending the Graph itself changed.

The Node Type Registry and Component Type Registry store descriptors, listeners, usage resolvers and revision state in module-private `WeakMap` state. Their instances are sealed, so callers cannot replace a raw Map or forge `_revision` while leaving the public token unchanged.

## Snapshot Envelope

Every successful capture returns:

```js
{
    contractId: 'ngvge.runtime-node-snapshot@1',
    kind,
    query,
    revision,
    snapshot
}
```

The envelope, normalized query, Revision Token and complete snapshot payload are deeply frozen portable plain data.

The envelope factory independently:

```text
validates the exact Revision Token shape
clones query and snapshot through the Portable Data boundary
deep-freezes the resulting envelope
```

It does not trust the caller to provide already detached data.

## Atomic capture rule

Capture uses an optimistic stable-read boundary:

```text
capture Graph reference
→ read Revision Token A
→ build complete detached snapshot
→ read Revision Token B
→ verify same Graph reference and A == B
→ publish envelope
```

The current JavaScript implementation retries a bounded number of times. If it cannot observe one stable revision, it rejects with:

```text
RUNTIME_NODE_SNAPSHOT_UNSTABLE
```

No partial or mixed-revision payload is returned.

## Snapshot kinds

Frozen query kinds:

```text
graph
scene
node
component
subtree
node-list
node-types
```

Invalid fields are rejected instead of ignored:

```text
RUNTIME_NODE_SNAPSHOT_QUERY_INVALID
RUNTIME_NODE_SNAPSHOT_KIND_UNSUPPORTED
```

### Canonical ordering

Canonical ordering is part of the contract:

- Graph, Scene and Node-list node collections sort by stable Node ID.
- Components in a Node snapshot sort by stable Component ID.
- Node type collections sort by type ID.
- `allowedScopes` sorts lexically.
- Portable object keys are canonicalized lexically.
- `childIds` and subtree traversal preserve semantic hierarchy order; they are not lexically resorted.

This distinction prevents implementation Map insertion order from leaking into query equality while preserving order that is itself Runtime semantics.

## Currentness API

```text
isCurrent(token)
```

returns whether the token equals the active tuple.

```text
assertCurrent(token)
```

returns true when current and otherwise throws:

```text
RUNTIME_NODE_REVISION_STALE
```

The stale error includes detached expected and current Revision Tokens.

A Revision Token is an optimistic-concurrency observation token. It is not:

```text
a Transaction ID
a Mutation Context
a persistent project version
a global wall-clock sequence
a Backend generation handle
```

## Event consistency

Runtime Node observer events now include:

```text
revisionToken
runtimeGeneration
graphRevision
registryRevision
```

The compatibility field `revision` remains an alias of `graphRevision`.

Event payloads and their tokens are deeply frozen. Registry-only events carry the current Graph revision and a newer Registry revision.

## Persistent and Runtime-only state

Persistent format remains version `1`; no new project fields are introduced.

Portable Runtime output:

```text
Revision Token
Snapshot query
Snapshot envelope
Snapshot payload
```

Runtime-only:

```text
private Graph revision state
private Registry revision state
listener sets
optimistic capture attempts
active Graph reference
semantic Registry revision accumulator
```

Revision counters restart according to Runtime construction and are not serialized as authoring truth.

## Native Kernel equivalence

A future Native Kernel may implement snapshots with a read lock, immutable generation, RCU epoch, copy-on-write state or protocol query transaction.

It must preserve:

```text
one snapshot = one revision tuple
stable token comparison
canonical collection ordering
portable deeply immutable output
no Backend handle leakage
whole-Graph replacement invalidates old generation tokens
```

It does not need to reproduce JavaScript `WeakMap`, retry-loop or object-freezing implementation details.

## Deferred transaction boundary

The Master Plan requires both Revision/Snapshot and Transaction semantics, but they are not the same boundary.

Deferred to ARC-C001:

```text
Transaction Begin / Apply / Commit / Rollback
multi-command atomic mutation
Commit-only event publication
Undo protocol
transaction-wide revision assignment
```

`ngvge.runtime-node-revision@1` therefore declares:

```text
transactionRevision: false
```

## ARC-C001 Import Boundary follow-up

The `0008.9.5` Runtime Error contract still has a deliberate Host-internal import: `first-party-modules/service-facade.js` consumes the internal error factory.

When ARC-C001 activates the Import Boundary Gate, the allowlist should permit direct internal factory imports only from:

```text
runtime-errors/index.js
first-party-modules/service-facade.js
explicitly registered Host-internal implementations
```

Module, Editor and Compatibility code should be statically forbidden from directly importing `runtime-error-contract.js`.

This is a planned conformance rule and does not reopen `0008.9.5`.

## Final state

```text
TASK 0008.9.6

Revision Tuple Semantics:             Frozen by 0008.9.6.1 by 0008.9.6.1
Runtime Generation Identity:          Frozen
Graph Revision Authority:             Frozen
Registry Revision Authority:          Frozen by 0008.9.6.1 by 0008.9.6.1
Atomic Snapshot Envelope:             Frozen
Canonical Query Ordering:             Frozen by 0008.9.6.1 by 0008.9.6.1
Stale-token Detection:                 Frozen
Observer Revision Projection:          Frozen
Native-portable Snapshot Contract:     Frozen

TASK 0008.9 Runtime Node Model
Revision / Snapshot Query Boundary:    Frozen
```

## Closure lineage

`0008.9.6.1` closes Revision authority and canonical ordering. `0008.9.6.1.1` closes internal dispatch integrity and provider Graph isolation, ensuring a provider cannot bypass Model persistence while changing Snapshot-visible Runtime state. The combined contract is the frozen `0008.9.6` boundary.
