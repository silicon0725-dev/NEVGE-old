# Runtime Node Model

Current task line: `0008.9.7`  
Scene System version: `0.8.9.7`  
Persistent format: `1`  
Portable public API: `ngvge.runtime-node-model@1.3.1`

The Runtime Node Model is the NGVGE-owned semantic scene object layer.

Runtime boundary failures follow `ngvge.runtime-error@1`. Local JavaScript `Error` instances may expose implementation diagnostics such as V8 `stack`, while portable consumers receive only the frozen normative public record defined by `0008.9.5`.


Revision and atomic read snapshots use the separate `ngvge.runtime-node-snapshot@1` capability defined by `0008.9.6`. A snapshot carries one `(runtimeGeneration, graphRevision, registryRevision)` token; mixed-revision payloads are rejected rather than published. The frozen `ngvge.runtime-node-model@1.3.1` surface is unchanged.

The Runtime Node Model establishes stable node identity, hierarchy, component ownership and mutation boundaries for later Transform, Camera, Physics and Renderer systems.

Migration execution excludes both controlled API mutations and direct writes through retained live `RuntimeNode` / `RuntimeComponent` references. Mutable semantic fields and Graph bindings are privately owned and Guard-aware, and live Node/Component container surfaces are sealed after construction. Module activation also distinguishes Registration (`pending`) from operational Enabled (`completed`), so failed enable batches cannot strand a half-enabled Scene System.

It does not replace the legacy `project-nodes` authoring database. Scratch Targets are projected through the Scratch Compatibility Adapter and never become the persistent identity of Runtime Nodes.

## Ownership model

```text
Project
├── GlobalRoot
│   └── global Runtime Nodes
└── Scenes
    ├── Scene A
    │   └── SceneRoot
    │       └── scene Runtime Nodes
    └── Scene B
        └── SceneRoot
            └── scene Runtime Nodes
```

Every node has exactly one scope:

- `global`: persists independently of scene activation;
- `scene`: belongs to exactly one stable `sceneId`.

Parent-child relationships cannot cross scopes or scenes. Cross-scene relationships use stable node references rather than parenting.

## Built-in node types

| Type ID | Family | Valid scopes | Purpose |
| --- | --- | --- | --- |
| `ngvge.node` | node | global, scene | General non-spatial node |
| `ngvge.node2d` | 2d | scene | Spatial node shell; Transform is added in task 0009 |
| `ngvge.sprite-node` | 2d | scene | NGVGE semantic Sprite node |
| `ngvge.service-node` | service | global, scene | Non-spatial manager or service |
| `ngvge.global-root` | root | global | Protected project-global root |
| `ngvge.scene-root` | root | scene | Protected root for one scene |
| `ngvge.unknown-node` | node | global, scene | Opaque placeholder for an unavailable provider |

`Node2D` and `SpriteNode` contain no Transform calculations yet. Position, rotation, scale and world propagation remain the responsibility of task 0009.

## Node and component lifecycle

Lifecycle Contract version:

```text
ngvge.runtime-node-lifecycle@1
```

Canonical Node states:

```text
Created → Attached → Ready → Active / Disabled
                               ↓
                            Detached
                               ↓
                            Destroyed
```

Canonical Component states:

```text
Created → Attached → Ready → Active / Disabled
                               ↓
                            Detached
                               ↓
                            Destroyed
```

`enabledSelf` is the local authoring flag. `activeInHierarchy` is derived from the complete parent and Scene activation chain. The lifecycle `state` is also derived Runtime state and is never persisted.

A child is active only when it is enabled and its parent is active. The global root is active. Only the active Scene Root is active; inactive Scene Roots and descendants remain loaded in the semantic graph in the `disabled` state.

Local Node Provider hooks:

```js
{
    onCreate,
    onAttach,
    onReady,
    onEnable,
    onDisable,
    onDetach,
    onReorder,
    onDestroy
}
```

Components support the same lifecycle phases except that Reparenting never changes component ownership.

Frozen semantics:

