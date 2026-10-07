# NGVGE Task 0008.6.3 Validation

## Scope

Validation covers the mutation boundary and lifecycle corrections required before `0009 Transform System`.

## Verified behaviors

### Read-only capability boundary

- `runtimeNodeModel.graph` is no longer exposed.
- `runtimeNodeModel.nodeTypes` is no longer exposed.
- `getNode`, `getChildren`, `getParent`, `getGlobalRoot`, `getSceneRoot`, `listNodes`, `resolveReference` and traversal callbacks return frozen node views.
- Node metadata, source objects, child ID arrays and component data are deeply frozen clones.
- `getNodeType` and `listNodeTypes` return node-type views without constructors or factory functions.
- Direct writes to returned views do not modify the internal Runtime Node Graph.

### Mutation API and persistence

Verified APIs:

```text
patchNode
patchNodeMetadata
patchComponentData
setComponentData
setComponentEnabled
```

Also revalidated:

```text
createNode
renameNode
setNodeEnabled
addComponent
removeComponent
setParent
detachNode
duplicateNode
destroyNode
```

Each capability mutation executes the graph operation, persists Runtime Node Model state, and emits graph change notifications.

A failed `sceneDataModel.writeProject()` no longer advances `lastStoredStateJSON`. The unchanged in-memory state can therefore be retried successfully by a later `persistState()` call.

### Node lifecycle

Initial attachment:

```text
onCreate → onAttach → onReady → onEnable
```

Reparenting:

```text
onDisable → onDetach → onAttach → onEnable
```

`onReady` remains one-shot and is not repeated by reparenting.

Same-parent ordering:

```text
onReorder
```

Same-parent ordering does not invoke `onDetach`, `onAttach` or `onReady`.

### Component lifecycle

- A component added to a ready active node runs `onAttach → onReady → onEnable`.
- Component `onReady` runs at most once.
- Reparenting its owner does not detach the component from the owner and does not repeat component `onReady`.
- `setComponentEnabled` produces enable/disable hooks only when effective active state changes.
- Component removal and node destruction do not emit duplicate disable events.

### Editor integration

- Project Explorer now uses `getNodeType()` and `listNodeTypes()` instead of the mutable registry.
- Project Inspector reads the frozen `components` view instead of calling methods on a RuntimeNode instance.
- Existing create, rename, duplicate, delete, enable and drag-reparent flows continue to use capability mutations.

## Automated and local checks performed

- Node syntax checks for all files under `src/lib/runtime-nodes`.
- Node syntax check for `src/lib/scene-system/module-definition.js`.
- Standalone lifecycle smoke test covering first attach, reparent and same-parent reorder.
- Standalone capability smoke test covering frozen views and all new mutation APIs.
- Persistence failure/retry smoke test.
- Source scan confirming production code no longer references `runtimeNodeModel.graph` or `runtimeNodeModel.nodeTypes`.
- ZIP integrity checks for the incremental task package and complete project package.

## Added/updated Jest coverage

- one-shot node and component ready lifecycle;
- detach/attach behavior during reparent;
- reorder-only lifecycle behavior;
- graph-level node/component mutation methods;
- frozen capability views;
- absence of mutable graph and type registry properties;
- persisted node metadata and component data changes;
- persistence retry after write failure;
- updated Project Explorer and Inspector capability mocks.

## Environment limitation

The supplied project does not include root `node_modules`. Full Jest, ESLint and Webpack runs were therefore not available in this environment. Test files were added for execution in the normal dependency-installed project environment.

## Deferred to 0008.6.4 and 0008.6.5

This task does not claim to fix:

- destructive/non-transactional `importState`;
- missing third-party node types;
- registry duplicate ownership rules;
- registry revision propagation;
- Project Explorer root tree-ID expansion mapping;
- persistent DTO removal of runtime-derived state.
