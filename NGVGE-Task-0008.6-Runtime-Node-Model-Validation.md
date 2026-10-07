# NGVGE Task 0008.6 Runtime Node Model — Validation

## Scope

This validation covers the in-memory Runtime Node Model introduced through the Scene System first-party module.

## Structural checks

- Added `src/lib/runtime-nodes/` as an isolated runtime layer.
- Existing `src/lib/project-nodes/` authoring data remains unchanged.
- Scene System manifest now advertises `ngvge.runtime-node-model`.
- Scene System version increased from `0.5.3` to `0.6.0`.
- No SB3 snapshot schema or Scene Data Model schema version was changed.

## Verified behavior

### Ownership

- A protected `GlobalRoot` is created once.
- Every Scene Data Model record receives a protected `SceneRoot`.
- Global nodes default under `GlobalRoot`.
- Scene nodes default under their own `SceneRoot`.
- Cross-scope parenting is rejected.
- Cross-scene parenting is rejected.
- Cyclic parenting is rejected.

### Node families

- `ngvge.node`
- `ngvge.node2d`
- `ngvge.service-node`
- hidden `ngvge.global-root`
- hidden `ngvge.scene-root`

`Node2D` contains no transform implementation in this task.

### Lifecycle and components

- Structural states: created, attached, ready, detached, destroyed.
- Enabled state propagates through `activeInHierarchy`.
- Components receive attach, ready, enable, disable, detach and destroy hooks.
- Subtree destruction removes descendants and components.

### Scene synchronization

- Adding a scene creates a root.
- Renaming a scene updates the root name.
- Deleting a scene destroys its runtime subtree.
- Changing `activeSceneId` changes which scene root is active.

### State transfer

- Runtime node trees export to a versioned serializable state.
- Exported trees can be imported with hierarchy and component data restored.
- Scoped node references resolve only when scope and scene identity match.

### Module lifecycle

- Enabling Scene System provides `ngvge.runtime-node-model@1`.
- Disabling Scene System revokes the capability.
- A disposed service rejects later operations.

## Commands executed

- `node --check` over all new runtime-node source files.
- `node --check` over all added and modified unit tests.
- Direct Node smoke tests for hierarchy, components, references, export/import and disposal.
- Module-manager smoke test with a minimal local JSZip stub because the supplied project archive does not include `node_modules`.

## Test-suite limitation

The supplied full project does not include `node_modules`. Full Jest, ESLint and Webpack execution was therefore not available in this environment. Jest test files were added for execution in the normal repository development environment.
