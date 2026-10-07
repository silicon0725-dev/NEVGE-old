# WS-10G1-HF2｜Scratch-Style Raster Viewport / Stage Alignment

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER FAILED / SUPERSEDED BY WS-10G1-HF3

## Scope

This hotfix repairs the Bitmap Raster Core presentation model after browser evidence showed the same class of
viewport/content mismatch previously seen in the Vector editor.

It does **not** reopen ARC-0001, WS-10D, WS-10E, the PaintBackendContract, or the frozen Vector transform work.
It changes only the replaceable Raster backend presentation implementation and its permanent regressions.

## Root cause

The G1 POC used the decoded PNG storage canvas as both:

1. authored RGBA storage; and
2. the DOM object transformed inside the editor viewport.

Fit calculated a scale from the union width/height but did not center asymmetric artwork bounds. The document origin
therefore remained pinned to the viewport center even when the actual artwork + stage union was centered elsewhere.
The backend also trusted a cached viewport size that could diverge from the live DOM size.

## Scratch Paint reference

Reference-only source: `scratchfoundation/scratch-paint` at
`f8966f09df9a994c207db10b4ab52f530a1172d8` (AGPL-3.0).

Reviewed paths:

- `src/helper/view.js`
  - Bitmap/SVG editing uses a shared 2× artboard coordinate space.
  - `zoomToFit()` changes both zoom and `paper.view.center`.
  - Pan/zoom belong to the Paper view, not bitmap storage.
- `src/containers/paper-canvas.jsx`
  - Bitmap import places artwork relative to the rotation center.
  - `recalibrateSize()` synchronizes Paper view size with the live DOM canvas to keep pointer coordinates aligned.
- `src/helper/layer.js`
  - Raster storage and view/layers are distinct responsibilities.

NGVGE intentionally does **not** copy Scratch's `MAX_WORKSPACE_BOUNDS` or Bitmap action clamp. Scratch remains a
compatibility/behavior reference only.

## HF2 presentation contract

```text
RGBA Storage Surface (offscreen)
        │
        │ document position = -rotationCenter
        ▼
Raster Viewport Compositor (live DOM size)
        │
        ├── Artwork render pass
        ├── Stage Guide render pass
        └── Pointer inverse transform

All three consume the exact same applied camera:
    viewport center + pan + zoom
```

The stage guide remains presentation-only. It is not serialized and does not become ArtDocument, Resource,
Transaction, Layer, Frame, or Cel authority.

Fit uses:

```text
stage bounds ∪ non-transparent artwork bounds
```

and computes both:

```text
fitZoom
fitBoundsCenter
```

The bounds center is translated to the viewport center. Manual 25% / 50% / 100% / 200% zoom preserves the currently
centered document point.

## Permanent regression

The backend test intentionally uses a 1200×500 bitmap with rotation center (100,100) against a 480×360 stage at
bitmapResolution 2. This makes the artwork bounds strongly asymmetric and reproduces the browser failure mode.

The regression verifies:

- Fit centers `stage ∪ artwork`, not document origin;
- 25% / 50% / 100% / 200% preserve the same centered document point;
- artwork and guide receive identical compositor translate/scale operations;
- screen-to-document-to-source-pixel hit testing inverts that same camera;
- live host resize updates compositor dimensions;
- storage canvas and display compositor are different canvases;
- no `setResolution`, SVG-style `viewBox`, second CSS world transform, or Scratch finite workspace clamp is introduced.

## Browser result

Browser retest failed. HF2 fixed camera/compositor alignment, but the affected PNG still showed the stage guide
corner displaced through the artwork. Screenshot geometry was consistent with the Raster backend receiving a stale
`rotationCenterX = 0 / rotationCenterY = 0` adoption record rather than the live Scratch costume pivot.

The remaining failure is therefore not reopened as a camera problem. It is continued by WS-10G1-HF3 at the
geometry-ingestion/adoption boundary.
