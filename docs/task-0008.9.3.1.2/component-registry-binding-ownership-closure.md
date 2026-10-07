# 0008.9.3.1.2 Component Registry Binding Ownership Closure

Status: Implemented / Component Contract Frozen

## Purpose

Close the remaining binding-ownership gap in which ordinary local code could replace
`RuntimeNodeGraph.componentTypeRegistry` as a writable field and detach the Graph from the Registry whose
Cardinality authority its existing Components had captured.

This closure does not change Runtime Node persistent format version 1, Runtime Component contract version 1,
or Runtime Node public API contract 1.3.1.

## Frozen invariant

For every live `RuntimeNodeGraph`:

```text
Graph Registry Binding
    is owned by RuntimeNodeGraph
    is not directly replaceable
    has exactly one active Graph usage resolver
```

At every observable point:

```text
Component.cardinality
=
Graph.componentTypeRegistry.get(Component.typeId).cardinality
```

Replacing the Registry object cannot be used to bypass Descriptor transition and in-use rules.

## Binding storage

The active Component Type Registry reference is stored in a module-private `WeakMap`. The public
`componentTypeRegistry` property remains enumerable and readable for existing Registry operations, but is a
non-configurable accessor. Direct assignment throws:

```text
RUNTIME_COMPONENT_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN
```

Because the property is non-configurable, `Object.defineProperty()` cannot replace or shadow the binding.

## Native replacement authority

Shadow Graph adoption uses `_replaceComponentTypeRegistry()` with a module-private authority token that is never
exported. Calling the method from ordinary local code without that token is rejected with the same replacement
forbidden error.

Before any internal replacement, every currently owned Component is checked against the target Registry. A missing
Descriptor or Cardinality mismatch is rejected before the old usage resolver is unbound.

The successful replacement sequence is synchronous and rollback-safe:

```text
validate target Registry
→ unbind old usage resolver
→ replace private Registry reference
→ bind new usage resolver
→ rollback old binding if binding fails
```

## Graph adoption

`_adoptGraph()` no longer assigns `componentTypeRegistry` directly. It:

1. transfers the old node collection to an isolated cleanup Graph bound to the old Registry;
2. replaces the active Graph Registry through the private authority path;
3. adopts and rebinds the shadow Graph node collection;
4. removes the shadow Graph resolver;
5. disposes the isolated old Graph and releases its old Registry resolver.

After adoption, the active Registry has one resolver for the active Graph, while the previous Registry and disposed
shadow Graph retain no stale resolver.

## Regression requirements

The dedicated smoke and Jest regression cover:

1. direct assignment replacement with no side effects;
2. direct invocation of the internal-looking replacement method without authority;
3. preservation of the original Registry resolver after rejected replacement;
4. successful internal Registry replacement during Import / Graph adoption;
5. Cardinality transition guard after adoption;
6. Export → Import → Export equivalence;
7. resolver release after Graph disposal;
8. non-configurable and enumerable property semantics.