- `onReady` is one-shot per Node or Component instance;
- Reparenting uses `disable → detach → attach → enable-or-disable` for the Node;
- a reparented Node disables its active descendant subtree before emitting Node detach;
- Reparenting only disables and re-enables owned Components; it does not repeat Component attach, ready or ownership assignment;
- Reordering under the same parent emits only `reorder` and changes no lifecycle state;
- subtree destruction is child-first;
- active Components disable before their Node disables;
- Components detach and destroy before their owner Node is destroyed;
- lifecycle hooks are local Provider callbacks and cannot cross the portable Runtime Node boundary;
- hook exceptions are isolated and emitted as `lifecycle:error`; they cannot veto a transition or leave the graph partially mutated;
- synchronous Runtime semantic mutation from a lifecycle Hook is rejected with `RUNTIME_LIFECYCLE_REENTRANT_MUTATION`;
- lifecycle ordering uses `(runtimeGeneration, sequence)` and successful Runtime replacement starts a new generation;
- same-state transitions are side-effect-free no-ops;
- Node hierarchy detach does not detach Component ownership;
- event subscriber exceptions cannot interrupt lifecycle execution or other subscribers; public observer failures are counted separately.

Portable/local event subscribers receive normalized plain-data lifecycle events:

```js
{
    type: 'lifecycle',
    lifecycleContractVersion: '1',
    runtimeGeneration,
    sequence,
    entityKind: 'node' | 'component',
    phase: 'create' | 'attach' | 'ready' | 'enable' |
        'disable' | 'detach' | 'reorder' | 'destroy',
    nodeId,
    componentId,
    fromState,
    toState,
    reason
}
```

Successful Runtime replacement publishes `type: 'runtime:replaced'` at sequence 1 of the new generation. Hook failures use `type: 'lifecycle:error'`. Debug tooling can inspect the bounded lifecycle Trace through `getDebugSnapshot().lifecycle`; this diagnostic Trace is not project data.

## Components

Nodes own a `RuntimeComponentContainer`. Components have an instance `id`, a `typeId`, enabled state and persistent data.

Portable mutation calls return a structured result:

```js
const nodeResult = nodeModel.createNode('ngvge.node2d', {
    name: 'Player',
    sceneId
});

if (!nodeResult.applied) throw new Error(nodeResult.error.message);
const player = nodeResult.snapshot;

const componentResult = nodeModel.addComponent(player.id, {
    typeId: 'game.movement',
    data: {speed: 5}
});
```

Component Cardinality is owned by the registered Component Type Descriptor. Public callers cannot inject `allowMultiple`; the field is a derived persistent projection of Descriptor `cardinality`.

## Component schema authority and import migration

For an explicitly registered Component type:

```text
Component.schemaVersion
=
Component Type Descriptor.schemaVersion
```

Omitting `schemaVersion` during creation derives the Descriptor version. Supplying it is only an equality assertion and cannot select another writable version.

Older persistent records are migrated before any live Component is constructed:

```text
normalize detached record
→ resolve complete contiguous migration path
→ execute owner-bound providers on detached portable data
→ validate canonical result
→ build shadow Graph
→ adopt only after total success
```

Initial Scene startup uses a Registration → Restore sequence. Scene System publishes the restricted Type Registration capability first, dependent modules register Descriptors and migrations, and only then does Scene System restore stored Runtime state and publish the portable Runtime Node Model.

Migration providers execute under a private guard shared by Registry clones. While a provider is running, Descriptor changes, migration binding changes, and mutation of any Graph or public Model bound to that Registry lineage are rejected with `RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION` before side effects.

Unknown types remain opaque and round-trip their original versioned payload. A known record newer than its Descriptor enters project-level persistence read-only protection; the original payload is preserved rather than downgraded or overwritten.

Migration functions, migration bindings, candidate records, execution context and traces are Runtime-only. Persistent Component fields remain `id`, `typeId`, `schemaVersion`, derived `allowMultiple`, `enabled`, `data` and optional namespaced `extensionData`.

## Capability architecture

### Portable Runtime Node capability

```text
ngvge.runtime-node-model@1.3.1
```

Retrieve it through the module capability registry:

```js
const nodeModel = moduleManager.getCapability('ngvge.runtime-node-model');
```

The capability exposes no mutable `RuntimeNodeGraph`, `RuntimeNodeTypeRegistry`, Scratch Target or backend handle.

### Restricted type-registration capability

