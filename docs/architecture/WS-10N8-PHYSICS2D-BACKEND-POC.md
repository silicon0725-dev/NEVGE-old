# WS-10N8｜Physics2D Backend POC

Status: **IMPLEMENTED / MACHINE VERIFIED / REAL RAPIER PACKAGE EXECUTION PENDING / BROWSER EVIDENCE PENDING**

WS-10N8 is the first stage where NGVGE delegates general 2D rigid-body execution to a replaceable third-party physics backend instead of extending the N6 CharacterController solver into a proprietary physics engine.

## Frozen authority boundary

```text
NGVGE semantic authority
├─ NodeId
├─ ComponentId / RigidBodyId
├─ Collider2D
├─ RigidBody2D
├─ PhysicsMaterial2D ResourceId
├─ Transform2D persistent/runtime authority
└─ Physics2D contract + scheduler policy
        ↓
ngvge.physics2d-backend-adapter@1
        ↓
replaceable execution backend
└─ Rapier2D POC
```

Backend body/collider handles are adapter-private execution storage. They are not NodeId, ColliderId, RigidBodyId, ResourceId, `.ne` data, protocol identity, Inspector identity or Scratch compatibility identity.

## Physics2D contract

`ngvge.physics2d-contract@1` owns backend isolation and fixed-step policy. The P0 default is 60 Hz, gravity `[0, -980]` NGVGE world-units/s², a bounded frame delta and bounded catch-up steps. Those values are policy/defaults, not Rapier identity.

Dynamic body transforms write only `Transform2DRuntimeStore`. Persistent authored Transform2D remains unchanged while simulation runs, and Stop/reset rehydrates authored transforms.

## RigidBody2D

`ngvge.rigidbody2d@1` is a native component whose stable RigidBodyId is its Runtime ComponentId. P0 authored fields are:

- enabled;
- mass;
- initial velocity;
- initial angular velocity;
- gravity scale;
- linear/angular damping;
- freeze rotation;
- CCD;
- initial sleeping state;
- friction/restitution fallback values;
- optional PhysicsMaterial2D ResourceId.

Runtime velocity, angular velocity, sleeping state and backend-handle presence are diagnostic runtime state and are not persisted each fixed step.

## PhysicsMaterial2D

`ngvge.physics-material2d-resource@1` is a global ResourceId-backed resource. P0 owns friction and restitution. Density/multi-collider mass distribution is deliberately deferred. `RigidBody2D.mass` is the current authored total-mass authority for the one-semantic-collider POC; the Rapier adapter applies that mass at the collider execution layer instead of treating Rapier `additionalMass` as total NGVGE mass.

## Functional node admission

RigidBody2D has graduated in the core functional-node contract, but product admission fails closed unless a real `ngvge.physics2d-backend-adapter@1` is ready. A missing/failed backend must not produce a UI-only fake RigidBody2D node.

StaticBody2D, Area2D, CharacterBody2D and TileMap collision remain their existing NGVGE semantic models. The Physics runtime projects them into the replaceable backend as fixed/sensor/kinematic execution bodies where needed; it does not change their persistent identity.

## Rapier2D POC adapter

The first production adapter is isolated in `src/lib/physics-system/rapier2d-backend-adapter.js`; package loading is isolated in `rapier2d-package-loader.js`. The semantic runtime never imports Rapier directly.

Current execution mapping uses 100 NGVGE world units = 1 physics meter. Canonical Collider2D geometry stays backend-independent. Convex world geometry is projected to backend collider geometry; any polygon approximation of canonical circles/capsules is an adapter detail, not a schema change.

The dependency is pinned to `@dimforge/rapier2d-compat@0.19.3`. The package is intentionally not vendored or replaced with a fake production shim. This working verification container does not contain the installed package, so real-package WASM execution and full production Editor bundling remain pending until dependencies are installed on a clean project environment.

## Backend provider seam

Module boundaries may provide an already-conforming `physics2d-backend-adapter`. Raw Rapier constructors/classes are not transported through the module service facade. The normal production path loads the package inside Scene System/backend implementation code and publishes only NGVGE DTO/capability state outward.

## Compatibility

- `.ne`: native Physics2D/RigidBody2D/PhysicsMaterial2D semantics.
- `.sb3`: RigidBody2D and PhysicsMaterial2D are native-only NGVGE features and require compatibility analysis/baking/fallback; Scratch IDs never become physics identities.

## POC non-goals

- no joints;
- no full force/impulse authoring API yet;
- no multi-collider mass-distribution/density policy;
- no persistent backend selection as semantic identity;
- no Rapier/Box2D handles in project/protocol/Inspector;
- no claim that N6 CharacterController2D has been replaced by Rapier's character controller;
- no claim that Area2D enter/exit authority has moved away from the existing semantic Collider runtime;
- no fake real-Rapier execution evidence when the package is not installed.
