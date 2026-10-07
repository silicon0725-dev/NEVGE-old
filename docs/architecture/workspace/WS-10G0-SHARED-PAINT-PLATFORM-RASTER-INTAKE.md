# WS-10G0｜Shared Paint Platform / Raster Intake Foundation

**Status:** `IMPLEMENTED / FOUNDATION VERIFIED`  
**Date:** 2026-08-15  
**Parent:** ARC-0001, WS-10D Art/Animation Semantic Freeze, WS-10E PaintBackendContract

## 1. Purpose

WS-10G0 is a small foundation stage inserted before the Bitmap/Pixel backend implementation. It does **not** reopen or replace WS-10D/WS-10E and it does **not** mark WS-10G or WS-10H complete.

The goal is to prevent Vector, Bitmap and Pixel from becoming three unrelated editor applications. NGVGE now owns a shared presentation/interaction vocabulary while each backend remains free to implement its own rendering and document operations.

```text
NGVGE Native Paint Shell
        │
        ├── Shared tool descriptors
        ├── Shared interaction vocabulary
        ├── Shared zoom/status presentation
        ├── Shared Working Copy / Review / Transaction authority
        │
        └── Backend-specific implementation
             ├── Vector / SVG-Edit
             └── Shared Raster Core
                  ├── Bitmap policy
                  └── Pixel policy
```

The governing rule is:

> Share interaction semantics and editor infrastructure; do not invent a universal backend-private object model.

## 2. Shared Paint Tool Profiles

`src/lib/editor-shell/paint-tool-profiles.js` is the first backend-neutral tool vocabulary.

The verified Vector order is preserved exactly. Bitmap and Pixel declare future tool profiles without activating a fake raster backend.

Shared tools include Selection, Line, Rectangle, Ellipse, Hand and Zoom. Bitmap adds Brush/Eraser/Fill/Eyedropper. Pixel uses an integer-grid Pencil/Eraser/Fill/Eyedropper profile. Vector keeps Direct Selection and Pen/Path.

`NativePaintShell` consumes these descriptors for labels/glyph semantics and no longer owns a Vector-only label table. The existing Vector UI remains the first consumer; a DOM regression proves the same Shell can present Bitmap tools and zoom chrome.

## 3. Shared Raster Core Policy

`src/lib/paint-platform/raster-authoring-policy.js` freezes the implementation-sharing boundary without introducing a new persistent schema.

Bitmap policy:

```text
AnimatedRasterDocument
RGBA raster source
continuous coordinates
continuous transforms
linear/smooth sampling
soft brush allowed
```

Pixel policy:

```text
AnimatedRasterDocument
indexed-raster source
integer-grid coordinates
integer transforms
nearest sampling
pixel grid required
soft brush forbidden
```

Both profiles keep Palette, Timeline and Persistence authority under NGVGE. This is a runtime/authoring policy only; it does not modify the WS-10D frozen schema.

## 4. GitHub OSS Intake

No miniPaint or Piskel App Shell is imported in G0. This stage records verified upstream source surfaces for controlled extraction.

### miniPaint

Repository: `viliusle/miniPaint`  
Reviewed ref: `master @ a79733eb803fc97084ef0ee4faa96b031e69e1c0`  
License: MIT (`MIT-LICENSE.txt`)  
Strategy: controlled extraction.

Verified useful surfaces include:

```text
src/js/core/base-layers.js
src/js/core/base-selection.js
src/js/core/base-tools.js
src/js/tools/brush.js
src/js/tools/pencil.js
src/js/tools/erase.js
src/js/tools/fill.js
src/js/tools/pick_color.js
src/js/tools/select.js
```

These are implementation references/candidates for Raster layer, selection and painting algorithms. miniPaint App Shell, File/Open/Save, local persistence and history authority are explicitly rejected.

### Piskel

Repository: `piskelapp/piskel`  
Reviewed ref: `master @ a6b9c02daefceb10093f71e92d52d16920ccb16e`  
License: Apache-2.0 (`LICENSE`)  
Strategy: controlled extraction.

Verified useful surfaces include:

```text
src/js/tools/drawing/BaseTool.js
src/js/tools/drawing/SimplePen.js
src/js/tools/drawing/Eraser.js
src/js/tools/drawing/PaintBucket.js
src/js/tools/drawing/Rectangle.js
src/js/tools/drawing/Circle.js
src/js/tools/drawing/ColorPicker.js
src/js/tools/drawing/DitheringTool.js
src/js/tools/drawing/VerticalMirrorPen.js
src/js/service/palette/PaletteService.js
src/js/rendering/OnionSkinRenderer.js
```

Piskel Timeline, Project, File Manager, History and private Frame/Layer identity are explicitly rejected as NGVGE authority.

### Scratch Paint

Repository: `scratchfoundation/scratch-paint`  
Reviewed ref: `develop @ f8966f09df9a994c207db10b4ab52f530a1172d8`  
License: AGPL-3.0 (`LICENSE`)  
Strategy: compatibility/reference only.

Verified reference surfaces:

```text
src/helper/view.js
src/helper/layer.js
src/containers/paper-canvas.jsx
src/containers/scrollable-canvas.jsx
```

These remain useful references for Artboard/View separation, guides, rotation-center normalization and pointer/view synchronization. Scratch Paint does not become NGVGE's authoritative Raster semantic model. Because the reviewed upstream is AGPL-licensed, G0 treats these files as design/behavior references only; copying their implementation into a non-AGPL controlled core requires a separate license decision and is outside this stage.

## 5. Authority Boundary

All Raster intake candidates are forbidden from owning:

```text
Semantic Identity
Project
Resource
Transaction
Persistence
Timeline
FrameId
LayerId
CelId
Workspace Window
```

Backend-private IDs may exist internally as ephemeral implementation handles but cannot become Project identity.

## 6. G0 Non-Goals

G0 deliberately does **not**:

- replace the current legacy Scratch raster surface;
- add miniPaint/Piskel as runtime dependencies;
- create a second App Shell;
- change AnimatedRasterDocument;
- create Timeline/Frame/Layer authority in an OSS backend;
- claim Bitmap or Pixel certification.

## 7. Next Stage

The next implementation stage is `WS-10G1｜Shared Raster Core / Bitmap Surface POC`.

It should make the current Bitmap path the second real consumer of the Native Paint Shell, then selectively extract/adapt miniPaint implementation pieces behind `PaintBackendContract`. Pixel should subsequently reuse the same Raster surface/controller with the Pixel authoring policy and selected Piskel algorithms.
