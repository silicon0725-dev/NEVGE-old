# 0008.9.7 Runtime Mutation Commit Boundary

Status: Freeze Candidate / External Verification Pending  
Scene System: `0.8.9.7`  
Parent: `0008.9 Runtime Node Model Freeze`  
Depends on: `0008.9.2`, `0008.9.3`, `0008.9.4`, `0008.9.5`, `0008.9.6.1.1`

## Single boundary

This task freezes atomic commit semantics for **one portable Runtime Node Model mutation call**.

```text
Portable Mutation
→ capture private semantic checkpoint
→ prepare Runtime semantic change
→ validate/export persistent state
→ commit Project Source
→ execute deferred provider lifecycle hooks
→ publish buffered observer events
→ return applied=true, persisted=true
```

If the Project Source commit cannot be established:

```text
prepare Runtime semantic change
→ persistence failure
→ restore the original live semantic objects in place
→ discard deferred hooks
→ discard buffered observer events
→ return applied=false, persisted=false, snapshot=null
```

This task does **not** implement ARC-C001 multi-command transactions, command batching, Undo, transaction-wide rollback or transaction-wide revision.

## Authority model

The authoritative commit boundary is `RuntimeNodeModelHost`. A portable mutation cannot independently own Runtime state and Project Source state.

The Model Host owns Runtime-only commit machinery:

```text
semantic checkpoint
active mutation frame
deferred lifecycle-hook queue
observer-event buffer
commit / rollback counters
rollback poison state
```

These objects are never persisted and never cross the Runtime public boundary.

## In-place semantic checkpoint

Rollback does not import a replacement Graph and does not allocate replacement stable identities.

The checkpoint captures the private semantic state required to restore the currently live objects:

```text
RuntimeNodeGraph node / scene-root membership
RuntimeNode private semantic fields
RuntimeNode parent / child relationships
RuntimeNode provider resource store
RuntimeComponent private semantic fields
RuntimeComponent provider resource store
RuntimeComponentContainer membership and bindings
implicit Component Type descriptors created by the attempted mutation
lifecycle sequence / trace state required by the failed attempt
```

Original Node, Component and Container object identity is retained where the object existed before the attempted mutation.

Runtime generation is not replaced during rollback.

## Revision rule

Revision is an invalidation clock, not a transaction sequence number.

Rollback restores semantic state but does not rewind Graph or Registry revisions.

```text
failed attempt
→ semantic state restored
→ runtimeGeneration unchanged
→ revision remains monotonic
→ an older token may become stale
→ the failed mutation publishes no semantic mutation event
```

A Revision Token is therefore never reused for a different observed state.

## Persistence-before-effects rule

Provider lifecycle hooks are sanctioned provider side effects and are deferred while a Model mutation is preparing.

For a committed mutation:

```text
Project Source authoritative write
→ provider lifecycle hooks
→ observer events
```

For a failed mutation:

```text
Project Source write fails
→ provider lifecycle hooks do not run
→ observer events do not publish
```

Provider lifecycle contexts remain read-only semantic snapshots plus provider-owned Runtime resource storage. Arbitrary side effects performed by provider constructor code in the same JavaScript Realm are outside the Kernel rollback guarantee; provider constructors are expected to remain free of externally visible side effects.

Hook failures after a successful persistence commit are lifecycle diagnostics. They cannot retroactively make the already-authoritative Project Source write uncommitted.

## Persistence acknowledgement

A persistence backend may write authoritative Project Source data and then throw because a downstream observer failed. The Model therefore performs bounded authoritative read-back after a thrown write.

If the stored Runtime Node state exactly equals the intended state, the mutation is treated as committed:

```text
writeProject stores data
→ non-authoritative observer throws
→ readProject confirms exact intended Runtime Node state
→ commit succeeds
```

If confirmation is unavailable or differs, rollback remains authoritative.

## Persistent hierarchy semantics

