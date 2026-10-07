# WS-10N2｜Functional Node Creation + Scratch Target Binding

**Status:** IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING  
**Parent:** WS-10N Functional Node / 2D Game Foundation Master Plan  
**Inherited authority:** ARC-0001, 0008 Runtime Node Model, 0009 Transform2D, WS-10N0, WS-10N1

## 1. Purpose

WS-10N2 is the first Functional Node stage that changes production authoring UI.

Its job is deliberately narrow:

```text
Node archetype descriptor
        ↓
creation plan
        ↓
existing Runtime Node command boundary
        ↓
real Runtime Node + real semantic Components
```

It does **not** introduce Camera2D, Collider2D, CharacterBody2D or TileMap runtime providers yet. Planned archetypes remain hidden until their provider stages exist.

## 2. Archetype creation boundary

Archetype identity is an editor creation preset, not persistent node identity.

```text
ngvge.archetype.node2d
        ↓
ngvge.node2d
+ ngvge.transform2d@1
```

```text
ngvge.archetype.sprite2d
        ↓
ngvge.sprite-node
+ ngvge.transform2d@1
        ↓
Scratch Sprite lifecycle compatibility authority
        ↓
real Scratch Target
+ stable NGVGE NodeId / BindingId
```

The creation plan may contain semantic component records. It may not contain `targetRuntimeId`, renderer handles, VM objects, or other backend identity.

## 3. Current creatable archetypes

### Native Node2D

Always available when the scene Runtime Node type is registered.

Provisioned semantic component:

```text
Transform2D
position = [0, 0]
rotation = 0
scale    = [1, 1]
```

The node has no Scratch Target and therefore routes Transform mutation through the native writer introduced by WS-10N1.

### Scratch-compatible Sprite2D

Available only while the Scratch Sprite compatibility adapter/lifecycle seam is available.

Creation continues through the existing Scratch VM lifecycle rather than constructing a fake semantic sprite:

```text
VM addSprite
→ adapter reconcile
→ stable semantic binding
→ semantic parent
→ Transform2D provisioning
```

If semantic component provisioning fails after target creation, N2 compensates by destroying the newly established Scratch binding/target instead of leaving a half-created split-brain object.

## 4. Node Explorer behavior

The runtime creation dialog consumes `ngvge.functional-node-creation` archetype descriptors.

When an archetype replaces an exposed core runtime type such as `ngvge.node2d`, the raw type entry is suppressed so users see one Node2D authoring choice.

Other runtime/plugin node types are retained. N2 does not turn the archetype catalog into a closed node registry.

## 5. Inspector behavior

Runtime Transform inspection is Component-driven.

Scratch-backed node:

```text
Position X / Y
Rotation
Scale
Authority = Scratch Compatibility
```

Native node:

```text
Position X / Y
Rotation
Scale X
Scale Y
Authority = NGVGE Native
```

Native XY scale permits non-uniform and negative values because `scale : vec2` is already part of the certified Transform2D schema. No `xyStretch` side-channel is created.

## 6. Explicit non-goals

WS-10N2 does not:

- hide the legacy Scratch role manager;
- claim full Sprite role-manager parity;
- move Scratch Blocks editing-target authority to the Node Tree beyond existing selection projection;
- implement Visual2D or ScriptHost as new native providers;
- surface Camera2D / Area2D / bodies / TileMapLayer2D;
- persist archetype IDs on created nodes;
- persist Scratch target identity in semantic Component data.

Those responsibilities remain in later WS-10N stages, especially WS-10N3 onward.

## 7. Exit condition

Machine verification proves the semantic/command path. Because production Node Explorer and Inspector presentation changed, browser evidence is required before N2 can be called fully verified.
