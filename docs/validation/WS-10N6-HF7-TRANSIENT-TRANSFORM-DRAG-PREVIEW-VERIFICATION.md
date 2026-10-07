# WS-10N6-HF7｜Transient Transform Drag Preview Verification

Status: **MACHINE VERIFIED / BROWSER EVIDENCE PENDING**

Browser Evidence is intentionally **PENDING** until the real editor verifies continuous Sprite/Collider alignment, Camera2D drag mapping, cancel semantics, and one-step Undo.

## Machine evidence

- HF7 Conformance: **11/11 PASS**
- inherited N0 → N6-HF6 focused chain: **PASS**
- HF7 focused Node: **3 suites / 22 tests PASS**
- HF7 Stage drag focused: **1 suite / 2 tests PASS** in both default Node and DOM harness execution
- Full Unit Node: **195 suites / 1049 tests PASS**
- Full Unit DOM: **3 suites / 33 tests PASS**
- Integration: **10 suites / 11 tests PASS**
- Smoke: **1 suite / 1 test PASS**
- Permanent Regression: **32/32 PASS**
- TypeScript: **PASS**
- ESLint correctness source/tooling + tests: **PASS**
- ARC-C001.1 Minimum Baseline: **7/7 PASS; 0 active waivers; 0 blockers**
- 0009 Transform2D A/B/C/D/E: **PASS**; Transform DoD **12/12 PASS**
- LRC-G1: **15/15 PASS**
- LPL-G1: **17/17 PASS**
- LEX-G1: **19/19 PASS**
- LSC-G1: **19/19 PASS**
- COL-0: **15/15 PASS**
- Production Node Explorer Webpack: **PASS; 0 errors / 0 warnings**
- Full Editor Webpack: **INCONCLUSIVE** — the 300-second execution window elapsed before final success/failure statistics were emitted. Timeout is not recorded as PASS or FAIL.

## HF7 verified focus

- transient preview state is editor-only and runtime-keyed;
- pointer move does not execute a Transform2D authoring command;
- pointer release executes exactly one semantic Transform2D position command;
- the release commit creates one Property History `Move Sprite` transaction;
- Escape cancels without position commit;
- window blur uses the same cancel path;
- Camera2D `screenToWorld()` is used for editor drag coordinates;
- Collider2D child geometry follows the complete semantic dragged subtree;
- preview overlap is recomputed from projected editor geometry without mutating Runtime Collider overlap authority;
- Inspector exposes transient X/Y as `Editor Drag Preview`, not saved state;
- Scratch script-visible x/y is not replaced by the editor preview before release.

## Browser acceptance still required

1. Drag a Scratch-bound Sprite2D with a real descendant Collider2D and verify art/collider remain aligned before release.
2. Drag into/out of another collider and verify preview collision highlighting changes continuously.
3. Verify Inspector X/Y follows the pointer and shows `Editor Drag Preview`; release removes the preview label.
4. Verify one complete drag creates one Undo step and one Undo restores the drag-start position.
5. Verify Escape during drag restores the authored pose and commits no final position.
6. Verify Camera2D translation, rotation and zoom preserve pointer/art/collider/Inspector alignment.
7. While dragging, verify Scratch blocks/reporters still observe normal Scratch runtime coordinates until the release commit.
