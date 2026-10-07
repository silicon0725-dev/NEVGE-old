# WS-10N8｜Physics2D Backend POC Verification

Status: **MACHINE VERIFIED / REAL RAPIER PACKAGE EXECUTION PENDING / BROWSER EVIDENCE PENDING**

## Verified machine scope

- `ngvge.physics2d-contract@1` replaceable backend boundary;
- stable RigidBody2D ComponentId identity independent from backend handles;
- global PhysicsMaterial2D ResourceId authority;
- RigidBody2D functional-node semantic graduation plus backend-readiness product gate;
- fixed-step scheduling and bounded catch-up;
- dynamic-body writes go only to Transform2DRuntimeStore;
- Stop restores authored transforms and clears transient velocity state;
- Rapier2D adapter conversion boundary through a test-only API double;
- one-collider mass mapping uses collider mass, not Rapier additional-mass-as-total semantics;
- backend handles remain private and only a boolean presence diagnostic crosses the runtime capability;
- Scene Module uses a facade-safe backend-adapter provider seam rather than transporting raw Rapier constructors/classes;
- Inspector edits RigidBody2D through a semantic command capability;
- `.ne` native / `.sb3` native-only compatibility classification.

## Dependency/runtime limitation

`@dimforge/rapier2d-compat@0.19.3` is pinned in `package.json` and `bun.lock`, but the package is not installed in the current verification container. Test helpers are explicitly test-only and are not a production substitute. Therefore real Rapier WASM/package execution and production Editor Webpack resolution are not claimed as PASS here.

## Machine evidence

- WS-10N8 Conformance: **27/27 PASS**.
- WS-10N8 focused: **12 suites / 57 tests PASS**.
- Monotonic N2 / N2-HF1 / N5 / N6 / N7 gates: **PASS** after RigidBody2D graduation.
- Full Unit / Node: **208 suites / 1077 tests PASS**.
- Full Unit / DOM: **3 suites / 33 tests PASS**.
- Full Integration: **12 suites / 13 tests PASS**.
- Smoke: **1/1 PASS**.
- Permanent Regression: **34/34 PASS**.
- TypeScript: **PASS**.
- ESLint correctness: **PASS**.
- ARC-C001.1 Minimum Baseline: **7/7 PASS, 0 active waivers, 0 blockers**.
- 0009 Transform A/B/C/D/E + DoD: **12/12 PASS**.
- LRC-G1 / LPL-G1 / LEX-G1 / LSC-G1 / COL-0 certification: **PASS**.
- Production Node Explorer Webpack: **PASS, 0 errors / 0 warnings**.
- Full Editor Webpack: **INCONCLUSIVE** — the 300-second execution window elapsed before final Webpack statistics.
- Real Rapier package resolution/execution in this container: **BLOCKED / NOT INSTALLED** (`@dimforge/rapier2d-compat` is pinned but absent from `node_modules`). This is not recorded as a semantic-contract PASS or FAIL.

Per project policy, the timed-out Editor build remains INCONCLUSIVE. The test-only backend/API doubles prove the NGVGE adapter boundary and runtime semantics only; they are not evidence that the production Rapier package executed.

## Browser acceptance

1. After dependency install/startup, Physics2D backend status becomes Ready and only then RigidBody2D appears in the functional-node creation UI.
2. Create StaticBody2D floor + RigidBody2D above it; running simulation makes the dynamic body fall and collide rather than pass through the floor.
3. Stopping simulation restores the authored Transform2D pose.
4. Inspector Mass, Gravity Scale, Linear/Angular Damping, Freeze Rotation, CCD, initial Velocity/Angular Velocity and Sleeping settings affect a new run without exposing any backend handle.
5. Friction/Restitution work from per-body fallback values and from a bound PhysicsMaterial2D resource.
6. Multiple dynamic bodies collide with each other while retaining stable NGVGE NodeId/ComponentId identity.
7. Area2D/sensor behavior remains semantic and does not become a persistent Rapier sensor handle identity.
8. CharacterBody2D remains controllable through the N6 character solver while participating in the same world collision environment as the backend projection.
9. TileMap collision remains visible/usable after Physics2D backend activation.
10. Camera2D/debug overlays remain aligned while dynamic runtime transforms change.
11. Save/reload preserves authored RigidBody2D/PhysicsMaterial2D settings but not per-frame runtime poses/velocities/backend handles.
12. A forced backend initialization failure must hide/fail-close RigidBody2D product admission instead of creating a fake node.
