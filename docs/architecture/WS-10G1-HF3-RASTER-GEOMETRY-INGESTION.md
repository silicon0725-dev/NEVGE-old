# WS-10G1-HF3｜Raster Geometry Ingestion / Scratch Pivot Compatibility

Status: MACHINE VERIFIED / BROWSER FAILED / SUPERSEDED BY WS-10G1-HF4

## Scope

HF3 fixes the remaining Bitmap stage/artwork displacement after HF2 browser evidence showed that the compositor
camera was receiving incorrect source geometry. It does not reopen ARC-0001, WS-10D, WS-10E, PaintBackendContract,
or the HF2 camera/compositor model.

## Root cause

The Scratch compatibility source and the canonical Paint Working Copy can disagree during adoption of legacy bitmap
resources. Historical Resource ingestion normalized an absent rotation center to numeric zero. Scratch Paint does not
make that substitution: when a bitmap rotation center is absent, it uses the decoded bitmap center; a finite explicit
zero remains a valid top-left pivot.

This lost distinction makes the Raster backend position the PNG as if its upper-left corner were the editor origin,
while the stage guide remains centered on the editor origin. The resulting browser layout matches the HF2 failure
screenshot.

## Scratch reference

Reference-only source: `scratchfoundation/scratch-paint` at
`f8966f09df9a994c207db10b4ab52f530a1172d8` (AGPL-3.0).

`src/containers/paper-canvas.jsx` loads bitmaps with:

- the supplied `rotationCenterX / rotationCenterY` when finite;
- `image.width / 2` and `image.height / 2` when they are absent.

The artwork is then placed relative to the fixed editor center. HF3 reproduces this compatibility behavior without
copying Scratch implementation code.

## HF3 contract

The Native Paint host forwards the current Scratch costume geometry to `WorkspaceRasterEditor` as an adoption/
compatibility hint. The Raster editor resolves one effective workspace geometry before loading the backend:

1. If live costume rotation-center coordinates are finite, use them exactly. Finite `0` is valid.
2. If live costume geometry is present but a rotation-center coordinate is absent, use the decoded image center for
   that coordinate, matching Scratch Paint.
3. If no compatibility geometry is supplied, keep canonical Working Copy geometry.
4. Prefer live finite bitmapResolution, otherwise use Working Copy bitmapResolution, then the existing Bitmap default.

The resolved geometry is passed once to `setWorkspaceContext()` and becomes the only Raster document-to-pixel pivot
for artwork, Stage Guide, Fit, and pointer inverse mapping.

When a real Raster edit is exported into the Working Copy, the same resolved geometry is written with the edit. This
repairs stale zero metadata through the existing Working Copy / Review / Transaction path rather than silently
mutating Project/Resource authority when the editor merely opens.

## Non-goals

- no global Resource database authority rewrite;
- no silent project mutation on editor open;
- no new ArtDocument schema;
- no camera or zoom rewrite;
- no change to Vector semantics;
- no removal of existing dirty user pixels.

## Browser note

A dirty Working Copy created while HF1/HF2 coordinates were wrong may already contain black brush marks. HF3 does not
remove user edits. Browser verification of geometry must begin from Discard/reload of the original costume if such
marks are present.


## Browser disposition

HF3 corrected stale/missing bitmap pivot ingestion, but the subsequent browser retest still exposed a hard authored
raster boundary at the imported PNG rectangle. That remaining defect is not a pivot/camera failure: the Raster backend
still rejected document coordinates outside finite source-storage dimensions. WS-10G1-HF4 supersedes HF3 as the active
browser exit path by separating world coordinates from dynamically growing authored Raster storage.
