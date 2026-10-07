# TASK 0008.9.4 — Component Schema Version and Migration Authority Freeze

Status: Proposed / Pre-implementation boundary definition  
Parent: `0008.9 Runtime Node Model Freeze`  
Depends on: `0008.9.3 Component Boundary Freeze` completed by `0008.9.3.1.2`  
Does not implement: ARC-C001 command transactions, general data-schema language, scheduler, Transform, Backend binding

## 1. Single frozen semantic boundary

For every explicitly registered Runtime Component `typeId`, the Component Type Descriptor is the sole authority for the **current writable schema version**.

```text
RuntimeComponentTypeDescriptor.schemaVersion
    = current writable version for typeId

RuntimeComponent.schemaVersion
    = immutable version of the Component data currently held by that instance
```

A Component may become live only when its data has been normalized to the Descriptor's current schema version. Older persistent records must pass through a complete, owner-authorized migration chain before construction. Newer records must never be silently downgraded or overwritten.

The task freezes **version authority and migration semantics**. It does not freeze a general-purpose declarative data-schema language.

## 2. Why this is the next boundary

`0008.9.3` froze Component identity, canonical persistence, Cardinality authority, Descriptor in-use protection and Registry binding ownership. The remaining `schemaVersion` field is immutable on instances but is not yet an enforced authority relationship:

- public creation can currently claim a version independently of a registered Descriptor;
- import records are normalized but not migrated;
- Descriptor schema-version replacement has no in-use transition rule;
- there is no owner-bound migration chain;
- future-version Component data has no explicit preservation policy.

Therefore `schemaVersion` is currently stable metadata, not yet a frozen schema contract.

## 3. Dependencies on the frozen 0008.9.3 contract

This task relies on the following invariants and must not weaken them:

### Identity

- `ComponentId`, `typeId` and `schemaVersion` are immutable for one Component instance.
- Migration creates a prepared replacement record or replacement instance; it never mutates identity fields in place.
- `ownerId` remains Runtime-derived and is never supplied by migration code.

### Canonical persistence

- Persistent Component records remain limited to the format-v1 canonical fields.
- Migration may transform only `data` and namespaced `extensionData`.
- Migration cannot introduce arbitrary top-level persistent fields.
- Successful migration must preserve Export → Import → Export canonical equivalence.

### Descriptor authority

- `schemaVersion`, like Cardinality, belongs to the Component Type Descriptor.
- A Component instance cannot override the registered Descriptor's current writable version.
- Descriptor ownership remains controlled by `ownerModuleId`.

### Registry binding ownership

- Schema authority is resolved through the Registry owned by the live Graph.
- Replacing a Registry cannot bypass schema-version compatibility checks.
- Shared Registry usage must aggregate all live Graph instances.

## 4. Authority model

`0008.9.4` introduces no second semantic Schema Registry.

```text
Component Type Descriptor
    owns current schemaVersion

Component Migration Binding
    supplies local upgrade implementation
    does not own the current version
```

The existing `RuntimeComponentTypeRegistry` remains the authority for:

- `typeId`;
- `ownerModuleId`;
- `cardinality`;
- current `schemaVersion`.

A restricted-host migration binding supplies one deterministic upgrade edge:

```text
(typeId, N) → (typeId, N + 1)
```

Only the Descriptor owner may bind or replace migration edges for that `typeId`. Migration callbacks are local Provider resources and are not portable project data.

No public Runtime Node mutation method is added. Migration registration belongs to the restricted Runtime Node Type Registration capability or a narrower internal sub-capability.

## 5. Descriptor transition rules

### Same version

Replacing an implicit or explicit Descriptor with another Descriptor carrying the same `schemaVersion` is allowed when all existing ownership and Cardinality rules pass.

### Version increase with live instances

Changing `schemaVersion` while any live Component of the `typeId` exists in any Graph bound to the Registry is rejected before Descriptor mutation:

```text
RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE
```

This is the conservative freeze-stage rule. Live bulk migration is not part of `0008.9.4`.

### Version decrease

Descriptor downgrade is rejected while the prior Descriptor exists, regardless of current instance count:

```text
RUNTIME_COMPONENT_SCHEMA_DOWNGRADE_FORBIDDEN
```

Format-v1 defines upgrade migration only. Downgrade/export-to-older-runtime belongs to a future compatibility task.

### Descriptor unregister

The `0008.9.3.1.1` in-use unregister lock remains unchanged. Migration bindings must be released atomically when their owning Descriptor is successfully unregistered.

### Registry replacement or Graph adoption

A target Registry is compatible with an existing live Component only when both are equal:

```text
Component.cardinality = Descriptor.cardinality
Component.schemaVersion = Descriptor.schemaVersion
```

A mismatch is rejected before Resolver transfer or Graph binding mutation.

## 6. Component creation rules

### Explicitly registered type

For public or local creation:

- omitted `schemaVersion` derives from the Descriptor;
- supplied `schemaVersion` must exactly equal the Descriptor;
- a mismatch is rejected before Component construction:

```text
RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT
```

The public field remains accepted for API compatibility, but it is a checked assertion, not caller authority.

### Unknown or unavailable type

An unknown type may still receive an implicit compatibility Descriptor. Its observed `schemaVersion` is preserved as opaque compatibility metadata. No migration or semantic validation is invented without an explicit owner Descriptor.

Promotion from an implicit Descriptor to an explicit Descriptor:

- same version: allowed;
- different version with live instances: rejected by the in-use transition rule;
- different version without live instances: allowed, subject to normal ownership and migration registration rules.

## 7. Import and migration semantics

For an explicitly registered `typeId`:

### Record version equals current version

The record proceeds to Component construction without migration.

### Record version is older

The importer must resolve a complete contiguous chain:

