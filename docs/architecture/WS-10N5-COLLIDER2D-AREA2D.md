# WS-10N5 | Collider2D + Area2D

Status: `IMPLEMENTED / MACHINE SEMANTIC GATES VERIFIED / EDITOR WEBPACK INCONCLUSIVE / BROWSER EVIDENCE PENDING`

Architecture parent: `ARC-0001 | Kernel Independence Contract`  
Node-plan parent: `WS-10N | Functional 2D Foundation`  
Depends on: `WS-10N0..N4 (N4 FROZEN / BROWSER VERIFIED)`

## 1. Purpose

WS-10N5 introduces the first backend-independent collision/query semantic in NGVGE.
It intentionally separates collision geometry and trigger/overlap behavior from full rigid-body simulation.

```text
Area2D preset
    ↓
ngvge.node2d
+ ngvge.transform2d@1
+ ngvge.collider2d@1 (sensor = true)
```

The stage does **not** add Rigidbody2D, mass, damping, friction, restitution, joints or a Rapier/Box2D runtime dependency.
Those remain WS-10N8 concerns.

## 2. Stable Collider2D contract

`ngvge.collider2d@1` owns:

```text
shape
├─ Rectangle
├─ Circle
├─ Capsule
└─ Convex Polygon

offset [x,y]
local rotation
collision layer
collision mask
sensor / solid query role
transform inheritance policy
```

Identity rules:

```text
NodeId
!=
Collider ComponentId
!=
future physics-backend handle
```

At N5, the stable Collider identity is the Runtime ComponentId of the single Collider2D component attached to a Node.
A future physics backend may cache a handle against that identity but may not persist the handle.

## 3. Transform authority

Collider2D does not duplicate world position, node rotation or node scale.
Those remain `ngvge.transform2d@1` authority.

N5 supports two explicit scale policies:

```text
inherit-node
ignore-node-scale
```

The default uses the Node Transform2D position/rotation/scale plus Collider2D local offset/rotation.
N5 does not redefine parent-transform composition; it consumes the current 0009 Transform2D runtime view and can transparently consume a future global/world Transform2D composition layer.

## 4. Query semantics

`Collider2DRuntimeService` provides collision functionality without Rigidbody2D:

```text
overlaps(nodeA, nodeB)
getOverlaps(node)
queryPoint(point)
raycast(from, to)
queryShape(shape, transform)
```

Layer/mask matching uses the symmetric rule:

```text
(a.layer & b.mask) != 0
&&
(b.layer & a.mask) != 0
```

Point/ray/shape query callers may also supply a query mask.

Circle and Capsule shapes are deterministically tessellated into query polygons in the current native query provider. This is an execution detail only; the persisted shape remains Circle/Capsule, not polygon data.

## 5. Area2D enter / exit

A Collider2D with `sensor = true` participates as an Area/trigger.
The runtime service tracks overlap-set transitions and emits:

```text
area:enter
area:exit
```

The stable payload uses semantic NodeId values (`areaNodeId`, `otherNodeId`).
No Scratch target ID or future physics handle is used as event identity.

## 6. Product admission

Area2D is promoted from PLANNED to IMPLEMENTED only because the real Collider2D provider now exists.
Functional Node creation is provider-aware:

```text
Collider2D provider available
→ Area2D may appear in Node Library

provider unavailable
→ Area2D hidden / createPlan fails closed
```

`StaticBody2D`, `CharacterBody2D` and `RigidBody2D` remain PLANNED.
N5 does not use the existence of a non-sensor Collider to fake those later archetypes.

## 7. Inspector

The Runtime Node Inspector exposes Collider2D through a dedicated semantic command capability.
It can edit:

```text
Shape
Shape dimensions / radius / polygon points
Offset X/Y
Local Rotation
Collision Layer
Collision Mask
Sensor
Node-scale inheritance policy
```

Editor writes use `PatchCollider2D` and cross `ngvge.collider2d-command`.
The Inspector does not call the Runtime Node Model mutation API directly for Collider fields.

## 8. Viewport gizmo

When a Runtime Node with Collider2D is selected, the Stage renders a non-interactive collider outline.
The gizmo consumes:

```text
Collider2DRuntimeService.getGizmo(NodeId)
        +
Camera2DRuntimeService.worldToScreen()
```

Therefore the editor visualization follows translated/rotated/zoomed Camera2D rather than assuming Scratch baseline stage coordinates.
Sensor colliders use a dashed outline.

The gizmo is editor-only and never becomes project persistence.

## 9. Scratch Blocks compatibility

`NGVGE Collision2D` exposes query-oriented Scratch blocks:

```text
when area A starts overlapping B
collider A overlaps B?
point x/y inside collider?
overlap count
ray hit node / x / y
```

These blocks consume the Collider runtime capability and do not own persistence authority.

Scratch native `touching?` remains unchanged.
N5 does not monkey-patch or reinterpret Scratch `touching?` as Collider2D.

## 10. `.ne` / `.sb3`

```text
.ne
→ persists ngvge.collider2d@1

.sb3
→ no native Collider2D / Area2D construct
→ compatibility analyzer classification: native-only / partial
```

A future compatibility compiler may bake/generated helper logic, but generated Scratch data must not become Collider2D authoring authority.

## 11. N5 non-goals

N5 does not:

- add rigid-body dynamics;
- choose Rapier2D or Box2D;
- persist backend collision handles;
- replace Scratch `touching?`;
- introduce a second Transform2D writer;
- promote StaticBody2D / CharacterBody2D / RigidBody2D prematurely;
- store viewport gizmos in the project;
- weaken native Collider semantics for `.sb3` export.

## 12. Freeze gate

WS-10N5 may be frozen only after:

```text
Core contract tests
Runtime overlap / point / ray / shape tests
Area enter / exit tests
Functional Node Area2D admission tests
Scene System integration
Inspector command tests
Stage gizmo production build
Scratch query-block tests
Permanent regression
Full Unit Node / DOM
Integration
Smoke
TypeScript
ESLint correctness
ARC / 0009 / legacy containment gates
Production Webpack
Browser evidence
```

Browser evidence must explicitly cover Camera2D + Collider gizmo alignment and must verify that Scratch-native `touching?` behavior remains unchanged.
