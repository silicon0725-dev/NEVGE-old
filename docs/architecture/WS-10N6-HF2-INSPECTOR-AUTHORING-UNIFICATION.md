# WS-10N6-HF2 | Inspector Authoring Unification

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING
Parent: `WS-10N6 | CharacterBody2D / CharacterController2D`

## Problem

The functional Node path already owns Transform2D, Camera2D, Collider2D and CharacterController2D semantics, but the Inspector still behaved like two partially disconnected products:

- legacy Scratch target inspection exposed sprite properties directly;
- Runtime Node inspection exposed component sections, but those sections were collapsed by default and Scratch-bound Sprite appearance controls were absent;
- Collider2D shape controls existed but were easy to miss and collider gizmo visibility was stage-wide rather than authorable per selected node.

That weakens the intended product contract: Project/Node Explorer selects an object, and Inspector edits the selected object's semantic authoring state.

## Transform authority remains unchanged

Scratch-bound Sprite Transform authoring continues through the frozen 0009 route:

```text
Inspector intent
  -> Transform2D PatchComponent command
  -> NodeId writer router
  -> scratch.compat.transform writer
  -> Scratch target projection
```

Native nodes continue through `ngvge.native.transform`.

The Runtime Inspector does not call `postSpriteInfo()` for X/Y/rotation/scale. Scratch compatibility fallbacks are still permitted for properties that do not yet have native semantic component authority, such as visibility, rotation style and draggable.

## Runtime Inspector product model

Runtime functional nodes now default-open the relevant authoring sections:

```text
Runtime Node
Transform2D
Sprite Appearance (Scratch-bound Sprite only)
Camera2D
Collider2D
CharacterController2D
```

`Sprite Appearance` is explicitly labelled Scratch Compatibility. It does not become Transform authority.

## Collider2D authoring

Collider2D Inspector remains the authoring surface for:

- Shape: Rectangle / Circle / Capsule / Convex Polygon
- Geometry dimensions / polygon points
- Offset and local rotation
- collision layer and mask
- sensor policy
- transform inheritance policy

HF2 adds an editor-only `Gizmo` choice:

```text
Inherit Editor
Always
Selected Only
Hidden
```

The value is held by `editor-visualization/collider-gizmo-preferences`, not by `ngvge.collider2d@1`.

Therefore:

```text
Collider2D gameplay semantics
!=
Editor visualization preference
```

The preference service is runtime-editor local and does not mutate Project Model or Collider Component data. Future `.ne` editor-state persistence may project it under `editor/`, but it must not enter scene/component authority.

## CharacterController2D Inspector separation

The section now presents two explicit groups:

- Runtime Debug: velocity, floor/wall contact state and normals (read-only)
- Authoring: max slope, floor snap, step height, safe margin, up direction and max slides

Runtime contact state remains non-persistent.

## Gate

HF2 is not COMPLETE until browser evidence confirms that a Scratch-bound Sprite can be selected in Node Explorer and edited through Transform2D Inspector, Collider shape/gizmo choices work live, and Runtime Debug fields remain read-only.