```text
recordVersion → recordVersion + 1 → ... → descriptor.schemaVersion
```

Each edge receives a detached, cloned plain-data candidate and returns a new plain-data candidate. The Engine assigns the next `schemaVersion`; migration code cannot assign identity, owner, Cardinality or lifecycle state.

Allowed migration output:

```text
{
    data,
    extensionData? 
}
```

No live Component is created until the full chain succeeds.

Missing edge:

```text
RUNTIME_COMPONENT_MIGRATION_PATH_MISSING
```

Migration failure or invalid output:

```text
RUNTIME_COMPONENT_MIGRATION_FAILED
RUNTIME_COMPONENT_MIGRATION_RESULT_INVALID
```

### Record version is newer

The importer must not downgrade, canonicalize away, or overwrite the record. Import is rejected with:

```text
RUNTIME_COMPONENT_SCHEMA_VERSION_UNSUPPORTED
```

The Runtime Node persistence controller enters read-only preservation mode for the stored Runtime Node payload until a compatible Descriptor/runtime is available. The original project payload remains untouched.

### Unknown type

Unknown types remain opaque and round-trip their data and `schemaVersion` without migration. Once an explicit Descriptor becomes available, normal version checks apply during the next controlled import/reification attempt.

## 8. Persistent and Runtime-only fields

### Persistent

No format-v1 top-level field is added.

```text
id
typeId
schemaVersion
allowMultiple          compatibility projection
enabled
data
extensionData?         namespaced only
```

Migration changes may persist only through `data`, `extensionData` and the Engine-assigned resulting `schemaVersion` in the replacement record.

### Runtime-only

The following never enter project persistence:

- migration callback functions;
- migration edge maps;
- Descriptor owner capability tokens;
- migration execution context;
- migration trace and diagnostics;
- prepared candidate records;
- validator caches;
- rollback/preflight state;
- Runtime instances, Graphs, Registries and Backend handles.

## 9. Failure atomicity

`0008.9.4` requires **schema-operation atomicity**, not full ARC-C001 command transaction atomicity.

### Required atomic boundary

The following sequence is mandatory:

```text
clone persistent record
→ resolve full migration path
→ run every migration on detached candidates
→ validate portable/canonical output
→ construct or import candidate Graph
→ only then adopt as live Runtime state
```

If any migration or validation step fails:

- no live Component data changes;
- no Descriptor replacement occurs;
- no Registry Resolver ownership changes;
- no partial schemaVersion advance is persisted;
- the original stored payload remains available for preservation;
- no successful Component lifecycle attach/ready event is published for the rejected candidate.

### Explicit non-goal

`0008.9.4` does not eliminate the existing general mutation result state:

```text
applied = true
persisted = false
```

for unrelated Node/Component mutations. Freezing cross-system mutation commit, observer publication and project-write rollback belongs to `ARC-C001 Transaction Gate` or a dedicated later Runtime task.

## 10. Native Kernel compatibility

The semantic API must remain implementation-independent:

- descriptors and migration metadata are plain data;
- project records contain no JavaScript functions;
- migration input/output is portable plain data;
- migration ordering is deterministic and contiguous;
- migration errors use stable codes and portable details;
- JavaScript callbacks are one local-host implementation of a migration Provider, not the contract itself;
- a Native Kernel may bind native functions or IPC-hosted providers while preserving the same version checks, error codes and import outcome.

The portable Runtime Node Model API surface remains unchanged. Any restricted-host capability revision must preserve the descriptor/provider split already used by Runtime Node type registration.

## 11. Minimum regression matrix

1. Known type, omitted public `schemaVersion` derives from Descriptor.
2. Known type, supplied matching version succeeds.
3. Known type, supplied mismatching version fails before construction.
4. Descriptor version increase with a live instance is rejected.
5. Shared Registry aggregates schema-version usage across multiple Graphs.
6. Descriptor downgrade is rejected.
7. Old record migrates through a complete `1 → 2 → 3` chain.
8. Missing migration edge rejects the entire import.
9. Throwing migration leaves the live Graph and stored payload unchanged.
10. Migration returning non-portable data is rejected.
11. Migration cannot inject identity, ownership, Cardinality, lifecycle or arbitrary top-level fields.
12. Future-version record enters preservation/read-only behavior and is not overwritten.
13. Unknown type remains opaque and round-trips exactly.
14. Implicit-to-explicit same-version promotion succeeds.
15. Registry replacement/adoption rejects schema-version mismatch before Resolver transfer.
16. Successful migration preserves Export → Import → Export deep equality.
17. Graph dispose releases all migration/usage bindings.
18. Existing 0008.7.3 through 0008.9.3.1.2 architecture gates remain passing.

## 12. Definition of Done

`0008.9.4` may be declared frozen only when machine checks establish:

```text
Schema Version Authority:          Passed
Public Version Injection:          Closed
Descriptor Version Transition:     Closed
Migration Ownership:               Passed
Migration Path Determinism:        Passed
Import Migration Atomicity:        Passed
Future-version Preservation:       Passed
Registry/Adoption Compatibility:   Passed
Canonical Round-trip:              Passed
Native-portable Contract:          Passed
```

## 13. Non-goals

This task does not freeze:

- a complete JSON Schema or NGVGE data-schema language;
- editor-generated Component property inspectors;
- live hot migration of attached Component instances;
- schema downgrade or export-to-older-runtime;
- multi-command transactions;
- general Runtime mutation rollback;
- undo/redo history;
- lifecycle Hook side-effect compensation;
- scheduler phases;
- Native ABI transport details;
- Transform, Renderer, Camera or Physics data.

Those must remain separate tasks so `0008.9.4` freezes one boundary only: **who owns Component schema version, and how older persistent Component data becomes valid current data before it enters the live Runtime**.
