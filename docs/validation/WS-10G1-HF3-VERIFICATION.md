# WS-10G1-HF3 Verification

Status: MACHINE VERIFIED / BROWSER FAILED / SUPERSEDED BY WS-10G1-HF4

## Stage-specific evidence

- HF3 Raster Geometry Ingestion machine gate: 11/11 PASS
- Inherited HF2 Raster Viewport / Stage Alignment machine gate: 18/18 PASS
- Inherited WS-10G1 Shared Raster Core machine gate: 30/30 PASS
- Focused Node: 5 suites / 23 tests PASS
- Native Paint Host DOM: 1 suite / 4 tests PASS
- Raster production Webpack: 0 errors / 0 warnings PASS

## Permanent regression

- stale zero Working Copy pivot + finite live costume pivot uses live geometry;
- absent live bitmap pivot falls back to decoded bitmap center;
- explicit live `(0,0)` remains valid and is not replaced;
- no compatibility geometry keeps canonical Working Copy pivot;
- Native Paint Host passes live costume geometry to the Raster consumer.

## Inherited evidence

- WS-10F2C-HF2/HF1/HF1 selection chain: PASS
- TypeScript scope: PASS
- ESLint correctness source/tooling + tests: PASS
- Permanent Regression: PASS
- Integration: 4 suites / 5 tests PASS
- Smoke: 1 suite / 1 test PASS


## Repository / inherited certification evidence

- ARC-C001.1 minimum baseline: 7/7 PASS
- LRC-G1 Runtime Policy Containment: 15/15 PASS
- LPL-G1 Project Lifecycle Consolidation: 17/17 PASS
- LEX-G1 Extension / Addons Containment: 19/19 PASS
- LSC-G1 Credentials / Unsafe Agent Containment: 19/19 PASS
- COL-0 Stable Collaboration Semantic boundary: 15/15 machine PASS; 4 suites / 12 tests PASS
- Unit DOM harness: 3 suites / 27 tests PASS
- Full Unit Node aggregate: INCONCLUSIVE — the dedicated Node run exceeded the execution window before Jest printed its final aggregate; no failed suite was observed before timeout, but this is not a PASS.

## Browser exit condition

Retest the affected PNG from a clean Working Copy (Discard/reload first if prior black marks exist). Initial Fit must
place the stage guide around the costume pivot instead of intersecting the artwork as if the PNG top-left were the
origin. Then verify 25% / 50% / 100% / 200% / Fit, Hand/Space pan, and Brush/Eyedropper pointer alignment.

HF3 must remain Browser Evidence Pending until that real UI retest passes.


## Browser result

HF3 browser retest did **not** satisfy the exit condition. Pivot placement improved, but Brush/display remained bounded
by the source PNG storage rectangle. HF3 remains valuable as inherited geometry compatibility evidence, but browser
acceptance moves to WS-10G1-HF4.
