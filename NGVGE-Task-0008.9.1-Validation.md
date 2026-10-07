# NGVGE Task 0008.9.1 — Runtime Node API Freeze Validation

## Status

**Implemented and validated with the dependency-free validation suite.**

## Baseline

- Input: `scratch-gui-main-task-0008.8-scene-graph-persistence-review.zip`
- Input SHA-256: `fa2693cc9928ac6752cee82fa52cb05e35634202e88ecfc0e5d5c95cecd72517`
- Scene System version before: `0.8.0`
- Scene System version after: `0.8.9`
- Runtime Node persistent format: `1`
- Runtime Node public API version: `1.1`

## Frozen public boundary

The capability now exposes a frozen, machine-readable API contract through:

```js
runtimeNodeModel.apiVersion;
runtimeNodeModel.getApiContract();
```

Canonical snapshot queries:

- `getNodeSnapshot(nodeId)`
- `getComponentSnapshot(nodeId, componentId)`
- `getSceneSnapshot(sceneId)`

Canonical mutations added in this task:

- `patchComponent(nodeId, componentId, patch, mutationContext)`
- `reorderChild(nodeId, index, mutationContext)`

Compatibility aliases retained:

- `getNode`
- `getComponent`
- `patchComponentData`
- `renameNode`

New first-party code in Scratch Adapter, Project Inspector and Project Explorer uses the canonical snapshot API.

## API guarantees validated

- capability object and contract are frozen;
- query, mutation and lifecycle method lists are frozen;
- public snapshots are deeply frozen plain objects;
- node metadata, component arrays and component data cannot be modified through returned snapshots;
- creation and component attachment return plain frozen views, not Runtime instances;
- the capability does not expose `graph` or `typeRegistry` properties;
- explicit child reordering changes sibling order without changing NodeId or parent identity;
- Scene snapshots contain a frozen root and frozen scene-scoped node views;
- export/import preserves NodeId, parentId and component instance ID;
- Scene System publishes `ngvge.runtime-node-model@1.1` through the capability registry.

## Regression validation executed

```text
NGVGE 0008.7.3 conformance smoke passed.
NGVGE 0008.8 scene graph persistence smoke passed.
NGVGE 0008.9.1 Runtime Node API Freeze smoke passed.
NGVGE foundation extension validation passed.
```

The 0008.7.3 validation confirms Scratch binding migration, scene isolation and binding ownership remain intact. The 0008.8 validation confirms strict project persistence and save-close-reconstruct identity behavior remain intact.

## Static validation executed

- TypeScript parser: 12 changed JavaScript/JSX files, 0 parse diagnostics;
- `node --check` on changed CommonJS/runtime scripts, 0 syntax errors;
- file diff: 4 added, 11 changed, 0 removed;
- EXT-0001 foundation extension files retained and validated.

## Changed files

- `docs/TASK-0008.9.1-RUNTIME-NODE-API-FREEZE.md`
- `scripts/validate-ngvge-task-0008.9.1.js`
- `src/lib/runtime-nodes/runtime-node-api-contract.js`
- `test/unit/lib/runtime-nodes/runtime-node-api-freeze.test.js`
- `docs/ngvge/runtime-node-model.md`
- `docs/ngvge/scratch-sprite-node-adapter.md`
- `scripts/validate-ngvge-task-0008.7.3.js`
- `src/components/project-explorer/project-explorer.jsx`
- `src/components/project-inspector/project-inspector.jsx`
- `src/lib/runtime-nodes/constants.js`
- `src/lib/runtime-nodes/index.js`
- `src/lib/runtime-nodes/runtime-node-graph.js`
- `src/lib/runtime-nodes/runtime-node-model-service.js`
- `src/lib/scene-system/module-definition.js`
- `src/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service.js`

## Scope boundaries

This task does not implement:

- the 0008.9.2 lifecycle state-machine review;
- Component Schema Registry;
- complete Runtime Graph Validator;
- ARC-C001 protocol commands;
- removal of internal RuntimeNodeGraph classes used by the model implementation and tests.

## Dependency limitation

The supplied project contains no root `node_modules` directory. Full Jest, ESLint and Webpack execution was therefore not available. A Jest unit test was added at:

```text
test/unit/lib/runtime-nodes/runtime-node-api-freeze.test.js
```

It must be run in a dependency-complete development environment. No claim is made that the complete repository test or production build succeeded in this container.
