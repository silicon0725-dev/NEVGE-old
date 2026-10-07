# 0008.9.4.1.1 Migration Live-State Isolation and Enable-Batch Recovery Closure

Status: Implemented / Live-state and basic batch-recovery closure; final Module authority frozen by `0008.9.4.1.4`  
Parent: `0008.9.4.1 Component Migration Bootstrap and Execution Isolation Closure`  
Depends on: `0008.9.3` through `0008.9.4.1`  
Scene System: `0.8.9.4.1.1`  
Runtime Node public API: `1.3.1` unchanged  
Runtime Node Type Registration capability: `1.2` unchanged  
Runtime Node persistent format: `1` unchanged  
Runtime Component contract: `ngvge.runtime-component@1` unchanged

## Purpose

Close the two failure paths discovered after the Registration → Restore and Registry-lineage migration guard were introduced:

1. a migration provider retaining a live `RuntimeNode` or `RuntimeComponent` reference could mutate ordinary JavaScript fields without entering a guarded Graph method;
2. a module enable batch could fail after dependency `enable` hooks had run but before their `completeEnable` hooks, leaving a module reported as enabled while its Runtime capability had never been published.

This task freezes exactly two boundaries:

```text
Migration callback
→ cannot directly modify live Node / Component semantic state

Module Registration phase
→ must end as Completed, Failed, or Rolled Back
→ cannot remain externally Enabled while completion is pending
```

It does not create a general JavaScript sandbox, compensate network/filesystem side effects, or add asynchronous module lifecycle hooks.

## Live semantic state authority

### Private state ownership

Mutable semantic state is no longer stored as freely replaceable ordinary fields.

`RuntimeNode` now owns its semantic values through module-private `WeakMap` state, including:

```text
name
enabledSelf
activeInHierarchy
parentId
childIds
metadata
source
persistent extras
lifecycle state
ready marker
Graph binding
Component container binding
```

Stable Node identity and classification fields are machine-immutable:

```text
id
typeId
family
scope
sceneId
protected
```

`RuntimeComponent` uses the same model for:

```text
enabled
activeInHierarchy
data
extensionData
lifecycle state
create / ready markers
Graph binding
```

Its existing immutable identity, schema and cardinality fields remain unchanged.

The `RuntimeComponentContainer` now keeps its owner, Graph binding and component Map in private state. The Map is no longer reachable as an ordinary `_components` field.

After a provider-specific Node constructor has finished, the Runtime Node Type Registry seals the live Node object. Runtime Components and Component Containers are also sealed. This prevents a retained reference from shadowing prototype operations such as persistence methods or attaching ad-hoc semantic fields after construction.

### Guard-aware property access

Publicly readable semantic fields remain compatible with existing local code, but their property descriptors route writes through the owning Graph's mutation authority.

Portable object and array values use recursive Guard-aware proxies. The following operations are checked:

```text
top-level assignment
nested property assignment
property deletion
Object.defineProperty / Reflect.defineProperty
array mutation such as push, splice and index assignment
prototype replacement
preventExtensions attempts
```

Property-descriptor reflection does not leak the unguarded nested target: object values returned by `getOwnPropertyDescriptor()` are wrapped by the same Guard domain.

During migration execution, every such write reaches the Registry-lineage guard and fails with:

```text
RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION
```

The first violation remains recorded even when provider code catches the error and returns valid migration output.

### Graph binding ownership

The following bindings are getter-only and cannot be replaced by direct assignment:

```text
RuntimeNode._graph
RuntimeNode.components
RuntimeComponent._graph
RuntimeComponentContainer.graph
RuntimeComponentContainer.owner
```

Graph Adoption uses explicit internal rebinding operations. Initial binding and rebinding operations consult the currently bound Graph mutation authority before replacing private bindings. Consequently, a migration provider cannot detach a captured object from its guarded Graph and then mutate it.

## Migration failure equivalence

If a migration callback attempts any live-state write:

```text
candidate import fails
active Graph export remains deeply equal
active Descriptor list remains deeply equal
active migration edge list remains deeply equal
Node / Component Graph bindings remain unchanged
no partial field mutation is observable
```

This extends `0008.9.4.1` from API-level reentrancy exclusion to leaked-live-reference exclusion for Runtime Node and Component semantic state.

