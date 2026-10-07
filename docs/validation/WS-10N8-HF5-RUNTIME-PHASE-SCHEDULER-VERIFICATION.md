# WS-10N8-HF5｜Runtime Phase Scheduler Verification

Status: MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Browser trigger evidence

The HF4 report from the lagging project showed 9.793 average FPS, 102.113 ms average frame time and 433.4 ms frame P95. The measured Scratch VM event-cycle category had P50 1.2 ms but P95 346.2 ms and maximum 638.9 ms, while Scratch Renderer and Collision Canvas were negligible in the same capture. This is treated as burst-stall evidence.

## Source/root-cause verification

HF5 verifies that:

- Scratch Transform Projection no longer registers `AFTER_EXECUTE`;
- runtime `TARGETS_UPDATE` and public `targetsUpdate` only schedule coalesced projection work;
- projection owns topology/shadow caches and skips unchanged Transform mutations;
- Scratch Binding Lifecycle uses a topology signature gate before full reconcile;
- lifecycle topology checks themselves are coalesced outside the Scratch event handler;
- Physics2D no longer registers `AFTER_EXECUTE` and instead uses a recurring Runtime Phase Scheduler phase;
- fixed-step catch-up remains bounded;
- profiler output separates binding lifecycle and Scratch→NGVGE projection from the Scratch VM event-cycle category.

## Focused machine evidence

- HF1 conformance: 12/12 PASS.
- HF2 conformance: 15/15 PASS.
- HF3 conformance: 13/13 PASS.
- HF4 conformance: 15/15 PASS.
- HF5 Runtime Phase Scheduler conformance: 13/13 PASS.
- HF5 Scratch Projection Scheduling behavioral test: PASS.
- 0009-C Scratch Compatibility Transform Projection conformance: PASS.
- Focused Jest: 5 suites / 27 tests PASS.
  - Runtime Phase Scheduler;
  - Scratch Transform Projection;
  - Scratch Sprite Adapter Lifecycle;
  - Physics2D Runtime Service;
  - Frame-Time Profiler.

Behavioral stress proof:

```text
100 Scratch sprites
2000 target-update signals (1000 runtime + 1000 public)
→ one scheduled transform projection
→ one scheduled lifecycle topology check
```

The runtime Transform is unchanged synchronously inside the target-update event handlers and is updated only when the scheduler flushes.

## Synthetic diagnostic benchmark

Node synthetic benchmark, **not browser FPS**:

```text
100 sprites / 300 update cycles

legacy-equivalent full-scene projection loop: 6103.640 ms
HF5 coalesced signal + single scheduler flush: 10.103 ms
```

This benchmark intentionally models the eliminated scheduling pattern and demonstrates the order-of-magnitude cost of repeated full-scene projection. It is not a claim that the browser will improve by the same ratio.

A repeat diagnostic run remained in the same order of magnitude (`3569.283 ms → 9.348 ms`), confirming that the result is not dependent on one timing sample.

## Full regression / certification evidence

- Full Unit Node: 215 suites / 1101 tests PASS.
- Full Unit DOM: 3 suites / 33 tests PASS.
- Integration: 12 suites / 13 tests PASS.
- Smoke: 1 suite / 1 test PASS.
- Permanent Regression: 39/39 PASS, including `runtime-phase-scheduler`.
- TypeScript scope validation / `tsc --noEmit`: PASS.
- ESLint correctness (source/tooling + tests): PASS.
- ARC-C001.1 minimum baseline: 7/7 PASS, 0 active waivers, 0 blockers.
- 0009-E Transform DoD: 12/12 PASS.
- LRC-G1: 15/15 PASS.
- LPL-G1: 17/17 PASS.
- LEX-G1: 19/19 PASS.
- LSC-G1: 19/19 PASS.
- COL-0: 15/15 PASS.
- Production Node Explorer Webpack: PASS, 0 errors / 0 warnings.
- Full Editor Webpack: INCONCLUSIVE; the 300-second verification window ended before final webpack stats were emitted. No PASS is claimed.
- `@dimforge/rapier2d-compat` remains absent from the inherited validation `node_modules` (`MODULE_NOT_FOUND`), so real Rapier package execution is not re-certified by HF5. HF5 introduces no dependency change.

The inherited dependency set from the original full source was materialized for Jest / production-entry validation only.

## Browser re-test gate

Run the same HF4 5-second capture after applying HF5. The expected qualitative change is:

```text
Scratch VM Event Cycle P95 ↓ substantially
Scratch Binding Lifecycle visible as its own row
Scratch → NGVGE Projection visible as its own row
Physics2D visible independently of Scratch VM event cycle
```

If `Scratch VM Event Cycle` still shows hundreds-of-milliseconds P95 while the two new NGVGE categories remain low, the next investigation must move into Scratch sequencer/thread scheduling itself rather than Collider/TileMap/Physics projection.

N8 remains unfrozen until this real-browser re-test passes.
