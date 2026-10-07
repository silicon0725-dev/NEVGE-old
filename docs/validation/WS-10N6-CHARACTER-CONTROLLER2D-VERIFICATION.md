# WS-10N6 | CharacterBody2D / CharacterController2D Verification

Status: `IMPLEMENTED / MACHINE SEMANTIC GATES VERIFIED / EDITOR WEBPACK INCONCLUSIVE / BROWSER EVIDENCE PENDING`

## Required machine scope

- stable `ngvge.character-controller2d@1` semantic component;
- native StaticBody2D collision-surface provider;
- native CharacterBody2D provider;
- continuous convex translation sweep using Collider2D geometry/filter semantics;
- `move and collide`;
- `move and slide`;
- runtime velocity;
- floor/wall detection and normals;
- max slope;
- floor snap;
- basic step foundation;
- moving-platform translation carry;
- CharacterController2D semantic Inspector command route;
- read-only runtime diagnostics in Inspector;
- Scratch runtime movement/query blocks;
- runtime state reset on project run boundaries;
- `.ne` native / `.sb3` native-only classification;
- permanent regression coverage;
- inherited N0-N5/HF1 gates.


## Machine evidence

- WS-10N6 dedicated Conformance: **25/25 PASS**.
- WS-10N6 focused suite: **10 suites / 57 tests PASS**; inherited WS-10N0 through WS-10N5/HF1 focused gates also PASS.
- Full Unit Node: **186 suites / 1014 tests PASS**.
- Full Unit DOM: **3 suites / 32 tests PASS**.
- Integration: **9 suites / 10 tests PASS**.
- Smoke: **1/1 PASS**.
- Permanent Regression: **27/27 PASS**.
- TypeScript scoped strict noEmit: **PASS**.
- ESLint correctness gate: **PASS**.
- ARC-C001.1 / 0009 Transform / LRC-G1 / LPL-G1 / LEX-G1 / LSC-G1 / COL-0: **PASS**.
- Production Node Explorer Webpack entry: **PASS**.
- Full Editor Webpack: **INCONCLUSIVE** — execution reached the 300-second limit without a success/failure result. Per Conformance policy, timeout is neither PASS nor FAIL.
- Real Browser Evidence: **PENDING**.

## Browser acceptance

1. Node Explorer shows `StaticBody2D` and `CharacterBody2D`. `RigidBody2D` remains unavailable.
2. Creating either native body does **not** add a Scratch target.
3. StaticBody2D appears with Transform2D + solid Collider2D and its collider is visible through the frozen N5/HF1 editor overlay.
4. CharacterBody2D appears with Transform2D + solid Collider2D + CharacterController2D.
5. CharacterController2D Inspector shows persistent Max Slope, Floor Snap, Step Height, Max Slides, Safe Margin and Up Direction fields.
6. Inspector runtime Velocity / On Floor / On Wall / normals change while runtime movement executes, but these values are read-only authoring diagnostics.
7. A CharacterBody2D moved downward into a StaticBody2D floor stops without tunneling at a normal gameplay displacement and reports `is on floor = true`, floor normal approximately `(0, 1)`.
8. Moving horizontally into a StaticBody2D wall stops and reports `is on wall = true` with the expected opposing normal.
9. A diagonal `move and slide` preserves the tangential component instead of freezing all motion at first contact.
10. A slope under Max Slope is classified as floor; a steeper slope is not.
11. Floor Snap keeps a descending/non-rising character attached across a small downward gap, while upward/jump velocity is not snapped back to the floor.
12. With Step Height > 0, a sufficiently small translation step can be traversed; an obstacle taller than the configured step is blocked.
13. After establishing floor contact, translate the StaticBody2D platform. On the next character movement/update, the CharacterBody2D inherits the platform translation delta.
14. Camera2D translate/rotate/non-uniform zoom keeps both StaticBody2D and CharacterBody2D collider overlays aligned.
15. `NGVGE Character2D` Scratch blocks can set velocity, move, query floor/wall state and read collision/floor node identity.
16. Scratch native `touching?` remains unchanged; it is not redirected through CharacterController2D.
17. Run the project, move CharacterBody2D using runtime velocity, then Stop. Runtime position returns to authored Transform2D and velocity/floor/wall state resets.
18. Save/reload the NGVGE project: CharacterController2D config survives, while runtime velocity/contact state does not become serialized authoring data.
19. `.sb3` compatibility UI/analyzer must not claim CharacterBody2D is a native Scratch feature.
20. **HF1 regression:** put StaticBody2D and CharacterBody2D at local `[0,0]` under two Scratch-bound Sprite parents that are visibly separated. Collider gizmos must follow the parent world transforms and `overlaps?` must be false until the parents actually overlap.
21. Move/rotate/non-uniformly scale either semantic parent and confirm descendant Collider world geometry updates; nested CharacterBody2D movement remains world-space from the gameplay API.

## Evidence policy

Browser evidence is mandatory before WS-10N6 can be declared COMPLETE/FROZEN. Machine success alone does not certify gameplay feel, Stage overlay alignment, Inspector live state, or run-boundary reset behavior.
