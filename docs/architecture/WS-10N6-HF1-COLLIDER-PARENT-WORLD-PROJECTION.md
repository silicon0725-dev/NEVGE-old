# WS-10N6-HF1 | Collider2D Semantic-Parent World Projection

**Status:** IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING  
**Parent:** WS-10N6 CharacterBody2D / CharacterController2D  
**Inherited authority:** ARC-0001, 0008 Runtime Node hierarchy, 0009 Transform2D, WS-10N5 Collider2D

## Root cause

The initial N5/N6 Collider runtime projected a Collider2D only through the owning node's Transform2D. That is correct for scene-root children, but wrong for functional nodes nested under another transformed semantic Node.

A browser reproduction exposed the failure:

```text
Scratch-bound edge @ left side
└─ StaticBody2D local Transform = [0,0]

Scratch-bound edge2 @ right side
└─ CharacterBody2D local Transform = [0,0]
```

The two visible Scratch parents were spatially separated, but both child Collider2D records were evaluated at local `[0,0]`; therefore the collision query compared two colliders at the same world origin and returned `true`.

## Correct projection rule

`parentId` remains NGVGE semantic hierarchy identity. Backend target identity is not consulted by Collider2D.

For collision/query projection only, a child Collider's local geometry is transformed through the complete semantic Transform2D parent chain:

```text
Collider local shape
→ Collider offset / rotation
→ owner Transform2D
→ parent Transform2D
→ grandparent Transform2D
→ ...
→ world polygon
→ AABB broad phase
→ SAT narrow phase
```

`position : vec2` continues to use the frozen Transform2D world-unit domain. HF1 clarifies that `world-units` describes units; it does not mean a child node bypasses semantic parent projection.

The projection is derived runtime state only. It does not add a world-transform field to persistent `.ne` data and does not make Scratch Target x/y, renderer Drawables, or a physics backend handle into authority.

## ECO-0 reference findings

The reviewed `Lazy-Collisions.js` obtains real Sprite bounds at query time, so its collision geometry follows the Sprite's current stage position. The reviewed `Rigidbodies.js` rebuilds polygon points when x/y/direction/scale changes and performs AABB rejection before SAT.

HF1 adopts the invariant demonstrated by those references — collision geometry must be current in world space before overlap tests — but not their Scratch VM/Target/Renderer ownership model.

## CharacterController2D consequence

Character motion commands remain world-space gameplay motion. If a CharacterBody2D is nested under a rotated/scaled parent, the requested world delta is converted through the inverse ancestor linear transform before patching the CharacterBody2D's local runtime Transform2D position.

Moving-platform carry likewise stores the platform Collider's derived `worldOrigin`, not the platform node's local Transform position.

## Explicit non-goals

HF1 does not:

- add Rigidbody2D or a Physics2D backend;
- make Scratch Sprite bounds the NGVGE collider source;
- serialize derived world transforms;
- implement parent constraint authoring UX;
- change Scratch native `touching?` semantics.