```text
ngvge.runtime-node-type-registration@1.2
```

This capability is intended for Module Host and extension infrastructure. It separates portable descriptors from local factories and migration providers. Component Type Descriptors own `cardinality` and the current writable `schemaVersion`. Migration providers are owner-bound, local-only, contiguous `N → N + 1` edges and are never project data.

### Internal persistence controller

```text
ngvge.runtime-node-persistence-controller@1
```

This controller is owned internally by Scene System and is not published as an ordinary module capability. It performs import, persistence and Scene synchronization.

### Local Runtime Host

```text
ngvge.runtime-node-local-host@1
```

This local-only host owns callback traversal and disposal. It is not part of the portable public boundary.

## Portable query API

Roots, lookup and snapshots:

```js
nodeModel.getGlobalRoot();
nodeModel.getSceneRoot(sceneId);
nodeModel.getSceneSnapshot(sceneId);
nodeModel.getNodeSnapshot(nodeId);
nodeModel.getParent(nodeId);
nodeModel.getChildren(nodeId);
nodeModel.getComponentSnapshot(nodeId, componentId);
nodeModel.getNodeType(typeId);
nodeModel.listNodes(options);
nodeModel.listNodeTypes(options);
nodeModel.getGraphSnapshot();
```

Portable subtree traversal:

```js
const result = nodeModel.querySubtree({
    rootNodeId,
    order: 'pre', // pre | post | breadth
    maxDepth: null,
    includeRoot: true
});

result.nodes.forEach(({node, depth}) => {
    // node is a deeply frozen NodeSnapshot.
});
```

The old callback-based `traverse(nodeId, visitor, options)` exists only on the local Runtime Host. It cannot cross IPC, WebSocket, WASM or a Native Kernel bridge.

All arguments supplied to portable methods are validated before Runtime access. Functions or local host objects cannot enter through mutation options, node creation options or component options.

All public query object graphs are:

```text
Plain Data
Deep Frozen
No Function
No Promise payload
No Map / Set
No Class Instance
No Runtime Object
No Scratch Target
No Backend Handle
No Circular Reference
```

## Portable mutation API

Structure mutation:

```js
nodeModel.createNode(typeId, options);
nodeModel.destroyNode(nodeId);
nodeModel.setParent(nodeId, parentId, options);
nodeModel.reorderChild(nodeId, index, mutationContext);
nodeModel.detachNode(nodeId);
nodeModel.duplicateNode(nodeId, options);
```

Node mutation:

```js
nodeModel.patchNode(nodeId, {
    name: 'Player',
    enabled: true
}, mutationContext);

nodeModel.patchNodeMetadata(nodeId, {
    category: 'actor'
}, mutationContext);

nodeModel.setNodeEnabled(nodeId, enabled, mutationContext);
```

Component mutation:

```js
nodeModel.addComponent(nodeId, componentOptions, mutationContext);
nodeModel.removeComponent(nodeId, componentId, mutationContext);
nodeModel.patchComponent(nodeId, componentId, {speed: 10}, mutationContext);
nodeModel.setComponentData(nodeId, componentId, {speed: 10}, mutationContext);
nodeModel.setComponentEnabled(nodeId, componentId, false, mutationContext);
```

Every portable mutation returns:

```js
{
    applied: boolean,
    persisted: boolean,
    snapshot: PortableSnapshot | null,
    error: PortableError | null
}
```

Meaning:

```text
applied=false, persisted=false
The public mutation did not commit. Runtime semantic state is restored in place, deferred lifecycle hooks are discarded, and no mutation observer event is published.

applied=true, persisted=true
The single public mutation committed to Runtime and Project Source. Provider lifecycle hooks run only after the persistent write is authoritative, followed by observer event publication.
```

`applied=true, persisted=false` is not a valid result for the portable Runtime Node Model mutation surface. `0008.9.7` freezes single-command commit atomicity only; multi-command transactions, Undo and transaction-wide Commit/Rollback remain deferred to ARC-C001.

Rollback preserves the current Runtime generation and restores the original live Node / Component objects rather than rebuilding the Graph. Revision counters remain monotonic and are not rewound, so a failed attempt may stale an older Revision Token without publishing a mutation event.

First-party in-process integrations that require persisted success use:

