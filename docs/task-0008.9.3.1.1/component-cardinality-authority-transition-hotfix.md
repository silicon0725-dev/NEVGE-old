# 0008.9.3.1.1 Component Cardinality Authority Transition Hotfix

Status: Implemented / Cardinality Authority Transition Passed

## Purpose

Close the remaining authority transition gap in which a `RuntimeComponent` retained the Cardinality projection captured at construction after its `RuntimeComponentTypeDescriptor` was replaced or unregistered.

The hotfix does not change Runtime Node persistent format version 1, Runtime Component contract version 1, or the frozen Runtime Node public method surface.

## Frozen invariant

At every observable point in a live Graph:

```text
Component.cardinality
=
Graph Component Type Descriptor.cardinality
```

For one `typeId`, the Graph cannot contain Components carrying different Cardinality semantics.

## Transition policy

While at least one Component of a `typeId` is attached anywhere in the Graph:

- replacing its Descriptor with a different Cardinality is rejected with `RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE`;
- unregistering its Descriptor is rejected with `RUNTIME_COMPONENT_TYPE_DESCRIPTOR_IN_USE`;
- replacing an implicit Descriptor with an explicit Descriptor of the same Cardinality remains permitted;
- replacing an explicit Descriptor with another same-Cardinality Descriptor remains permitted subject to the existing ownership rules.

After all instances are removed, unregister and registration with another Cardinality are permitted.

## Preconstructed Component boundary

`RuntimeComponentContainer.add()` never trusts Cardinality stored on a preconstructed `RuntimeComponent`.

Before Container mutation it resolves the current Graph Descriptor and verifies:

```text
component.cardinality === descriptor.cardinality
```

A mismatch is rejected with `RUNTIME_COMPONENT_CARDINALITY_CONFLICT`. The Component remains unowned in lifecycle state `created`, and the Container remains unchanged.

## Registry authority binding

Every live `RuntimeNodeGraph` binds an instance-usage resolver to its Component Type Registry. The Registry aggregates usage across all Graphs sharing that Registry, so direct local calls to `register()` and `unregister()` are subject to the same in-use rules as the restricted Type Registration capability.

The binding is transferred safely during Shadow Graph adoption and removed during Graph disposal.

Direct ownership of the Graph-to-Registry reference is closed by Task 0008.9.3.1.2.

## Regression requirements

The dedicated smoke and Jest regression cover:

1. implicit `one` to explicit `many` with a live instance;
2. explicit `many` to explicit `one` with one live instance;
3. unregister followed by different-Cardinality registration;
4. a preconstructed Component whose Cardinality conflicts with the Graph Descriptor;
5. direct local Registry mutation bypass attempts.

Successful public mutations assert both `applied === true` and `persisted === true`. Every scenario finishes with a deeply equal Export → Import → Export round trip.
