# 0008.9.4.1 Component Migration Bootstrap and Execution Isolation Closure

Status: Implemented / API-level closure; final Migration governance frozen by `0008.9.4.1.6`  
Parent: `0008.9.4 Component Schema Version and Migration Authority Freeze`  
Depends on: `0008.9.3 Component Boundary Freeze` through `0008.9.4`  
Scene System: `0.8.9.6.1.1`  
Runtime Node public API: `1.3.1` unchanged  
Runtime Node Type Registration capability: `1.2` unchanged  
Runtime Node persistent format: `1` unchanged  
Runtime Component contract: `ngvge.runtime-component@1` unchanged

## Purpose

Close the runtime-governance boundary left after the Schema Authority rules were introduced.

This task freezes exactly three semantics:

1. unknown Component types imported into a fresh Registry retain genuine implicit authority identity;
2. module-owned Descriptors and migrations are registered before initial Runtime restore begins;
3. migration providers cannot use controlled Registry, Graph or public Runtime Model mutation APIs while migration code is executing.

It does not introduce general transactions, online migration of attached Components, worker isolation, or rollback for arbitrary external JavaScript side effects.

## Fresh import implicit authority

An imported type that is absent from a fresh Registry is not registered through the ordinary explicit Descriptor path.

The import validation plan records the type as implicit semantic metadata, and candidate Graph construction calls:

```text
RuntimeComponentTypeRegistry.ensureImplicit(typeId, descriptor)
```

The compatibility Descriptor therefore has both:

```text
ownerModuleId = ngvge.runtime.compat.import
registry.isImplicit(typeId) = true
```

The owner string is descriptive only. The actual implicit status remains module-private authority stored by the Registry.

Consequences:

- a fresh project load preserves the same opaque compatibility semantics as a Registry clone;
- an explicit owner may later claim a compatible type using normal Descriptor replacement;
- owner mismatch rules cannot permanently trap a fresh unknown type under the compatibility owner;
- imported opaque data remains unchanged until a real owner Descriptor is registered.

## Registration and restore phases

Scene System startup is now explicitly divided into two phases.

### Registration phase

During the ordinary module `enable` hook, Scene System:

1. creates the Scene Data Model;
2. creates a Runtime Node Host shell with initial restore deferred;
3. publishes `ngvge.runtime-node-type-registration@1.2`;
4. does not yet publish `ngvge.runtime-node-model@1.3.1`.

Dependent modules can register:

- Component Type Descriptors;
- Component migration providers;
- Node Type Descriptors and local providers.

They cannot obtain the public Runtime Node Model through the capability registry during this phase.

### Restore phase

After every module in the current enable batch has completed its `enable` hook, the Module Manager executes optional `completeEnable` hooks in dependency-first order.

Scene System's `completeEnable` hook:

1. executes the deferred initial Runtime restore;
2. imports using all Descriptors and migration providers registered during the Registration phase;
3. publishes `ngvge.runtime-node-model@1.3.1` only after restore completion;
4. constructs and publishes the remaining Scene Runtime services.

For project deserialization, pending enable completions are explicitly flushed before module-specific `deserializeProject` hooks run. Module deserializers therefore observe the restored Runtime Model rather than the un-restored Host shell.

The local Host preserves backward compatibility: callers that do not request deferred restore still restore immediately.

## Initial restore contract

The local Host exposes Runtime-only operations:

```text
restoreInitialState()
getInitialRestoreStatus()
```

`restoreInitialState()` is idempotent and rejects reentrant execution with:

```text
RUNTIME_NODE_INITIAL_RESTORE_REENTRANT
```

These operations are not added to the portable Runtime Node Model capability.

A supported older project can therefore follow the required order:

```text
create Host shell
→ publish registration capability
→ owner registers Descriptor v2
→ owner binds migration 1 → 2
→ execute initial restore
→ publish Runtime Model
```

## Shared migration execution domain

Every `RuntimeComponentTypeRegistry` owns a private migration execution guard. A Registry cloned from another Registry shares the same guard object.

This shared lineage is required because import executes migrations against a candidate Registry clone while the currently active Graph remains bound to the source Registry.

During provider execution, the guard records:

```text
typeId
fromVersion
toVersion
first forbidden mutation attempt
```

The guard is active only while the migration callback runs. Detached migration input and output validation continue normally.

## Controlled semantic writes during migration

While the guard is active, the following controlled operations are rejected before mutation:

- Component Descriptor registration, replacement or unregistration;
- implicit Descriptor creation;
- migration binding, replacement or unbinding;
- Registry usage-resolver binding or unbinding;
- mutation of any RuntimeNodeGraph bound to the guarded Registry lineage;
- mutation through a public Runtime Node Model backed by such a Graph;
- Graph replacement, synchronization or disposal paths that pass through Graph mutation authority.

The stable error code is:

```text
RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION
```

Portable details identify the attempted operation and active migration edge.

If provider code catches the rejection internally and returns an otherwise valid result, the recorded first violation still causes migration failure. A provider cannot convert a forbidden semantic write into an apparently successful migration by swallowing the exception.

## Atomic failure semantics

For a migration callback that attempts a forbidden semantic write:

```text
candidate import rejected
active Graph unchanged
active Registry Descriptors unchanged
active Registry migration edges unchanged
usage-resolver ownership unchanged
stored project payload unchanged
```

This task prevents side effects entering through controlled mutation APIs. Direct writes through retained live Node or Component references are closed by `0008.9.4.1.2`; the guard is not a compensating rollback mechanism.

Ordinary JavaScript effects outside NGVGE semantic authority—such as writing to an unrelated object, logging, network access or filesystem access—are not made transactional by this task. Future Native Kernel or isolated-provider execution may enforce a stronger host sandbox without changing the frozen API result.

## Native Kernel equivalence

The implementation mechanism is JavaScript-specific, but the frozen semantics are portable:

```text
Registration Phase precedes Restore Phase
controlled mutation APIs execute under a semantic-write exclusion domain
forbidden mutation fails before side effect
candidate state commits only after complete migration and validation
```

A Native Kernel may implement the exclusion domain with a transaction phase flag, capability mask, lock, isolated worker, WASM boundary or IPC provider. It must preserve the same authority ordering and stable failure result.

## Regression closure

The architecture Smoke and Jest regression cover:

1. fresh empty Registry import of an unknown Component type;
2. imported compatibility Descriptor retains private implicit identity;
3. a compatible real owner can claim the type afterward;
4. Scene System publishes Type Registration before Runtime Model;
5. a dependent module registers Descriptor v2 and migration `1 → 2` before initial restore;
6. initial stored v1 data restores as v2;
7. dependent `completeEnable` observes the restored Runtime Model;
8. project `deserializeProject` observes the restored Runtime Model;
9. migration attempts to create a node in the active Graph;
10. migration attempts public Model mutation;
11. migration attempts Descriptor registration;
12. migration attempts migration unbinding;
13. caught forbidden mutations still invalidate the migration;
14. failed import leaves Graph export, Descriptor list and migration list deeply equal to their pre-import state;
15. all architecture gates from `0008.7.3` through `0008.9.4` remain passing.

## Final state

```text
Fresh Unknown-type Authority:       Frozen
Migration Bootstrap Ordering:       Frozen
Registration → Restore Phase:       Frozen
API-level Migration Isolation:      Frozen
Live-object Migration Isolation:    Frozen by 0008.9.4.1.1
Registry Clone Guard Domain:        Frozen
Failed Migration State Equivalence: Passed

TASK 0008.9.4.1.4
Migration Runtime Governance:       Frozen

TASK 0008.9.4
Component Schema Contract:          Frozen
```
