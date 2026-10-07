# WS-10P0M-HF1｜Bitmap Artboard Unclamp

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING

## Purpose

Remove Scratch Paint's legacy assumption that bitmap backing storage is identical to the 2x stage artboard (normally 960×720). The stage rectangle remains a visual/reference guide; imported bitmap pixels and bitmap editing operations may extend beyond it without being clipped by the stage size.

This hotfix does not change NGVGE ArtDocument semantics, Working Copy authority, transaction ownership, or WS-10D/WS-10E contracts.

## Implementation

- Added pure raster workspace geometry helper for expandable backing bounds.
- Bitmap raster storage grows transparently while preserving existing pixels in project space.
- Large PNG/JPG imports expand storage before `drawImage`.
- Bitmap action bounds include authored raster and current workspace instead of returning only `ART_BOARD_BOUNDS`.
- Bitmap rectangle selection clamps to raster storage bounds instead of stage dimensions.
- Brush and Line expand storage to the writable current view and convert project coordinates to raster-local pixel coordinates.
- Fill converts project coordinates to raster-local coordinates and remains bounded to existing authored raster storage.
- Text, moved selections, Rect, Oval, and vector-to-bitmap commits expand storage before rasterization.
- Bitmap checkerboard is workspace-sized; the existing stage outline remains unchanged as a guide.

## Evidence

- WS-10P0M-HF1 machine gate: 18/18 PASS.
- Raster workspace pure unit regression: 1 suite / 4 tests PASS.
- WS-10P0M inherited modular foundation gate: 27/27 PASS.
- WS-10P0M focused module/host tests: 3 suites / 8 tests PASS.
- WS-10P0M production Webpack: 0 errors / 0 warnings PASS.
- Permanent Regression: 19/19 PASS.
- Integration: 4 suites / 5 tests PASS.
- Smoke: 1/1 PASS.
- TypeScript scope: PASS.
- ESLint correctness: PASS.
- LRC-G1: 15/15 PASS.
- LPL-G1: 17/17 PASS.
- LEX-G1: 19/19 PASS.
- LSC-G1: 19/19 PASS.
- Full Unit: INCONCLUSIVE in this execution window; many suites passed, but the aggregate Jest summary was not reached before timeout. This is not recorded as PASS or FAIL.

## Browser acceptance

Before freezing this hotfix, verify with a bitmap larger than the stage:

1. Import/open the bitmap and confirm all pixels remain visible outside the stage reference rectangle.
2. Pan/zoom and confirm the checkerboard workspace continues beyond the stage outline.
3. Brush across each stage edge; strokes must continue beyond the stage.
4. Move a bitmap selection beyond the stage, deselect/commit it, and confirm no clipping.
5. Create Rectangle/Oval/Text partly outside the stage and commit them.
6. Save/reopen the costume and confirm bounds and rotation center remain stable.
7. Confirm Vector mode behavior is unchanged.

Browser evidence is required before this hotfix is marked COMPLETE / VERIFIED.
