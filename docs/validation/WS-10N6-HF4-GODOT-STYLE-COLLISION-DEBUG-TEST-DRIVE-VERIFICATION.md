# WS-10N6-HF4 Verification

Status: MACHINE VERIFIED / PRODUCTION NODE-EXPLORER WEBPACK PASS / FULL EDITOR WEBPACK INCONCLUSIVE / BROWSER EVIDENCE PENDING

## Machine evidence

- WS-10N6-HF4 Conformance: PASS 9/9.
- N0 -> N6-HF3 inherited focused chain: PASS.
- HF4 focused suites: PASS, 7 suites / 25 tests.
- Full Unit Node: PASS, 192 suites / 1031 tests.
- Full Unit DOM: PASS, 3 suites / 32 tests.
- Integration: PASS.
- Smoke: PASS.
- Permanent Regression: PASS, including `collision-debug-test-drive`.
- TypeScript: PASS.
- ESLint correctness: PASS for source/tooling and tests.
- ARC-C001.1 / 0009 Transform DoD / LRC-G1 / LPL-G1 / LEX-G1 / LSC-G1 / COL-0: PASS.
- Production Node Explorer Webpack: PASS, 0 errors / 0 warnings.
- Full Editor Webpack: INCONCLUSIVE. The production editor-entry validation exceeded the 300-second execution limit and produced neither a success nor failure result. Per NGVGE conformance rules this is not PASS and not FAIL.

## Browser evidence gate

1. Create/select a StaticBody2D or CharacterBody2D. Its collision shape must be visible on Stage without starting the project.
2. Set Stage `Collision Shapes = Off`. The selected collider must remain visible as an authoring shape; unselected inherited colliders must hide.
3. Set `Collision Shapes = All`. All active colliders must be visible.
4. Set one Collider Inspector `Gizmo = Hidden`; that node must remain hidden even while selected.
5. Move/rotate/scale a parent Sprite/Node or Camera2D. Collision visualization must remain aligned with collision queries.
6. Put two colliders into overlap. Their Stage debug shape must visibly enter the overlap state and show `COLLISION`; separate them and it must clear.
7. Select CharacterBody2D and use `Editor Test Drive -> Platformer -> Start Test`. A/D or arrows must move through CharacterController2D; Space must jump; preview gravity must make the body land on StaticBody2D.
8. CharacterBody2D must not penetrate StaticBody2D while Test Drive uses move-and-slide.
9. `Pause` must leave the runtime pose inspectable. `Reset` must restore authored Transform and clear Character runtime state.
10. Top-down Test Drive must move with WASD/arrows without preview gravity.
11. Editing an Inspector input/select must not be hijacked by Test Drive keyboard input.
12. Test Drive speed/gravity/jump settings and visible-collision debug policy must not enter project gameplay component persistence.
13. Scratch `touching?` remains independent.
14. Player-only/full-screen/export output must not contain editor debug shapes or Test Drive UI.

Do not Freeze WS-10N6 until real browser evidence passes this gate together with inherited HF2/HF3 gates.
