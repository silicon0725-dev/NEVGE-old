# WS-10G1｜Shared Raster Core / Bitmap Surface POC

**Status:** `IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING`  
**Parent:** `ARC-0001`, `WS-10D`, `WS-10E`, `WS-10G0`

## 1. Purpose

WS-10G1 admits Bitmap authoring into the same Native Paint Surface without importing a third-party application shell.
PNG/JPG costumes now use the canonical Resource → PaintSession → Working Copy → PaintBackendTransfer path and are edited by a replaceable Canvas2D Raster backend.

This stage intentionally does **not** complete the Bitmap replacement. It establishes the production Raster surface and the minimum editing loop required before selection, shapes, color UI, layers, filters, and Pixel policy are expanded.

## 2. Frozen authority boundary

The Raster backend owns only transient execution/storage needed to draw pixels. It does not own:

- ResourceId / Project identity
- ArtDocumentId / LayerId / FrameId / CelId / CelContentId
- persistence or Save Project
- reviewed transaction authority
- timeline authority
- Workspace Window authority

Static Bitmap still uses the frozen `ngvge.animated-raster-document@1` semantic model with exactly one Layer × one Frame = one Cel. Backend-private layer/history identities are not promoted into NGVGE semantics.

## 3. Shared Raster Core

The first Bitmap consumer is `ngvge.paint-backend-adapter.canvas-raster@1`.

POC capabilities:

- Brush
- Eraser
- Flood Fill
- Eyedropper
- Hand / pan
- Zoom and Fit
- 25% / 50% / 100% / 200%
- Undo / Redo
- Scratch-style stage-size guide
- Working Copy PNG export

The viewport transform is presentation-only. Zoom, pan, browser resize, and stage guide dimensions never resize the semantic Bitmap document.

## 4. miniPaint controlled extraction

miniPaint is used as a controlled algorithm/reference source, pinned for this stage to:

`viliusle/miniPaint @ a79733eb803fc97084ef0ee4faa96b031e69e1c0`

WS-10G1 adapts the portable RGBA flood-fill behavior from `src/js/tools/fill.js` under MIT terms. The upstream App/State/Layer/File/History surfaces are intentionally not copied.

The brush implementation was reviewed for behavior such as pressure and stroke sampling, but its App/State coupling makes wholesale reuse inappropriate for the NGVGE authority model. WS-10G1 therefore uses native Canvas2D execution for the first brush/eraser POC while preserving miniPaint as the future controlled-extraction reference.

Attribution is recorded in `docs/third-party/WS-10G1-MINIPAINT-NOTICE.md`.

## 5. Native host migration

`png`, `jpg`, and `jpeg` no longer route to the legacy Scratch Paint compatibility surface. On first use they are adopted into an independent canonical Resource and selected through the existing Paint session.

Unsupported raster formats remain on `legacy-raster` compatibility until explicitly admitted.

## 6. Bitmap/Pixel reuse boundary

Pixel is not implemented in WS-10G1. The stage verifies the Raster Core can later be reused with the already-frozen Pixel policy:

- Bitmap: continuous coordinate policy, RGBA source, smooth/linear presentation where appropriate.
- Pixel: integer-grid policy, indexed authoring, nearest sampling, palette-owned semantics.

The implementation surface may be shared; the authoring source and semantic constraints must not be flattened into one universal raster representation.

## 7. Deferred work

Deferred to subsequent WS-10G stages:

- Bitmap selection mask + transform
- Copy/Paste/Delete selection
- line / rectangle / ellipse / text
- explicit color/brush property UI
- layers / opacity / blend mode
- gradient / crop / masks / filters
- pressure/stabilizer refinement
- Pixel mode consumer
- browser evidence and final Native Bitmap replacement certification

## 8. Gate result

Machine/focused/unit/integration/smoke/regression/conformance and the stage-specific real production Webpack entry pass on the implementation tree. Browser behavior remains intentionally `PENDING` until the generated overlay is exercised in the real NGVGE editor.
