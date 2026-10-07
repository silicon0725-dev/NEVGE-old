# WS-10N8-HF14｜Rapier Shape-Aware Collision Backend Adoption

Status: **IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED**

## 1. Problem

HF13 browser A/B established a shape-dependent runtime cost gap while rectangle collision remained close to the frame budget:

- rectangle: approximately 58.8 FPS;
- circle: approximately 19.3 FPS;
- capsule: approximately 11.0 FPS.

The legacy CharacterController2D narrow phase materializes every Collider2D as world-space convex polygon points. Native Circle and Capsule semantics therefore become 32/34-point polygon SAT queries. This is appropriate as a compatibility fallback and editor/debug representation, but it is not an appropriate primary runtime representation for analytic primitives.

HF14 does **not** reduce tessellation accuracy. It changes the collision backend representation.

## 2. Authority boundary

ARC-0001 remains unchanged.

NGVGE continues to own:

- Collider2D semantic shape and component identity;
- CharacterController2D move-and-slide / floor / wall / step / snap / recovery semantics;
- Transform2D runtime writer authority;
- collision layer / mask and sensor semantics;
- project persistence and `.ne` serialization;
- runtime lifecycle and capability protocol.

Rapier is a replaceable geometry/query backend. No Rapier body/collider/query handle becomes persistent NGVGE authority.

## 3. Shape-aware primitive mapping

When the transformed geometry can be represented exactly by the semantic primitive, HF14 maps:

| NGVGE Collider2D | Rapier runtime representation |
| --- | --- |
| Rectangle | `Cuboid` / `ColliderDesc.cuboid` |
| Circle | `Ball` / `ColliderDesc.ball` |
| Capsule | `Capsule` / `ColliderDesc.capsule` |
| Convex / unsafe transformed primitive | `ConvexPolygon` / `ColliderDesc.convexHull` |

Primitive fitting is deliberately conservative. A non-uniformly scaled circle, sheared rectangle, or otherwise non-representable transformed primitive falls back to convex geometry rather than changing collision semantics.

The existing Circle/Capsule 32/34-point materialization remains available for editor visualization, debug geometry, and compatibility fallback. It is no longer the preferred narrow-phase representation when an exact Rapier primitive exists.

## 4. CharacterController2D query backend

HF14 retains the NGVGE CharacterController2D state machine. It replaces the expensive geometry operation beneath that state machine when the Rapier query backend is ready.

A CharacterController movement creates one collision query session:

```text
moveAndSlide / moveAndCollide
        |
        +-- enumerate solid candidates once
        +-- prepare moving primitive once
        +-- prepare candidate primitives once
        |
        +-- sweep / slide / step / snap
        |       -> Rapier Shape.castShape
        |
        +-- placement / recovery
                -> Rapier Shape.contactShape
```

The implementation intentionally uses Rapier/Parry shape-to-shape queries rather than forcing a Rapier `World.step()` merely to refresh world-query broad-phase state. This keeps collision queries side-effect free with respect to the Physics2D simulation clock.

## 5. Fail-safe fallback

The Rapier path is admitted only when **all** candidates in the movement session can be prepared safely.

If the backend is unavailable, still initializing, fails to load, or any candidate cannot be represented, the whole query falls back to the existing NGVGE continuous convex SAT path. HF14 never silently drops an unprepared Collider from collision consideration.

This fallback is deliberately retained as a compatibility and recovery mechanism, not as the preferred Circle/Capsule runtime path.

## 6. Physics2D backend mapping

The existing Physics2D Rapier adapter now also receives the semantic Collider2D shape type. It creates native Rapier collider descriptors for exact Rectangle/Circle/Capsule primitives and uses convex hull only when required.

This aligns RigidBody2D and CharacterController2D geometry with the same shape-aware backend semantics without moving NGVGE authority into Rapier.

## 7. Diagnostics

HF14 adds:

- `Character Collision Query` profiler category;
- `characterCollisionQuerySessions`;
- `characterCollisionCandidates`;
- `characterRapierQuerySessions`;
- `characterRapierPreparedCandidates`;
- `characterRapierShapeCasts`;
- `characterRapierContactQueries`;
- legacy fallback counters for SAT queries;
- profiler `diagnosticsVersion: "WS-10N8-HF14"`.

The diagnostics version is an explicit browser-build identity guard. Browser performance evidence is not accepted as HF14 evidence unless that field is present.

## 8. Non-goals

HF14 does not:

- replace NGVGE CharacterController2D with Rapier's high-level character-controller policy;
- change Collider2D schema or `.ne` serialization;
- reduce Circle/Capsule visual tessellation;
- remove continuous SAT fallback;
- re-introduce rejected HF12 broad-phase or collision-refresh batching;
- freeze WS-10N8.

## 9. Browser gate

HF14 requires Production browser re-test of the same Rectangle / Circle / Capsule runtime collision scenario.

Minimum evidence:

1. `diagnosticsVersion === "WS-10N8-HF14"`;
2. Circle/Capsule movement shows `characterRapierShapeCasts > 0`;
3. `characterSatShapeCasts` is zero or limited to a documented fallback case;
4. Circle/Capsule frame P95 and LoAF materially improve versus HF13;
5. floor, wall, slide, step, snap, and recovery remain behaviorally correct.

WS-10N8 remains **NOT FROZEN** until this browser gate is complete.
