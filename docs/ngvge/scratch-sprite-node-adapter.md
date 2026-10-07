# Scratch Sprite Adapter Boundary

Task: `0008.7.3 Scratch Adapter Boundary Stabilization`

Scene System version: `0.8.9.2.2`

The Scratch Sprite Adapter projects original Scratch sprite Targets into backend-independent NGVGE semantic Sprite nodes. Scratch remains the current execution authority, but it no longer defines the Runtime Node type.

## Capability

Enabling Scene System provides:

```text
ngvge.scratch-sprite-node-adapter@2
```

The Runtime Node Model owns the semantic type:

```text
ngvge.sprite-node
```

The compatibility adapter attaches the binding component:

```text
ngvge.scratch-target-binding
```

The legacy node type:

```text
ngvge.scratch-sprite-node
```

is registered only as a migration reader. Existing records are imported and rewritten to `ngvge.sprite-node` without changing NodeId, parentage, children or BindingId.

## Boundary model

```text
ngvge.sprite-node
├── semantic NodeId
├── name / parent / children
├── future semantic Sprite components
└── ngvge.scratch-target-binding
    ├── BindingId
    ├── SceneId
    ├── serialized target index
    ├── last-known Scratch name
    └── destroy policy
            │
            ▼
Scratch Compatibility Adapter
            │
            ▼
Scratch Target / target.id
```

The Scratch Target object and volatile `target.id` never enter the persistent Runtime Node record.

## Identity layers

```text
NodeId
    Stable NGVGE semantic identity.

BindingId
    Stable Scratch compatibility relationship.

Scratch target.id
    Volatile active-runtime identity. Scoped by SceneId and never persisted.
```

Runtime target lookup is indexed by:

```text
SceneId + target.id
```

This prevents a target ID observed during scene restoration from being reconciled under the wrong scene.

## Persistent binding schema

The project sidecar is stored under:

```js
project.extensionData.scratchSpriteBindings
```

Schema version 2 record:

```json
{
  "bindingId": "scratch-binding:...",
  "destroyPolicy": "delete-target",
  "lastKnownName": "Player",
  "nodeId": "runtime-node:sprite:...",
  "role": "sprite",
  "serializedTargetIndex": 1
}
```

Version 1 records are accepted and upgraded in place. Missing `destroyPolicy` defaults to `delete-target`.

The binding component stores only serializable adapter metadata:

```json
{
  "adapterType": "scratch.sprite",
  "bindingId": "scratch-binding:...",
  "destroyPolicy": "delete-target",
  "lastKnownName": "Player",
  "role": "sprite",
  "sceneId": "scene-a",
  "schemaVersion": 2,
  "serializedTargetIndex": 1
}
```

## Ownership and deletion

A Scratch-backed Sprite row is one semantic owner. Deletion follows:

```text
Project Explorer delete
→ adapter.destroyBindingByNodeId(NodeId)
→ delete Scratch Target when policy is delete-target
→ remove binding sidecar
→ remove binding indexes
→ destroy semantic Sprite node and Runtime child subtree
→ reconcile active scene
```

Direct calls to `runtimeNodeModel.destroyNode()` are also observed. If a bound semantic Sprite node is removed outside the Adapter API, the adapter performs the remaining Target and sidecar cleanup.

Adapter-initiated Runtime Node destruction is guarded so the lifecycle observer cannot recursively process the same deletion.

## Editor tree projection

Project Explorer consumes `createScratchSpriteTreeProjection()`.

The projection associates a binding with its semantic owner NodeId. It does not infer Scratch ownership from `node.typeId` and does not render the raw Scratch target row when a valid semantic owner exists.

Result:

```text
Scene A
└── Player        Sprite · Scratch · Bound
```

not:

```text
Scene A
├── Player        Scratch target
└── Player        Scratch adapter node
```

Inactive scene nodes remain semantic Sprite nodes and are shown as `Scratch · offline`.

## Query and mutation API

```js
adapter.getBinding(sceneId, bindingId);
adapter.getBindingByBindingId(bindingId);
adapter.getBindingByNodeId(nodeId, optionalSceneId);
adapter.getBindingByTargetRuntimeId(targetRuntimeId, optionalSceneId);
adapter.listBindings(optionalSceneId);
adapter.destroyBindingByNodeId(nodeId, options);
adapter.reconcileScene(optionalSceneId, options);
adapter.getStatus();
```

Binding views are deeply frozen and expose no mutable Scratch Target reference.

## Current authority

```text
Sprite existence / name / costume execution authority: Scratch
Semantic identity and Runtime tree ownership: NGVGE
Projection direction: Scratch → NGVGE
```

Project Explorer therefore blocks direct Runtime duplication, renaming and enable/disable actions for Scratch-bound Sprite nodes. Those operations must currently originate from Scratch controls so the Target and binding are created or changed together.

## Non-goals

`0008.7.3` does not yet implement:

- bidirectional Transform ownership;
- native Sprite rendering;
- Scratch clone semantic nodes;
- Stage adaptation;
- direct NGVGE-side Sprite duplication;
- Inspector binding reassignment;
- final component Schema Registry integration.

Those belong to later `0008` stabilization work, ARC conformance construction and `0009 Transform System`.


## 0008.8 persistence review

`lifecycle` is runtime-derived Adapter state and is no longer stored in the binding component. `targetRuntimeId` remains volatile and is rejected from both the component and sidecar records.

The Adapter exposes:

```js
adapter.validatePersistentBindings();
```

Validation detects unsupported sidecar versions, duplicate stable identities, records owned by deleted scenes and volatile Target IDs. When a Scene is deleted, the Adapter prunes its sidecar scene record instead of leaving an orphan that could be rebound later.


## 0008.9.1.1 public-boundary integration

The Adapter receives the portable `ngvge.runtime-node-model@1.2` capability plus restricted Scene System host controllers. It does not obtain `registerNodeType()`, `importState()` or `persistState()` from the ordinary Runtime Node capability.

Legacy node migration registers a portable `NodeTypeDescriptor` separately from the local JavaScript provider binding. Adapter mutations inspect the structured `{applied, persisted, snapshot, error}` result so a persistence failure cannot be mistaken for an unapplied operation.