Runtime Node persistent format remains `1`. No new persistent field is introduced.

Existing v1 fields and array structure are clarified:

```text
parentId: null
→ explicitly detached node

parentId omitted in legacy input
→ default to the scope root

relative node-record order for children of the same parent
→ persistent sibling order
```

Export walks hierarchy in `childIds` order so `reorderChild()` is durable. Import attaches records in persistent node-array order. Detached subtrees remain explicitly detached after restore.

This persistent hierarchy order is distinct from Snapshot canonical ordering. Snapshot collections continue to use locale-independent canonical string ordering where their contract requires canonical sets.

## Mutation result contract

`ngvge.runtime-node-model@1.3.1` keeps its existing result shape:

```js
{
    applied: boolean,
    error: PortableError | null,
    persisted: boolean,
    snapshot: PortableSnapshot | null
}
```

Frozen semantics:

```text
success:
    applied=true
    persisted=true
    snapshot=<committed snapshot>
    error=null

failure / rejected / persistence rollback:
    applied=false
    persisted=false
    snapshot=null
    error=<portable error when applicable>
```

`applied=true, persisted=false` is no longer valid on the portable mutation surface.

Machine contract:

```text
transactionSemantics: single-command-atomic
commitEventsAfterPersistence: true
failedMutationApplied: false
rollbackPreservesRuntimeGeneration: true
multiCommandTransactions: false
```

## Persistent and Runtime-only fields

Persistent format stays `1` and continues to contain only semantic Node / Component records, scenes and the existing model version.

Runtime-only:

```text
semantic checkpoint
mutation commit frame
hook queue
event buffer
rollback diagnostics
mutation commit / failure / rollback counters
poisoned recovery state
revision attempt history
```

## Rollback failure

If private checkpoint restoration itself fails, the Model cannot claim that Runtime and Project Source are synchronized.

It enters a poisoned mutation state and rejects later portable mutations with:

```text
RUNTIME_NODE_MUTATION_RECOVERY_REQUIRED
```

The immediate failure reports:

```text
RUNTIME_NODE_MUTATION_ROLLBACK_FAILED
```

This state requires an explicit Host recovery / replacement path; continuing normal writes would violate Unique Authority.

## Scope boundary versus ARC-C001

`0008.9.7` guarantees atomicity for the complete semantic work performed by **one public mutation method**, including subtree operations such as duplicate or destroy.

Still deferred to ARC-C001:

```text
Begin / Apply / Commit / Rollback transaction API
multiple public commands in one atomic unit
Undo / redo protocol
commit-only transaction event aggregation
transaction-wide authority switch
transaction-wide schema migration
transaction-wide stable revision
editor batch mutation
```

This division follows ARC-C001's planned Transaction Gate rather than implementing it prematurely inside Runtime Node Model.

## Native Kernel equivalence

A Native Kernel may implement the checkpoint using copy-on-write storage, journals, arena snapshots, immutable state roots or native transaction primitives. It must preserve the same externally observable semantics:

```text
one portable mutation either commits Runtime + Project Source or commits neither
failed mutation does not replace stable identities
failed mutation does not replace Runtime generation
provider lifecycle effects do not precede persistence commit
observer events do not precede persistence commit
revision values never rewind
persistent hierarchy order survives save / restore
```

## Freeze candidate state

```text
TASK 0008.9.7

Single-command Mutation Atomicity:       Candidate
In-place Semantic Rollback:              Candidate
Persistence-before-provider-effects:     Candidate
Commit-only Observer Publication:        Candidate
Runtime Generation Preservation:         Candidate
Monotonic Failed-attempt Revision:        Candidate
Persistent Sibling Ordering:              Candidate
Explicit Detached-node Persistence:       Candidate
Multi-command Transactions:               Deferred to ARC-C001
```

Formal `Architecture Frozen` status should be assigned after external adversarial verification of the delivered full build.
