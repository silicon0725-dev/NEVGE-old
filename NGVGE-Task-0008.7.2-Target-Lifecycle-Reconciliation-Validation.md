# 0008.7.2 Target Lifecycle Reconciliation — Validation

## Scope

The adapter now follows Scratch VM target lifecycle changes automatically. It preserves the stable `bindingId` and Runtime Node ID introduced by 0008.7.1 while treating Scratch `target.id` as transient runtime state.

## Runtime API

Added:

- `reconcileScene(sceneId, options)`
- `reconcileActiveScene(options)`
- `scheduleReconcile(reason, options)`
- `startLifecycleTracking()`
- `stopLifecycleTracking()`

`establishBindings(sceneId)` remains as a compatibility alias and performs a reconciliation that preserves unmatched bindings.

## Event sources

- Scratch Runtime `TARGETS_UPDATE`
- Scratch Runtime `PROJECT_LOADED`
- Scene Data Model active-scene changes

Repeated events are coalesced through a scheduled single-flight reconciliation. Generation checks prevent stale results from replacing a newer active scene.

## Classification

- `bound`: original Sprite target is available in the active scene.
- `offline`: binding belongs to a scene that is not currently active.
- `missing`: active scene is loaded, but the stored binding cannot be matched during a non-destructive reconciliation.
- `reconciling`: represented through `getStatus().reconciling` while work is pending or running.
- `error`: reported through the adapter error event/status without exposing mutable targets.

## Verified smoke scenarios

1. Initial original Sprite is bound; Stage and clones are excluded.
2. Adding an original Sprite and emitting `TARGETS_UPDATE` creates one new binding and Runtime Node.
3. Removing that target and emitting `TARGETS_UPDATE` removes its Sidecar record and Runtime Node.
4. Replacing a target with a new runtime ID and emitting `PROJECT_LOADED` preserves `bindingId` and Runtime Node ID.
5. Changing the active scene marks the previous scene's binding `offline` and binds the new scene's Sprite.
6. Disposing the adapter removes lifecycle listeners and prevents future target events from mutating the graph.
7. Reconciliation failure attempts to restore the prior Runtime Node snapshot and binding Sidecar.

Custom smoke result:

```text
smoke 872 passed
```

## Static validation

- `node -c` passed for the modified adapter service.
- `node -c` passed for the Scene System module definition.
- ZIP integrity was checked after packaging.

## Environment limitation

The supplied project does not include the root `node_modules`, so the complete Jest, ESLint and Webpack suites were not executed in this environment. A Jest lifecycle regression test is included in the patch.
