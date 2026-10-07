# 0008.9.3 Component Boundary Freeze

Status: Implemented / Component Contract Frozen after 0008.9.3.1.2

## Frozen semantic boundary

A Runtime Component is an owned semantic record. It is not an ECS handle, backend object, Scratch object, or lifecycle hook closure.

### Stable identity

- `ComponentId` is stable and unique within its owner Node.
- Portable references use `(NodeId, ComponentId)`.
- `id`, `typeId`, and `schemaVersion` are non-writable and non-configurable for the lifetime of a component instance.
- `ownerId` is runtime-derived ownership state stored privately by the Component Ownership lifecycle.
- Runtime Component instances are sealed so identity cannot be shadowed with `defineProperty` or prototype replacement.

### Cardinality authority

Cardinality belongs to the Component Type Descriptor, never to an individual Component instance.

```text
RuntimeComponentTypeDescriptor
├── typeId
├── schemaVersion
├── cardinality: one | many
└── ownerModuleId
```

The format-v1 `allowMultiple` field remains a compatibility projection:

```text
allowMultiple = descriptor.cardinality === many
```

It is not accepted by public component creation and cannot be used by one instance to bypass a type-level `one` constraint.

Descriptor authority is stable for the full lifetime of owned instances:

- Cardinality cannot change while any Component of the `typeId` is attached anywhere in the Graph.
- A Descriptor cannot be unregistered while any Component of the `typeId` is attached.
- A preconstructed `RuntimeComponent` is revalidated against the Graph Descriptor before Container insertion.
- Descriptor replacement with the same Cardinality remains available, including implicit-to-explicit ownership promotion.

Registry binding is owned by `RuntimeNodeGraph` for the full Graph lifetime:

- `componentTypeRegistry` is readable but cannot be assigned or redefined by ordinary local code.
- Native Shadow Graph adoption replaces the binding only through a module-private authority path.
- Registry replacement transfers usage-resolver ownership and cannot leave the old Registry bound or the new Registry untracked.
- The internal replacement path validates current Component projections against the target Registry before mutation.

### Persistent fields

Canonical Component records contain only:

- `id`
- `typeId`
- `schemaVersion`
- `allowMultiple` — format-v1 compatibility projection
- `enabled`
- `data`
- optional `extensionData`

Legacy unknown top-level fields are normalized once into:

```text
extensionData.ngvge.compat.legacy-component-record
```

After canonicalization, Export → Import → Export is stable.

### Runtime-only fields

- `ownerId`
- `state`
- `activeInHierarchy`
- ready flags
- provider hooks and provider resources
- Runtime/Backend handles

### Ownership

Node hierarchy detach and Component ownership detach are separate domains. Detaching a Node from its parent disables its components but does not remove their owner relationship. Component ownership detach occurs only during component removal, replacement, or owner destruction.

### Mutation

Public callers may mutate Component data only through `patchComponent`, `setComponentData`, and `setComponentEnabled`. Component data patches are validated as a complete candidate before replacing live data. Rejected patches leave Runtime data unchanged. Dangerous prototype keys are rejected.

Public creation accepts only `id`, `typeId`, `schemaVersion`, `enabled`, and `data`. It rejects instance-level cardinality, `persistentExtras`, arbitrary top-level persistence fields, and Backend handles.

### Provider boundary

Lifecycle hooks and Provider resources are local-host implementation details. They never enter portable Component records, snapshots, or project persistence. Component Type Descriptor registration is a restricted-host capability.
