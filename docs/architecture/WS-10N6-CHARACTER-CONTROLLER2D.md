# WS-10N6 | CharacterBody2D / CharacterController2D

Status: `IMPLEMENTED / MACHINE SEMANTIC GATES VERIFIED / EDITOR WEBPACK INCONCLUSIVE / BROWSER EVIDENCE PENDING`

## 1. Scope

WS-10N6 graduates the first native kinematic movement consumer of the WS-10N5 Collider2D contract.

```text
CharacterBody2D
= Base Node
+ Transform2D
+ Collider2D (solid; sensor=false)
+ CharacterController2D
```

It also graduates a deliberately narrow `StaticBody2D` collision-surface preset:

```text
StaticBody2D
= Base Node
+ Transform2D
+ Collider2D (solid; sensor=false)
```

`StaticBody2D` in N6 is **not** a Physics2D/Rigidbody backend object. It has no mass, gravity, friction, restitution, sleep state or backend body handle.

## 2. Stable CharacterController2D contract

```text
TypeId:       ngvge.character-controller2d
Schema:       1
Owner:        ngvge.scene-system
Persistence:  .ne native
.sb3:         native-only / compatibility analyzer responsibility
```

Persistent fields:

```text
floorSnapLength
maxSlides
maxSlopeDegrees
safeMargin
stepHeight
upDirection [x, y]
```

Runtime-only state:

```text
velocity [x, y]
collisions[]
onFloor
floorNodeId
floorNormal [x, y]
onWall
wallNodeId
wallNormal [x, y]
```

Velocity/contact state must never become Project persistence authority.

## 3. Authority model

```text
CharacterController2D config authority
        -> Runtime Node component record

Authored transform authority
        -> Transform2D component / existing semantic command route

Character movement during execution
        -> Transform2DRuntimeStore runtime layer

Collision geometry/filter authority
        -> Collider2D

Scratch blocks
        -> runtime consumer only
```

No CharacterController2D code may make a Scratch Target ID, renderer drawable ID, Rapier handle or Box2D handle into Project identity.

## 4. P0 movement semantics

Implemented P0 runtime API:

```text
setVelocity(nodeId, [x, y])
moveAndCollide(nodeId, [dx, dy])
moveAndSlide(nodeId, [dx, dy])
moveUsingVelocity(nodeId, deltaSeconds)
getVelocity(nodeId)
getController(nodeId)
```

`moveAndCollide` performs a continuous convex SAT translation sweep against active solid Collider2D candidates in the active scene. The earliest deterministic hit stops the character at the configured safe margin and reports travel/remainder/contact normal.

`moveAndSlide` iterates collision response up to `maxSlides`, removes the inward component of the remainder/velocity, classifies floor/wall contacts from `normal dot upDirection`, applies basic step logic, then applies floor snap when appropriate.

## 5. Floor / wall classification

```text
floorThreshold = cos(maxSlopeDegrees)

floor:
normal dot upDirection >= floorThreshold

ceiling:
normal dot upDirection <= -floorThreshold

wall:
abs(normal dot upDirection) < floorThreshold
```

SAT axes have arbitrary sign, so the runtime explicitly orients an impact normal from the static collider toward the moving character before classification.

## 6. Step / snap / moving platform foundation

N6 intentionally implements a constrained foundation rather than claiming a full Godot-equivalent controller:

- Floor snap: implemented.
- Basic translation step: implemented through `stepHeight`.
- Moving-platform translation carry: implemented from the previous floor collider's Transform2D position delta.
- Moving-platform rotation/scale carry: deferred.
- Arbitrary one-way platforms: deferred.
- Dynamic Rigidbody pushing: deferred to Physics2D.

A push-box game can use collision result/`last collision node` plus explicit script/kinematic movement in N6. N6 does **not** pretend to provide dynamic force-based pushing.

## 7. Why N6 does not use Rapier/Box2D yet

The handoff explicitly places CharacterBody2D before the full Physics2D backend POC. N6 therefore owns stable kinematic gameplay semantics over Collider2D and Transform2D without introducing backend body identities.

Later N8 may provide:

```text
ngvge.physics2d-contract@1
        -> replaceable backend
        -> Rapier2D / Box2D
```

CharacterController2D may delegate collision execution to that backend later, but the public component identity, NodeId, config schema, movement protocol and lifecycle remain NGVGE-owned.

## 8. Functional Node admission

Provider gates are monotonic:

```text
StaticBody2D
requires Collider2D runtime provider

CharacterBody2D
requires Collider2D runtime provider
+ CharacterController2D runtime provider
```

`RigidBody2D` remains PLANNED and must not appear merely because StaticBody2D/CharacterBody2D graduated.

## 9. Inspector

The Project Inspector exposes persistent CharacterController2D configuration and read-only runtime diagnostics:

```text
Velocity X/Y          runtime-only
On Floor / On Wall   runtime-only
Floor/Wall Normal    runtime-only
Floor Node            runtime-only
Max Slope             persistent config
Floor Snap            persistent config
Step Height           persistent config
Max Slides            persistent config
Safe Margin           persistent config
Up Direction          persistent config
```

Persistent edits cross `ngvge.character-controller2d-command`; the Inspector does not call Runtime Node storage directly.

## 10. Scratch block bridge

`NGVGE Character2D` exposes runtime movement and state queries. It is a compatibility execution surface, not Project authority.

The bridge may set runtime velocity and request movement, but it has no CharacterController2D persistence mutation API.

## 11. Serialization classification

`.ne` stores the semantic CharacterController2D component and its persistent config fields. Runtime velocity/contact state is excluded.

Scratch `.sb3` has no native CharacterBody2D/CharacterController2D representation. Explicit CharacterBody2D is therefore classified as NGVGE native; future compatibility analysis may offer generated blocks/baked projections, but Scratch artifacts cannot become the canonical authoring source.
