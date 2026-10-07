# WS-10N6-HF6 | Functional Collision Projection & Legacy Node Boundary Closure

Status: IMPLEMENTED / MACHINE VERIFICATION IN PROGRESS / BROWSER EVIDENCE PENDING

## Problem

The editor still exposed an obsolete Project Node type named `ngvge.collider2d`. That compatibility node stores flat legacy properties (`shape`, `width`, `height`, `radius`, `offsetX/Y`, layer/mask), but it does **not** own an `ngvge.collider2d@1` Runtime Component.

This created two visually similar but semantically different collision objects:

```text
Legacy Project Node "Collider2D"
  -> project-node property database only
  -> no Collider2D Runtime Component
  -> invisible to collision queries and Stage gizmos

Functional StaticBody2D / Area2D / CharacterBody2D
  -> Runtime Node
  -> ngvge.collider2d@1 Component
  -> collision queries + Stage gizmos + authoring handles
```

A compatibility object must never masquerade as the Functional collision authority.

## Second root cause: portable capability facade materialization

The exact browser failure also exposed a separate cross-module boundary bug. First-party module capabilities are returned through `service-facade.js`. Array-shaped values crossing that authority boundary intentionally retain indexed access and `length` but do **not** retain JavaScript `Array` identity.

Therefore this is invalid at the Editor boundary:

```text
capability.listColliders()
  -> facade array-like value
  -> Array.isArray(...) === false
  -> Stage filters out every real Collider2D
```

The screenshot is evidence for both failures at once:

- the selected Explorer row is the obsolete compatibility `ngvge.collider2d` node; and
- `Collision Shapes = All` is present, which means the real Collider2D provider is active, yet the Stage is blank because real runtime `worldPoints` crossed the capability facade without portable materialization.

HF6 therefore requires Editor consumers to call `materializePortableCapabilityValue()` on structured return values before Array-based validation or forwarding into another Editor protocol. This applies to:

- Collider2D Stage list/gizmo/overlap/query coordinates;
- Camera2D world/screen point transforms consumed by Collider authoring;
- Runtime Node snapshots/components consumed by Inspector;
- Collider2D config and nested shape vectors consumed by Inspector;
- CharacterController2D runtime vectors consumed by the debug overlay.

The facade remains the authority boundary. Materialization creates a portable Editor-side DTO; it does not expose provider-private mutable objects or turn the Editor into a collision authority.

## Frozen boundary

`ngvge.collider2d@1` remains the only Collider2D gameplay geometry authority.

The old `ngvge.collider2d` Project Node and `ngvge.physics-body2d` Project Node are retained **only** for legacy project compatibility. They are:

- loadable and editable so old data is not destroyed;
- hidden from normal new-node creation menus;
- explicitly marked deprecated / legacy-compatibility-only;
- never projected into Runtime collision merely to make the old node appear functional.

## Functional creation routing

When Scene System is active, `Add Child Node` invoked from a compatibility Stage/Sprite row routes into the Functional Runtime Scene tree:

```text
Compatibility Stage row
  -> active Functional Scene root

Compatibility Scratch Sprite row
  -> stable bound Functional Sprite2D NodeId
```

If a Scratch target is not bound, the editor reports the missing Functional binding instead of silently creating a second compatibility hierarchy.

## Legacy Collider migration

Selecting an existing legacy Collider2D shows an explicit warning and offers:

```text
Upgrade as StaticBody2D
Upgrade as Area2D
```

Migration transfers supported legacy authoring data:

- rectangle/circle shape;
- legacy polygon fallback bounds -> convex rectangle, because the legacy schema does not contain canonical polygon vertices;
- Width / Height / Radius;
- Offset X / Y;
- Collision Layer / Mask;
- Trigger intent via the chosen Area2D migration path.

The migration creates the Functional archetype through `ngvge.functional-node-creation`, then patches its provisioned Collider2D through `ngvge.collider2d-command`.

The old compatibility node is deleted **only after** the Functional node and Collider2D patch succeed. A failed patch triggers best-effort rollback of the newly created Runtime node and leaves legacy data intact.

## Projection and authoring invariant

A real Functional Collider2D must remain visible and authorable when all of its portable values arrive through the production Module capability facade:

```text
Collider Runtime Capability
  -> service facade
  -> materialize portable DTO
  -> Stage geometry / Inspector fields
  -> Collider2D command capability
  -> Runtime Component authority
```

Editor code must not depend on cross-boundary `Array.isArray()` identity. The same invariant covers direct Stage handles, because `screenToWorld`, `worldPointToNodeLocal`, `worldPointToShapeLocal`, and `shapeLocalPointToWorld` also return portable vector values through capability facades.

## Non-goals

HF6 does not:

- create a second Collider2D authority backed by Project Node properties;
- make Renderer/DOM geometry authoritative;
- introduce a standalone Godot-style `CollisionShape2D` archetype as an emergency workaround;
- upgrade the old `PhysicsBody2D` into Rigidbody2D before WS-10N8;
- infer unavailable legacy polygon vertices.

A future dedicated CollisionShape2D-style child authoring model may be designed deliberately, but it must still resolve to stable Collider2D component semantics rather than revive the compatibility node.
