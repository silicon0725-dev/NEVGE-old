# WS-10N5 | Collider2D + Area2D Verification

Status: `FROZEN / MACHINE VERIFIED / BROWSER VERIFIED`

## Machine scope

- `ngvge.collider2d@1` portable component contract;
- Rectangle / Circle / Capsule / Convex Polygon schemas;
- layer/mask + sensor semantics;
- explicit Transform2D inheritance policy;
- backend-independent overlap / point / ray / shape query provider;
- Area enter/exit overlap-set transitions;
- Area2D native Functional Node creation;
- provider-aware Area2D Node Library admission;
- dedicated persistent Collider2D command capability;
- Collider2D Inspector editing;
- Camera-aware Stage collider gizmo;
- Scratch query blocks without touching native Scratch `touching?`;
- `.ne` native / `.sb3` native-only classification.

## Permanent commands

```text
npm run test:node-plan:ws10n5:machine
npm run test:node-plan:ws10n5:focused
npm run test:node-plan:ws10n5:webpack
```

## Machine evidence — 2026-08-16

```text
WS-10N5 Conformance                 PASS 21/21
WS-10N5 focused tests               PASS 10 suites / 55 tests
Inherited WS-10N0..N4 focused       PASS
Full Unit / Node                    PASS 181 suites / 996 tests
Full Unit / DOM                     PASS 3 suites / 32 tests
Integration                         PASS 8 suites / 9 tests
Smoke                               PASS 1/1
Permanent Regression                PASS 26/26
TypeScript                          PASS
ESLint correctness                  PASS
ARC-C001.1                          PASS
0009 Transform2D                    PASS
LRC-G1 / LPL-G1 / LEX-G1           PASS
LSC-G1 / COL-0                      PASS
Production Node Explorer Webpack    PASS
Production full Editor Webpack      INCONCLUSIVE (execution timeout)
Browser Evidence                    PASS (accepted before WS-10N6 transition)
```

The full Editor Webpack command reached the real production editor entry but did not complete before the execution timeout. Per NGVGE gate policy, timeout is recorded as `INCONCLUSIVE`, not PASS or FAIL. The historical full Editor Webpack timeout remains recorded as `INCONCLUSIVE`; the subsequent browser acceptance closes the UI evidence gate and N5 is frozen before WS-10N6.

The permanent regression layer now contains a dedicated `collider2d-area2d` contract so backend isolation, rigid-body separation, Convex Polygon validity, Area sensor preset and query/transition semantics cannot silently regress.

## Browser acceptance

1. Node Explorer shows `Area2D` alongside the already-frozen Node2D / Sprite2D / Camera2D entries. `StaticBody2D`, `CharacterBody2D`, `RigidBody2D` remain unavailable.
2. Create Area2D. Native Node count increases by one; Legacy Scratch target count does not change.
3. Select Area2D. Inspector shows Transform2D + Collider2D. Default Collider is Rectangle 100×100, Layer 1, Mask 1, Sensor enabled.
4. Change Rectangle size, Offset and Local Rotation. The Stage collider gizmo must update immediately.
5. Switch through Circle, Capsule and Convex Polygon. Gizmo shape and runtime query result must update; no Scratch target/costume is created.
6. Move/rotate/non-uniformly scale Area2D with standard Transform2D fields. Gizmo must follow the same semantic transform. Test `Ignore Node Scale` separately.
7. Create a second Area2D. Move it into and out of the first Area. `overlap count` / overlap reporter must switch correctly and the runtime must produce enter/exit transitions.
8. Set incompatible Layer/Mask values. Areas that geometrically intersect must stop reporting semantic overlap until filters match again.
9. Test point query and ray query against a known shape/position.
10. Activate Camera2D and test translated, zoomed, rotated and non-uniformly zoomed camera states. Collider gizmo must remain aligned with the world collider.
11. Disable/delete Camera2D. Collider gizmo must return to exact Scratch baseline viewport alignment.
12. Verify the native Scratch `touching?` block still behaves exactly as Scratch did before N5 and is not redirected into Collider2D.
13. Run the NGVGE Collision2D Scratch blocks. They must query Area/Collider runtime state without persisting transient runtime results into project component data.
14. Save/reload the NGVGE project path used by the current scene persistence layer and confirm Collider2D component data survives; `.sb3` compatibility must not claim native Collider support.

## Evidence policy

Machine success does not substitute for the Stage gizmo / Camera2D alignment / Scratch `touching?` browser checks. These checks were accepted before the explicit transition to WS-10N6; WS-10N5 is now frozen.
