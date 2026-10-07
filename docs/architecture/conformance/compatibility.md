# ARC-C001 Compatibility Conformance

**Active phase:** ARC-C001.1-G｜Scratch Adapter Boundary Gate  
**Enforcement:** active / manual  
**Parent authority:** ARC-0001 Kernel Independence Contract

## Purpose

This gate turns the historical `0008.7.3 Scratch Adapter Boundary Stabilization` evidence into a durable ARC-C001 compatibility boundary.

The gate does **not** require NGVGE to stop using Scratch during the Scratch-hosted stage. It requires Scratch-specific execution identity and mutable objects to terminate inside the compatibility adapter instead of becoming NGVGE semantic identity, persistent data, Core protocol or Runtime semantic ownership.

## Required invariants

1. User-visible semantic Sprite ownership uses `ngvge.sprite-node`; `ngvge.scratch-sprite-node` remains legacy migration input only.
2. `BindingId` and `NodeId` are stable semantic identities and are not derived from the volatile Scratch target runtime identity.
3. `targetRuntimeId` is runtime-only compatibility state and must not enter persistent Scratch binding records.
4. A public binding view may expose the opaque runtime target id for adapter diagnostics, but must never expose the live mutable Scratch Target object.
5. Scratch binding persistence remains explicitly versioned and fails closed when volatile runtime identity is present.
6. Target lookup is Scene-scoped; the same volatile target id must not alias bindings across inactive/active scenes.
7. Editor tree projection is rooted in the semantic owner node and must ignore stale bindings without a live semantic owner.
8. Deleting a semantic Scratch-backed owner must reconcile Target, binding sidecar and Runtime subtree according to the declared destroy policy.
9. Adapter lifecycle disposal must release tracking/subscriptions and reject use after disposal.
10. `src/core`, Runtime Node semantic implementation and generic persistence implementation must not directly depend on the Scratch adapter or carry Scratch-specific runtime representation.

## Active implementation

- Gate: `tools/conformance/check-scratch-adapter-boundary.js`
- Gate self-test: `tools/conformance/check-scratch-adapter-boundary.self-test.js`
- Historical semantic corpus retained: `scripts/validate-ngvge-task-0008.7.3.js`
- Unit corpus:
  - `test/unit/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service.test.js`
  - `test/unit/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-lifecycle.test.js`
  - `test/unit/lib/scratch-sprite-adapter/scratch-sprite-tree-projection.test.js`
- Permanent regression: `test/regression/contracts/scratch-adapter-boundary.js`
- Entry point: `test:conformance:scratch-adapter-boundary`
- Cumulative phase entry point: `test:conformance:c001.1-g`

## Static sensitive zones

The active gate scans JavaScript/TypeScript source under:

```text
src/core
src/lib/runtime-nodes
src/lib/persistence
```

It rejects direct Scratch dependency leakage, `targetRuntimeId` leakage and Scratch-specific compatibility representation inside these semantic/persistence zones.

## Runtime boundary checks

The gate independently verifies that:

- `toPersistentBinding()` drops `targetRuntimeId` and live Target objects;
- `normalizePersistentBinding()` cannot restore runtime-only target/lifecycle state from persistent data;
- `toBindingView()` is immutable and Target-object-free;
- persistent binding validation rejects `targetRuntimeId` explicitly;
- tree projection ignores stale bindings without semantic owner nodes.

The historical `0008.7.3` validator and adapter unit suites remain supporting behavior corpus for scene scope, deletion ownership, target recreation and lifecycle cleanup. They are not the sole authority of the new gate.

## Scope deliberately deferred

C001.1-G does **not** implement:

- Scratch/native semantic trace comparison;
- SB3 compatibility certification as a whole;
- generic Capability lifecycle enforcement;
- Authority projection loop prevention;
- Transform2D Scratch Compatibility Authority wiring;
- native backend replacement tests.

Those remain later ARC-C001 / 0009 responsibilities.
