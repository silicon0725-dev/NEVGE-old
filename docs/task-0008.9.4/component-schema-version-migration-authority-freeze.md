# 0008.9.4 Component Schema Version and Migration Authority Freeze

Status: Implemented / Schema Authority Frozen by `0008.9.4.1.6`; Error projection clarified by `0008.9.5`  
Parent: `0008.9 Runtime Node Model Freeze`  
Depends on: `0008.9.3 Component Boundary Freeze` through `0008.9.3.1.2`  
Scene System: `0.8.9.6.1.1`  
Runtime Node public API: `1.3.1` unchanged  
Runtime Node Type Registration capability: `1.2`  
Runtime Node persistent format: `1` unchanged  
Runtime Component contract: `ngvge.runtime-component@1` unchanged

## Purpose

Freeze one semantic boundary:

```text
For every explicitly registered Component typeId,
RuntimeComponentTypeDescriptor.schemaVersion
is the sole authority for the current writable schema version.
```

An older persistent record can become live only after a complete owner-authorized migration chain has produced the Descriptor's current version. A newer known record is never silently downgraded or overwritten.

This task does not define a rich property-schema language, online migration of already attached Components, or general command transaction rollback.

## Frozen authority relation

For an explicit type:

```text
Component.schemaVersion
=
Graph.componentTypeRegistry.get(Component.typeId).schemaVersion
```

The relation is enforced at every entry boundary:

- public Component creation;
- local Component creation;
- preconstructed `RuntimeComponent` insertion;
- persistent import;
- Graph adoption and Registry replacement;
- implicit-to-explicit Descriptor promotion.

Unknown types remain opaque compatibility records until an explicit owner Descriptor is registered. Fresh import preserves this status through the private implicit-authority path defined by `0008.9.4.1`.

## Creation semantics

For an explicit Descriptor:

```text
schemaVersion omitted
→ derive Descriptor.schemaVersion

schemaVersion supplied
→ treat as equality assertion
→ reject when unequal
```

A mismatch is rejected before construction with:

```text
RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT
```

The engine preserves whether `schemaVersion` was actually supplied through module-private `WeakMap` metadata. This prevents repeated normalizer passes from turning an omitted field into a false explicit assertion while keeping internal metadata out of portable objects.

The public API still accepts the field for compatibility, but callers cannot use it to select an arbitrary writable version.

## Descriptor transition rules

A same-version replacement remains subject to existing owner and Cardinality rules.

A version increase is rejected while any live instance exists in any Graph bound to the shared Registry:

```text
RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE
```

Usage aggregation includes every observed instance schema version across shared Graphs.

A version decrease is rejected even with no live instances:

```text
RUNTIME_COMPONENT_SCHEMA_DOWNGRADE_FORBIDDEN
```

Live bulk migration is intentionally not implemented in this task.

## Implicit Descriptor ownership

Implicit compatibility status is no longer inferred from a spoofable `ownerModuleId` prefix. It is held in a module-private `WeakMap<Registry, Set<typeId>>` and can be created only through the Registry's internal implicit authority path.

Consequences:

- an owner named `ngvge.runtime.compat.*` does not become implicit merely by naming convention;
- mixed opaque instance versions block promotion to an incompatible explicit Descriptor;
- a compatible promotion removes implicit status and activates normal Schema Authority;
- ordinary migration bindings cannot be attached to opaque implicit types.

## Migration authority

The existing `RuntimeComponentTypeRegistry` remains the only semantic authority. No second Schema Registry is introduced.

A migration binding supplies one local implementation edge:

```text
(typeId, N) → (typeId, N + 1)
```

Only the current Descriptor owner may bind, replace or unbind an edge. Relevant errors include:

```text
RUNTIME_COMPONENT_MIGRATION_DESCRIPTOR_MISSING
RUNTIME_COMPONENT_MIGRATION_DESCRIPTOR_IMPLICIT
RUNTIME_COMPONENT_MIGRATION_OWNER_MISMATCH
RUNTIME_COMPONENT_MIGRATION_ALREADY_BOUND
RUNTIME_COMPONENT_MIGRATION_VERSION_INVALID
```

Migration versions must be explicitly supplied positive integers. Missing versions are not defaulted to version `1`.

Migration callbacks and implicit-type authority storage are held in module-private WeakMaps. They are not exposed as ordinary Registry fields and never enter project persistence.

## Restricted Host capability

`ngvge.runtime-node-type-registration@1.2` adds:

```text
bindComponentMigration
unbindComponentMigration
listComponentMigrations
```

Migration callbacks remain local-only resources. `listComponentMigrations()` returns portable edge metadata without callback references.

The portable Runtime Node Model public surface remains unchanged at `1.3.1`.

## Import pipeline

Known explicit records follow this sequence:

```text
clone and normalize persistent record
→ resolve complete contiguous path
→ execute every migration on detached portable candidates
→ validate each result
→ assign Engine-controlled next schemaVersion
→ build candidate Graph
→ validate Registry compatibility
→ adopt only after total success
```

The migration callback receives detached data and frozen context:

```js
{
    fromVersion,
    toVersion,
    typeId
}
```

Allowed migration output is limited to:

```js
{
    data,
    extensionData?
}
```

A provider cannot inject or modify Component identity, ownership, Cardinality, enabled state, lifecycle state or arbitrary top-level persistent fields.

## Migration path and result failures

The migration path is deterministic and contiguous. Arbitrary graph routing and skip edges are not supported.

Missing edge:

```text
RUNTIME_COMPONENT_MIGRATION_PATH_MISSING
```

Provider exception:

```text
RUNTIME_COMPONENT_MIGRATION_FAILED
```

