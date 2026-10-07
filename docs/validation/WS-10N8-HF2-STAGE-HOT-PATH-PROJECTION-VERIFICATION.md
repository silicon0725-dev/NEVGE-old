# WS-10N8-HF2｜Stage Hot-Path Projection & Debug Canvas — Verification

Status: **MACHINE VERIFIED / BROWSER EVIDENCE PENDING**

## Required machine evidence

- affine projector samples a Capability transform exactly three times and reuses it for thousands of point projections;
- camera-only TileMap redraw does not re-call `listLayers()`;
- selected TileMap bounded draw enumerates only visible sparse chunks;
- TileMap collision provider supports viewport AABB spatial query;
- Collider debug viewport snapshot consumes spatial providers and keeps overlap state opt-in;
- scene-wide collision debug is one Canvas projection while selected authoring remains SVG/handles;
- Collider/TileMap Transform dependency checks are Set-based after structural warm-up;
- all inherited N5/N6/N7/N8 collision and physics correctness gates remain green.

## Browser evidence required

1. compare Collision Shapes `Off`, `All + Contacts Off`, and `All + Contacts On` on the same large TileMap;
2. pan/zoom Camera2D while Collision Shapes = All and confirm no obvious per-tile DOM churn or frame collapse;
3. run several RigidBody2D instances over a large TileMap and verify unrelated dynamic motion does not rebuild static TileMap collision;
4. select a TileMap and pan across a large sparse map; editor responsiveness must scale with visible chunks rather than total map size;
5. select one Collider2D and verify SVG handles remain interactive while bulk debug is Canvas;
6. verify collision/overlap correctness is unchanged when Contacts is enabled;
7. if frame drops remain, capture the in-browser frame profiler before further optimization rather than inferring the hotspot.

## Machine evidence

- WS-10N8-HF2 Conformance: **15/15 PASS**.
- HF2 focused: **9 suites / 37 tests PASS**.
- Full Unit / Node: **210 suites / 1090 tests PASS**.
- Full Unit / DOM: **3 suites / 33 tests PASS**.
- Full Integration: **12 suites / 13 tests PASS**.
- Smoke: **1/1 PASS**.
- Permanent Regression: **36/36 PASS**.
- TypeScript scope: **PASS**.
- ESLint correctness: **PASS**.
- ARC-C001.1 Minimum Baseline: **7/7 PASS, 0 active waivers, 0 blockers**.
- 0009 Transform DoD: **12/12 PASS**.
- LRC-G1 **15/15**, LPL-G1 **17/17**, LEX-G1 **19/19**, LSC-G1 **19/19**, COL-0 **15/15**: **PASS**.
- Production Node Explorer Webpack: **PASS, 0 errors / 0 warnings**.
- Full Editor Webpack: **BLOCKED / INCONCLUSIVE FOR HF2** — the existing N8 production dependency `@dimforge/rapier2d-compat` is not installed in this validation container, so Webpack reports `Module not found` before a complete editor build can be certified. This is not counted as an HF2 PASS.

## Complexity evidence

The focused tests permanently lock these hot-path reductions:

- 4,000 Camera2D point projections require **3** capability `worldToScreen` samples, not 4,000 boundary calls.
- 4,096 TileMap local→world projections require **3** capability samples.
- Camera-only TileMap redraw does **not** re-call `listLayers()`.
- unrelated dynamic Transform updates use cached dependency-set membership instead of full scene membership scans.
- selected TileMap drawing enumerates only sparse chunks intersecting visible cell bounds.
- TileMap collision debug can query viewport AABB projections instead of preparing every off-screen tile collider.

These are machine complexity/correctness results, not browser FPS evidence.
