# WS-10N6-HF5 | Collider2D Authoring Completeness

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING

## Problem

N5/N6 established Collider2D runtime semantics, collision debug rendering and CharacterBody2D test drive, but the editor authoring loop remained incomplete. A collision shape that can be queried but cannot be predictably sized and manipulated from the Inspector/Stage is not a usable editor feature.

## Frozen authoring rule

`Collider2D` gameplay geometry remains authoritative in `ngvge.collider2d@1`. Inspector fields and Stage handles are two editor projections of the same component command path:

```text
Inspector numeric fields ─┐
                          ├─> ngvge.collider2d-command -> Collider2D component
Stage shape handles ──────┘
```

The Stage overlay must never mutate Runtime Node Model component records directly.

## Shape-specific authoring

- Rectangle: Width / Height + 8 symmetric resize handles.
- Circle: Radius (+ derived Diameter) + radius handle.
- Capsule: Radius / Height (+ derived Width / minimum legal height) + radius/height handles.
- Convex Polygon: structured vertex list, add/remove vertex, raw points fallback, direct vertex handles. Invalid concave or degenerate edits are rejected.
- All shapes: local Offset X/Y, local Rotation, center/pivot handle, rotation handle.

Shape type conversion preserves the current effective local bounds instead of resetting to arbitrary defaults. `Reset Shape` remains an explicit user action.

## Transform and Camera correctness

Direct manipulation converts pointer coordinates:

```text
Stage client point
-> Scratch/native screen coordinate
-> Camera2D screenToWorld
-> semantic Transform2D hierarchy inverse projection
-> Collider node-local / shape-local coordinate
-> Collider2D command patch
```

This preserves nested parents, rotation, non-uniform scale and Camera2D without making the editor a Transform2D writer.

## Deferred

- concave/compound collision authoring;
- visual-resource auto-fit based on canonical resource bounds;
- full Physics2D material/body controls (N8);
- project-level undo transaction coalescing for long pointer drags if the global editor command history later requires it.
