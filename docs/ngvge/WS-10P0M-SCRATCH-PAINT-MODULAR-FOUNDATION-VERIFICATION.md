# WS-10P0M Verification

Status: **MACHINE VERIFIED / BROWSER EVIDENCE PENDING**

## Focused evidence

- WS-10P0M machine gate: **27/27 PASS**
- Module registry + Native Host focused Node tests: **2 suites / 7 tests PASS**
- Modular component slot DOM test: **1 suite / 1 test PASS**
- Existing Paint Working Copy / adapter / runtime / host tests: **4 suites / 27 tests PASS**
- Production Webpack modular Paint entries: **0 errors / 0 warnings PASS**

## Horizontal evidence

- TypeScript scope: **PASS**
- ESLint correctness: **PASS**
- Permanent Regression: **19/19 PASS**
- Integration: **4 suites / 5 tests PASS**
- Smoke: **1/1 PASS**
- Full Unit / Node: **165 suites / 915 tests PASS**
- Standard Unit / DOM harness: **3 suites / 27 tests PASS**

## Inherited architecture/certification evidence

- ARC-C001.1 minimum baseline: **7/7 PASS**
- LRC-G1: **15/15 machine PASS + 9 tests PASS**
- LPL-G1: **17/17 machine PASS** and certification tests PASS
- LEX-G1: **19/19 machine PASS + 9 tests PASS**
- LSC-G1: **19/19 machine PASS + 7 tests PASS**
- COL-0: **15/15 machine PASS + 4 suites / 12 tests PASS**

Existing VM service-provider replacement warnings in integration/certification output are inherited warnings and were not introduced by WS-10P0M.

## Browser evidence required before freeze

1. Open an SVG costume and confirm the original Scratch Vector GUI is used.
2. Open a PNG costume and confirm the original Scratch Bitmap GUI is used.
3. Brush / select / reshape / fill / eraser basic behavior remains consistent with original Scratch Paint.
4. Convert Vector <-> Bitmap still works inside the Paint GUI.
5. Zoom / pan / rotation-center behavior matches the known original baseline.
6. Edit -> Review -> Commit and Edit -> Discard both preserve NGVGE Working Copy authority.
7. Switching costumes with a dirty Working Copy remains blocked until Commit or Discard.

Until those browser checks pass, WS-10P0M must not be marked COMPLETE/FROZEN.
