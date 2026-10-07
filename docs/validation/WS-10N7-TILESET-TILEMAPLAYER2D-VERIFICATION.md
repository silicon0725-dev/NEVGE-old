# WS-10N7｜TileSet Resource + TileMapLayer2D Verification

Status: **FROZEN / MACHINE VERIFIED / BROWSER VERIFIED**

Browser Evidence: **USER-CONFIRMED PASS (2026-08-18)**. The real editor TileSet / TileMapLayer2D flow was reported as having no blocking issues; WS-10N7 is frozen after this browser verification.

## Focus of machine verification

- ResourceId-backed global TileSet authority;
- TileSet texture references a global Image ResourceId, never a renderer handle;
- TileMapLayer2D native Functional Node provisioning with Transform2D;
- default TileSet binding at Functional Node creation;
- Sparse Chunk storage including negative coordinates and empty-chunk removal;
- Pencil/Eraser/Picker/Rectangle/Line/Flood Fill/Select-Move/Copy-Paste algorithms;
- Flip/quarter-rotation, deterministic Random Variant and basic terrain auto-connect seams;
- TileMap editor transient preview + one persistent patch per gesture;
- Inspector TileSet/TileMap authoring controls;
- passive runtime render projection for unselected TileMap layers;
- Camera2D-aware editor/render projection;
- Tile collision enters the existing Collider2D Runtime via external projection provider;
- Character/Collider queries see TileMap collision without a Physics2D backend;
- navigation projection foundation and editor debug toggle;
- `.sb3` remains a bake/partial projection, not native TileMap authority;
- Scratch List authoring authority remains forbidden.

## Machine evidence

- WS-10N7 conformance: **25/25 PASS**.
- WS-10N7 focused Node: **7 suites / 27 tests PASS**.
- WS-10N7 focused DOM harness: **2 suites / 28 tests PASS**.
- WS-10N7 focused integration: **1 suite / 1 test PASS**.
- Inherited N0→N6-HF7 focused gates: **PASS** in the aggregate run before its execution window elapsed; N7-local focused evidence was then rerun independently to completion.
- Full Unit / Node: **201 suites / 1063 tests PASS**.
- Full Unit / DOM: **3 suites / 33 tests PASS**.
- Full Integration: **11 suites / 12 tests PASS**.
- Smoke: **1/1 PASS**.
- Permanent Regression: **33/33 PASS**.
- TypeScript scope/compiler: **PASS**.
- ESLint correctness (source/tooling + tests): **PASS**.
- ARC-C001.1 minimum baseline: **7/7 PASS, 0 active waivers, 0 blockers**.
- 0009 Transform2D A/B/C/D/E + DoD: **12/12 PASS**.
- LRC-G1: **15/15 PASS**.
- LPL-G1: **17/17 PASS**.
- LEX-G1: **19/19 PASS**.
- LSC-G1: **19/19 PASS**.
- COL-0: **15/15 PASS**.
- Production Node Explorer Webpack: **PASS, 0 errors / 0 warnings**.
- Full Editor Webpack: **INCONCLUSIVE** — the 300-second execution window elapsed before final Webpack success/failure statistics were emitted.

Per project policy, the timed-out aggregate/full-editor commands are not promoted to PASS or FAIL. Browser Evidence is still required before N7 can be frozen.

## Browser acceptance required

1. Create TileMapLayer2D and verify no Scratch Target is added.
2. Verify a global TileSet Resource is automatically bound by ResourceId.
3. Bind an Image Resource atlas; set Tile Size, rows/columns, margin and separation; verify atlas tiles render correctly.
4. Paint across positive and negative cell coordinates with Pencil; erase cells and confirm empty space stays sparse.
5. Verify fast pointer movement produces a continuous Pencil/Eraser stroke with no skipped cells.
6. Verify Picker, Rectangle, Line and bounded Flood Fill.
7. Select a region, drag-move it, Copy/Paste it, and verify one authoring transaction per completed gesture.
8. Verify Flip X/Y and 0/90/180/270 rotation.
9. Configure two or more tiles in one Variant Group and verify Random Variant is stable for the same cell.
10. Configure Terrain ID/masks and verify the basic four-neighbour Terrain tool reconnects adjacent tiles.
11. Configure Rectangle/Circle/Capsule/Convex Polygon tile collision, including offset/rotation, and verify Collision Debug matches the tile art/grid.
12. Place a CharacterBody2D above collidable tiles; Test Drive must stop on the TileMap collision without StaticBody2D helper nodes.
13. Enable Navigation metadata/debug and confirm navigation-marked tiles are visibly projected; no full pathfinding claim is required.
14. Apply TileMap Transform2D and Camera2D translation/rotation/zoom; grid, tile art and collision projection must stay aligned.
15. Deselect the TileMap and verify it remains visible through the passive render projection; select another TileMap and verify both layers remain visible.
16. Verify layer `visible`, `zIndex` and Y-sort behavior between native TileMap layers.
17. Save/reload and verify TileSet ResourceId, TileSet metadata, Sparse Chunks and TileMap binding are preserved.
18. Scratch `.sb3` export must classify TileMap as bake/partial and must not serialize native authoring state into Scratch Lists as authority.
