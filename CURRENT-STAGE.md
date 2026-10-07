# CURRENT STAGE

## WS-10N8-HF14.10 | Mixed Affected-Collider Presentation Routing

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

HF14.10 fixes the HF14.9 fallback hole where one transform refresh affects both the selected Collider and additional non-selected Colliders. The affected set is partitioned: the selected Collider stays on the direct DOM presentation path while the remaining dynamic Colliders use the sampled 20 Hz Canvas path. Full viewport snapshot / React fallback is retained when either required branch cannot safely consume its share.

HF14.9 Rapier, TileMap projection reuse, Scratch UI containment, mouse layout cache and dynamic Collider presentation policies remain unchanged.

Machine gate: HF14.10 conformance 8/8 PASS; permanent regression 56/56 PASS; Full Unit Node 219 suites / 1130 tests PASS; Full Unit DOM 33/33 PASS; Integration 12 suites / 13 tests PASS; Smoke 1/1 PASS; TypeScript PASS; ESLint correctness PASS.
