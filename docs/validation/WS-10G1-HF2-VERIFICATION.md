# WS-10G1-HF2 Verification

Status: MACHINE VERIFIED / BROWSER FAILED / SUPERSEDED BY WS-10G1-HF3

## Stage-specific evidence

- HF2 Raster Viewport / Stage Alignment machine gate: 18/18 PASS
- Inherited WS-10G1 Shared Raster Core machine gate: 30/30 PASS
- Focused Node: 4 suites / 19 tests PASS
- Native Paint Host DOM: 1 suite / 4 tests PASS
- HF1a runtime import closure: 6/6 PASS
- G1 Raster production Webpack entry: 0 errors / 0 warnings PASS

## Inherited Vector evidence

- WS-10F2C-HF2: 22/22 PASS
- WS-10F2C-HF1: 17/17 PASS
- WS-10F2B-HF1 real SVG-Edit DOM/transform contract: 14/14 PASS
- WS-10F2B-HF1 selection alignment: 25/25 PASS
- WS-10F2C SVG-Edit professional core: 28/28 PASS
- WS-10F2C machine: 40/40 PASS
- SVG-Edit Vector backend: 30/30 PASS
- Vector/Native Paint DOM focused suites: 2 suites / 5 tests PASS

## Repository evidence

- TypeScript scope: PASS
- ESLint correctness source/tooling: PASS
- ESLint correctness tests: PASS
- Permanent Regression: 19/19 PASS
- Integration: 4 suites / 5 tests PASS
- Smoke: 1 suite / 1 test PASS
- Unit Node: 162 suites / 905 tests PASS
- Unit DOM harness (separate completed rerun): 3 suites / 27 tests PASS

## Architecture / containment evidence

- ARC-C001.1 minimum baseline appears in Permanent Regression: PASS
- LRC-G1 certification: 15/15 PASS
- LPL-G1 certification: 17/17 PASS
- LEX-G1 certification: 19/19 PASS
- LSC-G1 certification: 19/19 PASS
- COL-0 machine: 15/15 PASS; Jest 4 suites / 12 tests PASS

## Browser evidence

FAILED on the affected Edge PNG. The compositor no longer exhibited the original HF2 finite-storage viewport bug,
but the stage guide remained displaced through the artwork. The observed layout is consistent with a stale zero
rotation center being ingested from the Resource Working Copy.

HF2 is therefore not Browser Verified. The remaining defect is owned by WS-10G1-HF3.