Non-portable or authority-injecting result:

```text
RUNTIME_COMPONENT_MIGRATION_RESULT_INVALID
```

Every failure is collected as an import issue and rejects the candidate Graph. The active Graph remains unchanged. `0008.9.4.1` excludes controlled Registry, Graph and public-Model mutation APIs; `0008.9.4.1.2` extends the exclusion boundary to direct writes through retained live Node and Component references.

## Future-version preservation

For a known explicit type, a persistent record newer than the current Descriptor is rejected with:

```text
RUNTIME_COMPONENT_SCHEMA_VERSION_UNSUPPORTED
```

The Runtime Node Model records:

```text
persistenceReadOnly = true
persistenceReadOnlyReason = component-schema
unsupportedComponentSchemas = [...issues]
```

While protected:

- Runtime mutations are rejected with `RUNTIME_NODE_STATE_READ_ONLY`;
- `persistState()` does not overwrite the stored Runtime Node payload;
- the original future-version record remains available for a compatible future Runtime.

Unknown types are different: they remain opaque and round-trip their observed `schemaVersion`, `data` and extension payload without owner-invented migration.

## Graph adoption and Registry compatibility

Before any Resolver transfer or binding mutation, Graph adoption checks every existing Component against the target Registry:

```text
Component.cardinality   = Descriptor.cardinality
Component.schemaVersion = Descriptor.schemaVersion
```

Schema mismatch rejects adoption before side effects with:

```text
RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT
```

A successful import/adoption preserves the Registry Binding Ownership closure from `0008.9.3.1.2`. The adopted Registry retains one active Graph usage resolver, and disposal releases it.

## Persistent boundary

Persistent format version remains `1`:

```text
id
typeId
schemaVersion
allowMultiple        derived compatibility projection
enabled
data
extensionData?       namespaced
```

Migration may transform only `data` and `extensionData`. The resulting `schemaVersion` is assigned by the Engine according to the executed edge.

Runtime-only state includes:

- migration callbacks and edge implementation objects;
- implicit Descriptor authority state;
- migration candidates and execution context;
- migration traces and validation caches;
- Registry, Graph and Runtime instances;
- capability tokens and backend handles.

## Atomicity boundary

This task freezes Schema Operation Atomicity only. Its migration execution environment is completed by `0008.9.4.1` and `0008.9.4.1.2`, which add Registration → Restore ordering, a shared Registry-lineage guard, live-object write isolation and enable-batch recovery.

On migration, validation or adoption-preflight failure:

- no live Component is created or modified;
- no Descriptor is changed;
- no partial version advance is persisted;
- no Registry Resolver is transferred;
- no successful attach or ready lifecycle event is published for the rejected candidate;
- the original stored payload is preserved.

This does not eliminate the general mutation result state `applied=true, persisted=false`. Cross-system commit, observer publication and project-write rollback remain assigned to `ARC-C001 Transaction Gate` or a dedicated later task.

## Native Kernel equivalence

The frozen semantics are implementation-independent:

- Descriptor and migration edge metadata are plain data;
- project records contain no JavaScript callback;
- migration input and output are portable plain data;
- edge order is deterministic and contiguous;
- errors use stable codes and portable details;
- JavaScript callbacks are one current Host implementation, not the contract;
- a Native Kernel may use native functions, WASM or IPC providers while preserving identical authority checks and import outcomes.

## Regression closure

The architecture Smoke and Jest regression cover:

1. omitted version derivation;
2. matching and mismatching explicit assertions;
3. preconstructed Component rejection;
4. live schema transition lock;
5. shared Registry usage aggregation;
6. downgrade rejection;
7. owner-bound migration registration;
8. private migration/implicit authority storage;
9. complete `1 → 2 → 3` migration;
10. missing, throwing and invalid migration rejection;
11. future-version read-only preservation;
12. unknown opaque round-trip;
13. mixed opaque-version promotion rejection;
14. spoofed compatibility-owner handling;
15. adoption preflight before Resolver transfer;
16. post-adoption schema guard;
17. canonical Export → Import → Export equality;
18. Graph disposal and Resolver release;
19. restricted capability version and method surface;
20. all historical architecture gates from `0008.7.3` through `0008.9.3.1.2`;
21. fresh-Registry unknown import retains implicit authority;
22. owner registration and migration binding precede initial restore;
23. migration reentrant semantic writes are rejected before side effects;
24. failed migration preserves Graph and Registry state equivalence.

## Final state

```text
Schema Version Authority:          Frozen
Public Version Injection:          Closed
Descriptor Version Transition:     Frozen
Migration Ownership:               Frozen
Migration Path Determinism:        Frozen
Import Migration Atomicity:        Frozen
Future-version Preservation:       Frozen
Registry/Adoption Compatibility:   Frozen
Canonical Round-trip:              Passed
Native-portable Contract:          Frozen
Migration Bootstrap Ordering:       Frozen by 0008.9.4.1
API-level Migration Isolation:      Frozen by 0008.9.4.1
Live-object Migration Isolation:    Frozen by 0008.9.4.1.1
Enable-batch Recovery:              Frozen by 0008.9.4.1.1
Completion / Observer Governance:    Frozen by 0008.9.4.1.2
Lifecycle Mutation Authority:        Frozen by 0008.9.4.1.3
Host / Client Authority Surface:     Frozen by 0008.9.4.1.4
Deferred Authority Lifetime:           Frozen by 0008.9.4.1.5
Cross-boundary Exception Authority:    Frozen by 0008.9.4.1.6
Runtime Error / Diagnostic Precision:  Frozen by 0008.9.5
```
