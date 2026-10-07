# NGVGE 0008.6.5 Validation Report

## Scope

Task: `0008.6.5 Editor Integration Hardening`

Base project: `0008.6.4 Transactional Import & Unknown Runtime Node`

Resulting Scene System version: `0.6.5`

## Acceptance results

### 1. Runtime root tree identity

Implemented `runtime-tree-identity.js` with stable mappings:

```text
Runtime GlobalRoot ID                  Editor tree ID
runtime-node:global-root               scope:global

Runtime SceneRoot ID                   Editor tree ID
runtime-node:scene-root:<sceneId>       scene:<sceneId>
```

Project Explorer creation, duplication, root reparenting, drag/drop expansion and branch expansion now use editor tree IDs for protected roots. No direct `handleToggleNode(root.id, ...)` calls remain.

### 2. Node Type Registry hardening

Verified:

- duplicate type IDs fail with `RUNTIME_NODE_TYPE_ALREADY_EXISTS`;
- cross-owner replacement fails with `RUNTIME_NODE_TYPE_OWNER_MISMATCH`;
- replacement without an explicit owner fails with `RUNTIME_NODE_TYPE_REPLACE_OWNER_REQUIRED`;
- explicit same-owner replacement succeeds;
- registration metadata exposes `owner`, `version` and `registeredAt`;
- register, replace and unregister each increment a monotonically increasing revision.

### 3. Dynamic registry/editor synchronization

The Runtime Node Model Capability forwards Registry changes as:

```js
{
    type: 'registry:change',
    registryChangeType: 'register' | 'replace' | 'unregister',
    registryRevision,
    typeId,
    owner
}
```

Project Explorer subscribes to the same Capability revision stream. An already-open Create Node dialog re-renders and reads the latest registry list without reopening the project or Scene System module.

### 4. Error presentation

Runtime node creation, rename, duplicate, delete, move, scene-load and provider-reification failures are converted into structured Project Explorer notices containing:

- title;
- normalized error code;
- contextual message;
- actionable suggestion.

Missing providers produce a non-destructive warning and keep opaque placeholders visible.

### 5. Persistent DTO / Debug DTO separation

Project persistence now uses:

```js
node.toPersistentRecord();
component.toPersistentRecord();
```

Runtime diagnostics use:

```js
node.toDebugJSON();
component.toDebugJSON();
runtimeNodeModel.getDebugSnapshot();
```

Persistent records were verified not to contain:

```text
activeInHierarchy
childIds
enabledSelf
family
protected
ready
state
component.ownerId
component.activeInHierarchy
component.ready
component.state
transactionId
```

Opaque UnknownRuntimeNode records also strip stale derived fields from their preserved `originalRecord`, while retaining provider-owned fields and component payloads.

### 6. Runtime selection bridge

Verified editor behavior:

- creating a runtime node selects the new node;
- deleting a runtime node selects its parent, including protected roots;
- protected roots are classified as runtime nodes and cannot accidentally enter project-node keyboard delete/rename/duplicate paths;
- per-scene runtime selection is remembered;
- switching scenes restores the remembered node or falls back to the destination SceneRoot;
- initial Scene System mounting does not overwrite an existing Scratch/editor selection;
- Global selection remains stable across scene changes.

### 7. Undo/Redo command boundary preparation

Mutation methods accept an optional `transactionId`. The ID is attached to Capability change events and is removed before options reach Runtime Node constructors or structural Graph methods.

No Undo Stack is implemented in this task. This is only the stable transaction boundary required by a later editor command system.

### 8. Persistence retry behavior

The existing `0008.6.3` correction remains intact: `lastStoredStateJSON` updates only after `sceneDataModel.writeProject()` succeeds. Failed project writes remain dirty and can be retried.

## Validation executed

Passed:

- Node syntax checks for all changed CommonJS runtime and Scene System files;
- TypeScript parser syntax checks for changed JSX and Jest files;
- runtime/editor contract smoke script;
- runtime root identity round-trip checks;
- registry duplicate, owner, replacement and revision checks;
- Capability registry-event forwarding checks;
- transaction ID propagation and non-persistence checks;
- Persistent DTO versus Debug DTO checks;
- UnknownRuntimeNode legacy-derived-field cleanup checks;
- transactional import failure preservation check;
- Project Explorer source scan for raw protected-root expansion IDs;
- changed-file trailing-whitespace scan;
- incremental and full ZIP integrity checks.

Smoke result:

```text
0008.6.5 runtime/editor contract smoke tests passed
```

## Added or updated tests

- `test/unit/lib/runtime-nodes/runtime-node-type-registry.test.js`
- `test/unit/lib/runtime-nodes/runtime-node-model-service.test.js`
- `test/unit/lib/runtime-nodes/runtime-tree-identity.test.js`
- `test/unit/lib/runtime-nodes/runtime-node-error-presenter.test.js`
- `test/unit/components/project-explorer.test.jsx`

## Environment limitation

The supplied project does not contain a root `node_modules` directory. Therefore the complete repository Jest, ESLint and Webpack commands were not executed in this environment. The corresponding Jest coverage is included, and all dependency-independent syntax and behavioral validation listed above passed.

## Deferred work

This task deliberately does not implement:

- a real Undo/Redo stack;
- Scratch Target → Runtime SpriteNode conversion;
- Transform values or world-transform propagation;
- Physics, Renderer or Camera components;
- component schema editors.

The next planned engine stage can proceed to `0008.7 Scratch Sprite Node Adapter` after manual UI acceptance.
