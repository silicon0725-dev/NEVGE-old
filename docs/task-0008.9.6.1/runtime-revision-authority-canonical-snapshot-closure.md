# 0008.9.6.1 Runtime Revision Authority and Canonical Snapshot Closure

Status: Architecture Frozen  
Scene System: `0.8.9.6.1.1`  
Parent: `0008.9.6 Runtime Revision and Snapshot Consistency Contract`

## Single frozen boundary

This closure makes the Revision Token a true semantic-state identity:

```text
one (runtimeGeneration, graphRevision, registryRevision)
→ exactly one observable Runtime snapshot state
```

The closure covers four authority surfaces only:

1. Registry revision becomes authoritative before any public Registry observer runs.
2. Runtime Node Type Registry binding is owned by `RuntimeNodeGraph` and cannot be replaced directly.
3. Node providers cannot intercept Engine-internal Graph binding or lifecycle dispatch to obtain a raw Graph capability.
4. Retained live-object semantic writes advance private Graph Revision even when they do not publish an intermediate observer event.
5. Canonical string ordering and Snapshot query/token validation are environment-independent and strict.

It does not introduce multi-command transactions, Commit/Rollback or transaction-wide revisions. Those remain deferred to ARC-C001.

## Registry revision authority

`registryRevision` is derived directly from current authoritative state:

```text
Node Type Registry private revision
+
Component Type Registry private revision
+
Host-owned Node Descriptor / Provider epoch
```

It is not maintained by a later public Listener callback.

Both Registry implementations increment their private revision before notifying observers. Therefore an observer registered before the Runtime Model cannot capture changed Registry content under the previous Revision Token.

Registry-only changes may preserve `graphRevision`, but must advance the complete Revision Token.

## Node Registry binding ownership

`RuntimeNodeGraph.typeRegistry` is a non-configurable, read-only binding backed by module-private storage.

Direct assignment rejects before side effects:

```text
RUNTIME_NODE_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN
```

The Graph and Snapshot capability resolve Node Type data from the same Graph-owned Registry binding. A Graph cannot execute against one Registry while snapshots and stale-token checks observe another.

Unlike the Component Registry, the current contract does not expose a Runtime Node Registry replacement operation. A future controlled replacement would require explicit preflight, compatibility validation, revision/generation semantics and atomic binding transfer.

## Provider raw Graph isolation

A custom Runtime Node provider may construct a Node subtype, but it does not own Engine lifecycle dispatch.

The following internal operations are final on each live Node instance and are invoked through module-private base operations rather than provider virtual dispatch:

```text
_bindGraph
_replaceGraphBinding
_invoke
_recordLifecycle
_transition
_markReady
_setActiveInHierarchy
```

Provider overrides cannot intercept these operations or capture the raw `RuntimeNodeGraph`.

Raw Graph bindings are not exposed through:

```text
RuntimeNode._graph
RuntimeComponent._graph
RuntimeComponentContainer.graph
```

Internal rebinding requires module-private authority. Direct calls reject with the corresponding internal-authority error and cannot be used to detach an object from Mutation Guard ownership.

Node provider behavior remains expressible through registered lifecycle hooks and detached/read-only observation contexts. Providers do not receive a hidden raw Graph mutation capability.

## Retained live-object revision integrity

A retained live Node or Component reference cannot alter Snapshot-visible semantic data under an unchanged Graph Revision.

Top-level field writes and nested portable-value writes execute the existing semantic Mutation Guard and, after a successful mutation, touch the private Graph Revision without publishing an intermediate observer event.

Covered operations include:

```text
Node scalar field assignment
Node metadata / source / childIds nested mutation
Component scalar field assignment
Component data / extensionData nested mutation
array set / splice / push
delete / defineProperty
```

Graph-owned operations may still publish their normal final semantic event after internal writes. Intermediate field touches advance Revision identity but do not expose a partially completed event payload.

This closes the remaining same-token/different-live-state path through a provider-retained object reference. It does not convert raw local object mutation into a portable public mutation API; portable Editor and Module writes remain required to use the Runtime Node Model boundary.

## Canonical string ordering

Canonical Snapshot ordering uses Unicode code-point lexicographic order.

The comparison is:

```text
compare Array.from(string).map(codePoint)
```

It does not call:

```text
String.prototype.localeCompare
Intl.Collator
host default locale
```

The contract identifier exposes:

```text
canonicalStringOrder: unicode-code-point-lexicographic
```

This rule applies to canonical Node IDs, Component IDs, Type IDs, Scene IDs, portable object keys and normalized scope collections. Semantic hierarchy order such as `childIds` and subtree traversal remains unchanged.

The ordering is intended to be reproduced identically by JavaScript, IPC consumers, WASM and a future Native Kernel.

## Strict Snapshot query contract

Snapshot queries do not silently coerce invalid values.

Examples rejected with `RUNTIME_NODE_SNAPSHOT_QUERY_INVALID`:

```text
order: "garbage"
includeRoots: "false"
includeHidden: "true"
includeRoot: 1
kind: 1
unsafe maxDepth
```

Boolean fields accept only Boolean values. Traversal order accepts only the declared enum. Integer fields use safe-integer validation.

## Revision Token integer semantics

`runtimeGeneration`, `graphRevision` and `registryRevision` use `Number.isSafeInteger` validation.

```text
runtimeGeneration > 0
graphRevision >= 0
registryRevision >= 0
```

Negative zero is normalized to positive zero before freezing the Token. Values outside the JavaScript safe-integer range reject with:

```text
RUNTIME_NODE_REVISION_TOKEN_INVALID
```

This prevents JavaScript number aliasing from creating distinct textual Tokens for an indistinguishable numeric state.

## Persistence and API compatibility

Unchanged:

```text
Runtime Node public API:         ngvge.runtime-node-model@1.3.1
Snapshot capability:             ngvge.runtime-node-snapshot@1
Revision contract:               ngvge.runtime-node-revision@1
Runtime Node persistent format:  1
```

Revision counters, Registry bindings and provider-internal authority are Runtime-only and are not serialized as authoring truth.

## Native Kernel equivalence

A Native implementation may use locks, immutable epochs, RCU, generation tables or copy-on-write storage. It must preserve:

```text
Registry semantic state advances revision before observer publication
one Revision Token identifies one observable semantic state
Node Registry binding cannot be replaced outside controlled Kernel authority
providers cannot obtain raw Kernel Graph mutation authority
canonical strings use Unicode code-point lexicographic order
invalid query values reject rather than coerce
revision integers have a finite canonical range
```

## Final state

```text
TASK 0008.9.6.1

Observer-order-independent Registry Identity: Frozen
Node Registry Binding Authority:               Frozen
Provider Raw Graph Isolation:                  Frozen
Retained Live-object Revision Integrity:       Frozen
Final Internal Lifecycle Dispatch:             Frozen
Locale-independent Canonical Ordering:         Frozen
Strict Snapshot Query Validation:              Frozen
Safe Revision Integer Semantics:               Frozen

TASK 0008.9.6
Runtime Revision / Snapshot Contract:          Frozen
```

## Final dispatch closure

The original `0008.9.6.1` implementation established Registry authority, canonical ordering and instance-surface finality. `0008.9.6.1.1` completes the provider-isolation claim by replacing every remaining mutable-prototype or provider-virtual internal dispatch with captured module-private base operations, and by requiring Model-owned semantic writes to execute inside the Graph mutation authority.
