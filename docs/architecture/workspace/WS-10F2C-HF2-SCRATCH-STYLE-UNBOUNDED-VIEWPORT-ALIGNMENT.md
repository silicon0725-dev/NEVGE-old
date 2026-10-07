# WS-10F2C-HF2 | Scratch-Style Unbounded Viewport Alignment

Status: **IMPLEMENTED / VERIFIED EXCEPT PRODUCTION WEBPACK INCONCLUSIVE**

Architecture parent: `ARC-0001 | Kernel Independence Contract`

Inherited frozen contracts:

- `WS-10D | 2D Art & Animation Semantic Freeze`
- `WS-10E | PaintBackendContract & OSS Intake`
- `WS-10F2B-HF1 | Selection Overlay Zoom / Transform Alignment`
- `WS-10F2C | Vector Professional Tooling` remains IN PROGRESS

## Trigger

The first Infinite Vector Workspace hotfix removed the visible SVG-Edit canvas background and enabled `show_outside_canvas`, but real browser evidence still showed two failures:

1. authored geometry was visibly clipped to the finite nested `svgcontent` viewport while the selection overlay continued outside it;
2. the stage-size hint and authored/selection geometry could drift because the hint was a sibling under outer `svgroot` and manually recomputed its own `document * zoom + translation` mapping.

This proved that hiding `canvasBackground` was not sufficient. The finite nested SVG viewport was still participating in rendering, and the stage guide still had a second transform implementation.

## Scratch Paint reference model

The installed Scratch Paint implementation separates these concerns:

```text
Painting content
Guide / outline layers
View matrix (pan / zoom)
Artboard / registration origin
Export normalization
```

Important reference behavior used by this hotfix:

- imported SVG artwork is translated so its costume rotation center maps to a stable editor center;
- guides and painted content travel through the same project/view transform;
- guide layers are removed while exporting;
- vector export is content-tight and reconstructs the rotation center from the stable editor origin minus exported content bounds;
- canvas/view dimensions are synchronized for pointer alignment;
- pan/zoom changes the view, not document semantics.

Scratch Paint itself retains a finite `MAX_WORKSPACE_BOUNDS`. NGVGE intentionally does **not** inherit that clamp: only the separation of Artboard / View / Guide / Content is adopted.

## Root cause 1 | inline SVG overflow defeated `show_outside_canvas`

SVG-Edit 7.4.2 sets a presentation `overflow` attribute on the nested `svgcontent` element. A source SVG may also contain an inline declaration such as:

```text
style="overflow:hidden"
```

The inline style has higher CSS priority than the presentation attribute. Therefore this state was possible:

```text
svgcontent attribute overflow = visible
svgcontent inline style overflow = hidden

=> authored geometry clipped
=> selectorParentGroup is a sibling and remains visible
=> blue selection bounds appear larger than visible artwork
```

HF2 forces the **live editor viewport only** to:

```text
svgcontent.style overflow = visible !important
```

Before serialization the authored overflow style is restored. After serialization the live editor override is re-applied. Therefore presentation policy cannot leak into canonical Resource content.

## Root cause 2 | stage guide had an independent transform implementation

HF1 stage guide placement was:

```text
outer svgroot
  +-- svgcontent
  +-- stage guide       <- manual x/y + document * zoom
  +-- selectorParentGroup
```

Although the same numerical zoom and translation were passed in, this still created a second mapping implementation.

HF2 changes it to:

```text
outer svgroot
  +-- svgcontent
  |     +-- SVG-Edit authored layers
  |     +-- NGVGE stage guide (presentation-only)
  |
  +-- selectorParentGroup
```

The stage guide is expressed only in document coordinates. It does not have its own zoom transform or presentation translation. The nested `svgcontent` CTM is now the sole document-to-viewport mapping for both artwork and the guide.

The selector remains under SVG-Edit's native selector hierarchy and follows the same `setZoom() + updateCanvas()` authority frozen by WS-10F2B-HF1.

## Scratch-style stable editor origin

Native Vector load now rebases authored root items so the current costume rotation center maps to one adapter-local editor origin:

```text
editorOrigin = (0, 0)

dx = -rotationCenterX
dy = -rotationCenterY
```

The translation is applied through public SVG-Edit selection/move operations with undo/history recording disabled. During load `loadedTransfer` is intentionally null, so SVG-Edit setup events cannot dirty the Working Copy. The undo stack is reset after rebasing.

This is presentation/editor state only. It does not change `ngvge.vector-art-document@1` or PaintBackendContract.

The stage guide becomes:

```text
left   = editorOrigin.x - stageWidth / 2
top    = editorOrigin.y - stageHeight / 2
width  = stageWidth
height = stageHeight
```

Therefore stage hint, costume registration point, artwork and selection no longer depend on unrelated source-SVG top-left coordinates.

## Truly unbounded vector authoring model

NGVGE does not call `setResolution()` to create a giant fake SVG and does not impose Scratch Paint's `MAX_WORKSPACE_BOUNDS`.

The editor model is:

```text
finite host viewport (screen clipping only)
        |
        +-- free pan offset
        +-- SVG-Edit zoom
        |
        v
nested svgcontent with live overflow visible
        |
        +-- authored geometry at arbitrary +/- coordinates
        +-- stage-size guide around editor origin
```

The root Native Paint host clips only what is currently visible on screen. Moving an object outside the stage hint or outside the imported SVG width/height does not make it leave the editable coordinate space.

## Fit

Fit continues to use:

```text
union(StageGuideBounds, AuthoredArtworkStrokedBounds)
```

Artwork bounds are now explicitly computed from authored root items and exclude the presentation guide.

## Export

The stage guide is temporarily detached before `getSvgString()` and restored immediately afterward.

Export then tightens the authored SVG around real artwork bounds. Because the costume registration point is the fixed editor origin, export metadata is reconstructed as:

```text
rotationCenterX = editorOrigin.x - sourceOrigin.x
rotationCenterY = editorOrigin.y - sourceOrigin.y
```

This mirrors Scratch Paint's content-tight export principle without granting Scratch/Paper.js or SVG-Edit persistence authority.

## Permanent regression

HF2 permanently covers:

- real SVG-Edit 7.4.2 `show_outside_canvas` contract;
- real SVG-Edit DOM hit-test `getScreenCTM()` path;
- real SVG-Edit content/selector `updateCanvas()` transform contract;
- Scratch rotation-center-to-editor-origin reference behavior;
- Scratch guide separation / export removal reference behavior;
- Scratch content-tight export / rotation-center reconstruction reference behavior;
- source `style="overflow:hidden"` overridden only in the live editor;
- authored overflow style restored during serialization;
- stage guide parent is `svgcontent`;
- stage guide has no independent `transform`;
- stage guide uses document-space stage dimensions;
- costume rotation-center rebase does not create undo/dirty state;
- selector geometry remains aligned after rebase and zoom;
- 25% / 50% / 100% / 200% / Fit HF1 regressions remain green;
- host resize/pan/zoom still never changes semantic document resolution.

## Authority statement

This hotfix changes only the replaceable SVG-Edit adapter presentation/editor mapping. It does not modify:

- ARC-0001;
- WS-10D Art/Animation schema;
- WS-10E PaintBackendContract;
- ResourceId / ArtDocumentId identity;
- Project / Resource / Transaction authority;
- Review/Commit semantics.

WS-10F2C remains **IN PROGRESS / P0 CORE VERIFIED / P1 PARTIAL**. HF2 fixes the viewport/editor-coordinate defect; it does not complete Join/Split/Scissors or remaining P1 professional tools.