```js
const snapshot = assertRuntimeNodeMutationResult(
    nodeModel.patchNode(nodeId, {name: 'Player'})
);
```

If persistence fails, compatibility wrappers throw with `error.mutationResult.applied === false`; the attempted semantic change has already been restored before the error is surfaced.

## Persistent hierarchy ordering

Persistent format remains version `1`; no new persistent field is introduced by `0008.9.7`. Existing representation is made explicit:

- `parentId: null` means the node is intentionally detached;
- an omitted `parentId` on imported legacy data defaults to the appropriate Global or Scene Root;
- within one parent, sibling order is represented by the relative order of that parent's child records in the persistent `nodes` array;
- export emits nodes in hierarchy order while preserving each parent's `childIds` order, so `reorderChild()` survives save / restore without a new schema field.

Snapshot canonical ordering remains independent of this persistent hierarchy ordering: Snapshot node collections use the frozen canonical string order from `0008.9.6.1`, while persistent node-array order carries hierarchy semantics.

## References

```js
const reference = nodeModel.createReference(nodeId);
const snapshot = nodeModel.resolveReference(reference);
```

References use stable semantic node identity, not Scratch Target IDs or Runtime object references.

## Node type descriptor and provider split

Portable descriptor:

```js
const descriptor = typeRegistration.registerNodeTypeDescriptor({
    typeId: 'plugin.dialogue-node',
    version: '1',
    label: 'Dialogue NPC',
    ownerModuleId: 'plugin.dialogue',
    allowedScopes: ['scene'],
    schema: {
        properties: {}
    }
});
```

Local provider binding:

```js
const unbindProvider = typeRegistration.bindNodeTypeProvider(
    descriptor.typeId,
    {ctor: DialogueNode}
);
```

The descriptor is portable plain data. The constructor and unregister closure are local Runtime Host objects and are never placed in the Engine Protocol.

Duplicate descriptors are rejected. Provider replacement remains ownership-controlled by the underlying registry.

## Compatibility aliases

Legacy consumers temporarily retain:

```text
getNode             → getNodeSnapshot
getComponent        → getComponentSnapshot
patchComponentData  → patchComponent
renameNode          → patchNode
```

NGVGE first-party source is prohibited from calling these aliases. `scripts/check-runtime-node-public-boundary.js` enforces the rule.

## Persistent and debug DTOs

Project persistence uses persistent records and excludes runtime-derived fields such as:

```text
activeInHierarchy
lifecycle state
readiness flags
parent caches
component owner state
Scratch targetRuntimeId
adapter lifecycle state
```

Diagnostic tooling uses:

```js
nodeModel.getDebugSnapshot();
```

Debug snapshots are portable query data but are not written into the Scene System project extension payload.

Runtime Node project state with a version newer than the current runtime enters persistence read-only mode. Mutations return `applied: false` with `RUNTIME_NODE_STATE_READ_ONLY`, preserving future project data.

## Scratch Compatibility boundary

```text
Scratch VM
    ↓
Scratch Sprite Adapter
    ↓
Scratch Binding Component
    ↓
NGVGE SpriteNode
```

Scratch Target and `target.id` remain Adapter-private. Stable `NodeId`, `BindingId` and `SceneId` survive project close/reopen and Target recreation.

## Machine-readable API contract

```js
nodeModel.apiVersion; // "1.3.1"
const contract = nodeModel.getApiContract();
```

The contract records:

- exact public surface keys;
- portable query methods;
- portable mutation methods;
- local-only methods;
- compatibility aliases;
- method portability descriptors;
- snapshot guarantees;
- single-command atomic mutation commit semantics;
- split host capabilities.

`Reflect.ownKeys(nodeModel)` must match `contract.publicSurfaceKeys`. Undeclared methods or hidden properties fail the architecture gate.

## Current boundaries

The Runtime Node Model still does not include:

- Transform values or matrix propagation;
- rich declarative component property schemas and editor generation;
- online migration of already attached live Component instances;
- multi-command transactions, transaction-wide Undo and transaction-wide rollback;
- Native Kernel transport;
- physics, camera or rendering implementation;
- cross-scope node migration.

Those boundaries prevent current Scratch-hosted implementation details from becoming permanent NGVGE semantics.
