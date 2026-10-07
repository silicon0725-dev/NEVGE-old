# 0008.9.3.1 Component Identity, Cardinality and Persistence Closure

Status: Implemented / Closure completed by 0008.9.3.1.1

## Purpose

Close the remaining semantic gaps discovered after 0008.9.3 without changing Runtime Node persistent format version 1 or the frozen public method surface.

## Closed invariants

### Identity

`id`, `typeId`, and `schemaVersion` are immutable Runtime identity fields. `ownerId` is held by the internal ownership lifecycle and cannot be assigned by callers. A Component instance is sealed after construction.

### Cardinality

Cardinality is owned by `RuntimeComponentTypeDescriptor`:

```text
one  → at most one component of the type on a Node
many → multiple ComponentIds of the type may coexist on a Node
```

The format-v1 `allowMultiple` field is derived from the descriptor and exists only as a compatibility projection. Public callers cannot supply it.

The initial 0008.9.3.1 implementation still allowed a Descriptor Cardinality transition after instances had already captured the previous projection. Task 0008.9.3.1.1 closes that transition boundary by rejecting Cardinality changes and Descriptor unregister while the type is in use, and by revalidating preconstructed Components at Container insertion.

### Persistence

Canonical records contain only the frozen Component fields and optional namespaced `extensionData`. Unknown legacy top-level fields are moved once to:

```text
extensionData.ngvge.compat.legacy-component-record
```

Canonical Export → Import → Export must be deeply equal.

### Mutation safety

Component data patches are applied using prepare / validate / replace. Invalid candidates do not alter live data. `__proto__`, `prototype`, and `constructor` keys are rejected recursively.

### Capability boundary

Component Type Descriptor registration belongs to the restricted Runtime Node Type Registration capability. The ordinary Runtime Node public capability retains the same method surface.
