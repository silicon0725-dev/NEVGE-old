# WS-10N6-HF5 Verification

Machine status: PASS
Browser status: **BROWSER EVIDENCE PENDING**

Machine evidence:

- HF5 Conformance: 10/10 PASS
- N0 → N6-HF4 inherited focused chain: PASS
- HF5 focused: 5 suites / 30 tests PASS
- Full Unit Node: PASS
- Full Unit DOM: PASS
- Integration: 10 suites / 11 tests PASS
- Smoke: 1/1 PASS
- Permanent Regression: 30/30 PASS
- TypeScript: PASS
- ESLint correctness: PASS
- ARC-C001.1 minimum baseline: PASS
- 0009 Transform2D DoD: PASS
- LRC-G1 / LPL-G1 / LEX-G1 / LSC-G1 / COL-0: PASS
- Production Node Explorer Webpack: PASS (0 errors / 0 warnings)
- Full Editor Webpack: INCONCLUSIVE — execution window elapsed without a success/failure result; this is neither PASS nor FAIL.

## Browser Gate

1. Create/select a `StaticBody2D` or `CharacterBody2D`; Collider2D Inspector must immediately show Shape and shape-specific dimensions.
2. Rectangle: type Width/Height values, press Enter or leave the field; visible gizmo and collision result must update.
3. Rectangle: drag edge and corner handles on Stage; Width/Height must update in Inspector and persist.
4. Circle: switch from Rectangle; current bounds should be preserved rather than resetting to a fixed unrelated size. Change Radius numerically and with Stage radius handle.
5. Capsule: Radius and Height must be editable; increasing Radius beyond half the old Height must automatically increase Height to remain legal. Height cannot become smaller than diameter.
6. Convex Polygon: vertex rows must be editable; `+ Add Vertex` and remove controls must work while retaining at least 3 vertices. Stage vertex handles must update the same points. Concave/degenerate edits must be rejected visibly instead of silently replacing the shape.
7. Drag the center handle; Collider Offset X/Y must change while Node Transform stays unchanged.
8. Drag the rotation handle; Local Rotation must update while Node Transform rotation stays unchanged.
9. Repeat Stage handle edits under Camera2D translation, rotation and non-uniform zoom; pointer and visible geometry must remain aligned.
10. Nest the collider below transformed parent Nodes/Scratch-bound Sprite; direct manipulation must still edit local Collider geometry correctly.
11. Collision Shapes = All must continue to show all active colliders; selected shape authoring handles appear only on the selected Collider2D.
12. Two colliders moved apart/together after resizing must return overlap false/true consistently with the visible geometry.
13. Stop/restart and project reload: Collider shape/offset/rotation persist; editor-only gizmo visibility/test-drive runtime state follows its existing editor/runtime policy.

Only after these browser checks pass may HF5 contribute to WS-10N6 Freeze.
