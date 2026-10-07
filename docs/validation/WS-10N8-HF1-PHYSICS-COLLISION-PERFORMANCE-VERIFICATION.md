# WS-10N8-HF1｜Physics & Collision Debug Performance — Verification

Status: **MACHINE VERIFIED / BROWSER EVIDENCE INSUFFICIENT / SUPERSEDED BY WS-10N8-HF2**

## Machine evidence

Focused performance/correctness tests cover:

- one Collider2D debug snapshot instead of per-collider overlap queries;
- broad-phase overlap state correctness;
- collision refresh batching;
- large debug geometry switching to SVG path batches;
- no unselected center-cross DOM explosion;
- TileMap collision projection cache stability under unrelated Transform2D updates;
- TileMap cache invalidation when its own Transform changes;
- Physics descriptor/backend synchronization reuse across unchanged fixed steps.


## Full machine quality evidence

- WS-10N8-HF1 Conformance: **12/12 PASS**.
- HF1 focused performance/correctness: **4 suites / 21 tests PASS**.
- WS-10N8 inherited Conformance: **27/27 PASS**.
- Full Unit / Node: **208 suites / 1080 tests PASS**.
- Full Unit / DOM: **3 suites / 33 tests PASS**.
- Full Integration: **12 suites / 13 tests PASS**.
- Smoke: **1/1 PASS**.
- Permanent Regression: **35/35 PASS**.
- TypeScript scope: **PASS**.
- ESLint correctness: **PASS**.
- ARC-C001.1 Minimum Baseline: **7/7 PASS, 0 active waivers, 0 blockers**.
- 0009 Transform DoD: **12/12 PASS**.
- LRC-G1 **15/15**, LPL-G1 **17/17**, LEX-G1 **19/19**, LSC-G1 **19/19**, COL-0 **15/15**: **PASS**.
- Production Node Explorer Webpack: **PASS, 0 errors / 0 warnings**.
- Full Editor Webpack: **INCONCLUSIVE** — the 300-second execution window elapsed before final Webpack statistics.

## Synthetic benchmark evidence

These are deterministic Node development fixtures, not real-browser frame-rate claims.

| Fixture | N8 baseline | HF1 |
|---|---:|---:|
| 1024 collidable tiles, 20 unrelated Character Transform updates | 2388.227 ms; 20 refreshes; 20,480 projected colliders | 0.294 ms; 0 refreshes; 0 projected colliders |
| 300 native colliders, collision-debug overlap preparation | 6390.339 ms; per-collider `getOverlaps` | 27.667 ms; one cached debug snapshot |
| 1000 fixed colliders + 1 dynamic, 60 fixed steps, no-op backend | 30.629 ms; 60 descriptor enumerations / 60 backend syncs | 5.768 ms; 1 descriptor enumeration / 1 backend sync |

## Browser evidence required

Before HF1 can freeze, verify in a production browser build with real project content:

1. enable Collision Shapes = All on a large TileMap and confirm the editor remains responsive while panning/zooming;
2. move a RigidBody2D/CharacterBody2D while a large TileMap is present and verify the TileMap collision overlay does not visibly rebuild/flicker;
3. verify off-screen collision shapes do not create visible debug work when the camera/view moves away;
4. select one authored Collider2D and confirm handles/offset/rotation editing still work while scene-wide debug uses batching;
5. verify overlap color changes remain correct for visible distinct nodes;
6. verify adjacent collision tiles belonging to the same TileMapLayer2D do not all turn into false-positive red debug overlaps;
7. run Physics2D for several seconds and verify dynamic bodies continue moving/colliding while stable static geometry is not semantically lost;
8. modify StaticBody2D/TileMap collision at runtime/editor boundary and verify Physics backend resynchronizes after the dirty change;
9. Stop simulation and confirm authored transforms still restore;
10. compare Collision Shapes Off / Selected / All and record browser FPS/frame-time evidence if available.

Browser performance evidence was insufficient: the user still observed frame drops after HF1. Machine benchmarks do not substitute for browser evidence. WS-10N8-HF2 continues the optimization at the Stage/Capability hot path.
