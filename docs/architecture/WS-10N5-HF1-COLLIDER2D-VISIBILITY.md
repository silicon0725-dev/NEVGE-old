# WS-10N5-HF1 | Collider2D Editor Visibility

Status: `IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING`

Parent: `WS-10N5 | Collider2D + Area2D`

## Problem

The N5 runtime/query implementation was present, but the first browser pass showed that collision geometry was not reliably visible to the creator. The original N5 Stage gizmo rendered only the Collider2D belonging to the current primary Node selection. That makes collision authoring opaque whenever selection projection is elsewhere and gives no scene-level collision overview.

The ECO-0 candidate pack also contains SharkPool `Rigidbodies.js`. Its custom body monitors demonstrate the useful creator-facing behavior: collision geometry should have an explicit viewport representation. The implementation is not adopted as authority; NGVGE keeps the existing Collider2D/Transform2D contracts and rewrites only the editor presentation.

## Fix

The Stage Collider2D overlay now:

```text
Collider2DRuntimeService.listColliders()
    -> all active colliders in active scene
    -> Camera2D worldToScreen projection
    -> editor-only SVG overlay
```

All active Collider2D shapes are rendered faintly in the editor. The primary selected Collider2D is rendered more strongly. Sensor colliders remain dashed.

No viewport/debug object is persisted. No DOM/SVG identity becomes NodeId, ComponentId or Collider authority.

## Naming clarity

Functional archetypes continue to materialize as runtime types + components and do not persist archetype identity. However, when the user does not provide a name, the creation service now uses the archetype label as the authored node name:

```text
Area2D archetype -> default node name "Area2D"
Camera2D archetype -> default node name "Camera2D"
```

This avoids an Area2D appearing in Collision2D block menus as a generic `Node2D` merely because its base runtime type is `ngvge.node2d`.

## ECO-0 intake boundary

`Lazy-Collisions.js` is useful for collision-query/block vocabulary but does not contain the viewport collision-box monitor the browser issue requires.

`Rigidbodies.js` does contain a custom monitor overlay and an explicit monitor toggle. NGVGE uses that as UX evidence only. Its direct DOM/renderer ownership and body identity model are not imported into Core or persistence.

A future Stage View/Debug control may expose an editor toggle for all collider gizmos. HF1 keeps the scene overlay visible by default in editor mode so collision authoring is inspectable immediately.
