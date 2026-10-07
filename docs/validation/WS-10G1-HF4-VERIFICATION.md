# WS-10G1-HF4 Verification

Status: MACHINE VERIFIED / BROWSER RETEST REQUIRED

## Stage-specific evidence

- HF4 Unbounded Raster World machine gate: 15/15 PASS
- Inherited HF3 Raster Geometry Ingestion machine gate: 11/11 PASS
- Inherited HF2 Raster Viewport / Stage Alignment machine gate: 18/18 PASS
- Inherited WS-10G1 Shared Raster Core machine gate: 30/30 PASS
- Focused Node: 5 suites / 25 tests PASS
- Native Paint Host DOM: 1 suite / 4 tests PASS
- Raster production Webpack: 0 errors / 0 warnings PASS

## Permanent regression added by HF4

- imported PNG width/height are storage seed dimensions, not authored-world limits;
- Brush starting outside the original PNG expands authored storage before pixel mapping;
- a continuous stroke crossing the original edge remains continuous after growth;
- left/top growth changes `surfaceOrigin` without moving camera or Stage Guide;
- current surface bounds and effective rotation center are exposed by backend workspace state;
- Undo restores both original storage dimensions and original surface origin;
- exported document dimensions follow expanded storage;
- exported rotation center follows effective `-surfaceOrigin` geometry;
- Fill/Eyedropper remain finite authored-surface operations rather than creating an infinite transparent flood;
- HF4 contains no Scratch `MAX_WORKSPACE_BOUNDS`, `getActionBounds`, or `clampViewBounds` dependency.

## Inherited evidence

- WS-10F2C-HF2/HF1/HF1 selection chain: PASS
- TypeScript scope: PASS
- ESLint correctness source/tooling + tests: PASS
- Permanent Regression: 19/19 PASS
- Integration: 4 suites / 5 tests PASS
- Smoke: 1 suite / 1 test PASS
- Unit DOM harness: 3 suites / 27 tests PASS

## Repository / certification evidence

- LRC-G1 Runtime Policy Containment: 15/15 PASS
- LPL-G1 Project Lifecycle Consolidation: 17/17 PASS
- LEX-G1 Extension / Addons Containment: 19/19 PASS
- LSC-G1 Credentials / Unsafe Agent Containment: 19/19 PASS
- COL-0 Stable Collaboration Semantic boundary: 15/15 machine PASS; 4 suites / 12 tests PASS
- Full Unit Node aggregate: INCONCLUSIVE — the dedicated Node run exceeded the execution window before Jest printed its final aggregate. Many suites completed successfully before timeout, but absence of a final aggregate is not a PASS.

## Browser exit condition

HF4 stays Browser Evidence Pending until a real Native Bitmap UI retest confirms all of the following from a clean
Working Copy:

1. Brush can cross the original PNG left/top/right/bottom edges without clipping or stopping.
2. Pan can move the view beyond the original PNG and Brush can create authored pixels there.
3. 25% / 50% / 100% / 200% / Fit preserve Stage Guide, artwork, and pointer alignment.
4. Save/reopen preserves the expanded artwork and effective costume pivot.
5. No old invisible imported-PNG rectangle remains as a hit-test or display boundary.
