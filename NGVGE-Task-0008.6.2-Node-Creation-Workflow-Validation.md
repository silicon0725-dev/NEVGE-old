# Task 0008.6.2 Validation

## Scope

This validation covers the native Runtime Node creation and editor workflow added on top of Task 0008.6.1.

## Changed files

- `src/components/project-explorer/project-explorer.jsx`
- `src/components/project-inspector/project-inspector.jsx`
- `src/lib/runtime-nodes/runtime-node-graph.js`
- `src/lib/runtime-nodes/runtime-node-model-service.js`
- `src/lib/scene-system/module-definition.js`
- `test/unit/components/project-explorer.test.jsx`
- `test/unit/components/project-inspector.test.jsx`
- `test/unit/lib/runtime-nodes/runtime-node-graph.test.js`
- `test/unit/lib/runtime-nodes/runtime-node-model-service.test.js`

## Functional checks

### Root creation menus

- Global root exposes `+ Add Global Node`.
- Active Scene root exposes `+ Add Scene Node`.
- Inactive Scene roots expose `+ Add Scene Node` without first loading the Scene.
- Creation dialogs filter node types by `allowedScopes`.
- Global scope excludes `Node2D`.

### Native-node context menu

- Add child node
- Rename
- Duplicate subtree
- Enable and disable
- Reparent to the correct scope root
- Expand and collapse branch
- Delete subtree

The Global action is labelled `Reparent to Global Root`; Scene nodes use `Reparent to Scene Root`.

### Hierarchy validation

Validated through Runtime Node Graph smoke tests:

- Global nodes remain under Global scope.
- Scene nodes remain inside their owning Scene.
- Cross-scope parenting is rejected.
- Cross-scene parenting is rejected.
- Cyclic parenting is rejected.
- Drag-and-drop checks `canSetParent()` before committing.

### Duplication

- A duplicate receives a new runtime ID.
- Sibling names are made unique.
- Components and their serializable data are copied.
- Child subtrees are recursively copied.
- Adapter/source bindings are not copied.
- Partial duplicates are rolled back if recursive creation fails.

### Persistence

- Native nodes are serialized to `project.extensionData.runtimeNodeModel`.
- Global and Scene nodes survive Scene System disable/re-enable.
- Removing persisted runtime-node extension data clears stale in-memory native nodes during synchronization.
- Import preserves stored node names and hierarchy.

### Inspector

The native Inspector displays:

- Name
- Enabled state
- Type ID
- Scope
- Scene or Project-global ownership
- Attached component list
- Parent
- Child count
- Node ID
- Delete action

## Automated/static validation performed

- `node --check` for all changed CommonJS implementation files
- TypeScript parser pass for changed JSX and test files using `tsc --allowJs --noResolve`
- `git diff --check`
- Runtime Node Graph creation, rename, duplicate, import/export and ownership smoke test
- Runtime Node Model project persistence and stale-state reset smoke test
- ZIP integrity tests for both deliverables

## Tests added

- Runtime graph unique naming, rename, subtree duplication and reparent validation
- Runtime model persistence across module disable/re-enable
- Project Explorer Global/Scene root context menu creation workflow
- Project Inspector native-node display and rename workflow

## Environment limitation

The supplied repository does not contain root `node_modules`. Full Jest, ESLint and Webpack execution was therefore not available in this environment. Test source files were added and syntax-parsed, and the runtime core was exercised with standalone Node smoke tests.

## Deferred work

- Scratch Sprite → SpriteNode adapter (`0008.7`)
- Component registry/editor and Add Component workflow
- Transform properties (`0009`)
- Native SpriteNode and CameraNode implementations
- Undo/redo command integration for native-node mutations