The boundary still does not claim transactionality for unrelated JavaScript objects, logs, network calls, timers, storage APIs or other effects outside NGVGE-owned semantic state. It also does not redefine undocumented direct writes to arbitrary Graph or Registry underscore internals as a supported mutation surface; those objects remain governed through their frozen capability and mutation APIs.

## Module enable completion state

Module state now carries a Runtime-only completion marker:

```text
enableCompletion = idle | pending | completed | failed
```

A module is operational only when both are true:

```text
enabled === true
enableCompletion === completed
```

During the ordinary `enable` hook the state is:

```text
state = enabling
enabled = false
enableCompletion = pending
```

The module may publish Registration-phase capabilities, but it is not reported as fully enabled.

After a successful `completeEnable` hook:

```text
state = enabled
enabled = true
enableCompletion = completed
```

`serializeProject()` persists a module as enabled only in this completed state.

## Enable-hook failure policy

When a dependent module's ordinary `enable` hook fails, modules that successfully entered the Registration phase earlier in the same batch are not abandoned.

The batch completes all still-valid pending modules before returning the original failure:

```text
core.enable succeeds
bad.enable fails
→ bad rolls back and enters failed
→ core.completeEnable still runs
→ core becomes fully enabled
→ original bad.enable error is returned
```

This is the selected deterministic policy for already successful dependencies. The framework does not roll them back merely because a later dependent failed.

## completeEnable failure policy

If `completeEnable` itself fails:

1. the failed module's `disable` hook is invoked as best-effort rollback;
2. all capabilities from that module are revoked;
3. the module enters `error / failed` with `enabled = false`;
4. pending modules whose required dependencies are no longer completed are rolled back in the same way;
5. unrelated pending modules may still complete;
6. the first completion failure is returned after the batch reaches a stable state.

A dependent rejected because its required dependency failed completion receives:

```text
MODULE_ENABLE_DEPENDENCY_INCOMPLETE
```

No pending module is left externally visible as enabled.

## Retry semantics

`enableModule()` returns immediately only for a genuinely operational module:

```text
enabled === true
and
enableCompletion === completed
```

A failed module can be enabled again. Its initialized state may be reused, but its `enable` and `completeEnable` hooks are executed again and capabilities are republished from a clean provider state.

If a legacy or interrupted state reports `enabled === true` without a completed marker, `enableModule()` repairs it into `pending` and runs completion instead of silently returning success.

## Native Kernel equivalence

The JavaScript implementation uses private state, accessors and recursive proxies. These mechanisms are not the portable contract.

A Native Kernel must preserve:

```text
live semantic writes consult migration phase authority
captured object references cannot bypass migration exclusion
Graph binding cannot be replaced outside binding authority
Enabled means completion succeeded
batch failure cannot leave a Registration-only module reported Enabled
completion failure produces a stable retryable state
```

A native implementation may use encapsulated structs, generation handles, write locks, phase capabilities or transactional arenas.

## Regression closure

The dedicated Architecture Smoke and Jest regression cover:

1. direct assignment to captured Node scalar fields;
2. nested mutation of captured Node metadata and source;
3. mutation through a reflected property descriptor;
4. captured Node child-array mutation;
5. direct and nested captured Component data mutation;
6. Component enabled, active and lifecycle-state assignment;
7. extensionData mutation;
8. initial and replacement Graph-binding attempts through retained objects;
9. Node and ComponentContainer method-surface shadowing attempts;
10. active Graph, Descriptor and migration-list equivalence after rejection;
11. dependent ordinary enable failure after a dependency entered Registration;
12. successful dependency completion despite the later dependent failure;
13. `completeEnable` failure and capability revocation;
14. rollback of pending required dependents;
15. deterministic retry of both the failed dependency and its dependent;
16. all historical architecture gates from `0008.7.3` through `0008.9.4.1`.

## Final state

```text
TASK 0008.9.4.1.1

Live Node Write Isolation:          Frozen
Live Component Write Isolation:     Frozen
Nested Portable Value Isolation:    Frozen
Graph Binding Ownership:            Frozen
Object Surface Closure:             Frozen
Enable Completion State:            Frozen
Enable Batch Failure Recovery:      Frozen
Completion Failure Retry:           Frozen

TASK 0008.9.4.1.4
Migration Runtime Governance:       Frozen

TASK 0008.9.4
Component Schema Contract:          Frozen
```
