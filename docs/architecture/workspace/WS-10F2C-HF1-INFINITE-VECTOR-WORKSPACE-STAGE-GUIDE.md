# WS-10F2C-HF1 | Infinite Vector Workspace / Stage Guide

Status: **IMPLEMENTED / FOCUSED VERIFIED / PRODUCTION WEBPACK INCONCLUSIVE**

Architecture parent: `ARC-0001 | Kernel Independence Contract`

Inherited frozen contracts:

- `WS-10D | 2D Art & Animation Semantic Freeze`
- `WS-10E | PaintBackendContract & OSS Intake`
- `WS-10F2B-HF1 | Selection Overlay Zoom / Transform Alignment`
- `WS-10F2C | Vector Professional Tooling` (still IN PROGRESS)

## Trigger

Native Vector Paint still visually presented the finite SVG document rectangle as if it were the editable canvas. In real editing this produced a misleading state: SVG-Edit selection visualization could extend beyond the finite white `canvasBackground`, while the background/document rectangle remained much smaller. The result looked like the blue transform box and the edited artwork belonged to different canvases.

The finite SVG document viewport must not be elevated into NGVGE Workspace authority.

## Product decision

Vector authoring now follows the Scratch Paint workspace model at the presentation layer:

```text
Unbounded pan/zoom workspace
        |
        +-- authored SVG geometry may exist outside old SVG width/height
        |
        +-- Stage-size guide (presentation only)
        |      centered on costume rotation center
        |      sized from runtime stageWidth x stageHeight
        |
        +-- selection / path grips / hit testing
               share the same SVG-Edit zoom + translation authority
```

The stage guide is not an artboard identity, Resource, Layer, or persistent document field. It is only a visual hint for “one stage-sized region around this costume origin”.

## Scratch Paint visual reference

The installed Scratch Paint source uses a two-stroke artboard outline:

- inner outline: `#FFFFFF`
- outer outline: `#4280D7`
- outer outline opacity: `0.25`

NGVGE reuses that restrained visual language for the stage-size hint without importing Scratch Paint's Paper.js artboard authority into the SVG-Edit backend.

## SVG-Edit source contract

Pinned backend remains:

```text
@svgedit/svgcanvas@7.4.2
```

The audited SVG-Edit source already supports:

```text
show_outside_canvas
    -> svgcontent overflow visible
```

and `updateCanvas()` still establishes the HF1 transform source of truth:

```text
setZoom(z)
updateCanvas(hostWidth, hostHeight)
    -> svgcontent presentation size/translation
    -> selectorParentGroup translation
```

NGVGE now explicitly forces `show_outside_canvas: true` rather than depending on backend defaults, and also reasserts `svgcontent overflow="visible"` after presentation synchronization.

## Finite background retirement

SVG-Edit's `#canvasBackground` is retained as an internal backend DOM object because SVG-Edit updates it internally, but NGVGE hides it from presentation:

```text
canvasBackground visibility = hidden
```

It no longer appears as a white finite “canvas” that implies a hard authoring boundary.

The Native Paint host remains the actual clipping viewport for what is currently visible on screen; panning is not semantically bounded by SVG width/height.

## Stage guide mapping

Workspace context is adapter-local:

```text
{
  stageWidth,
  stageHeight,
  rotationCenterX,
  rotationCenterY
}
```

Stage dimensions are read from the active Scratch runtime when available, with `480 x 360` compatibility fallback.

The guide bounds in SVG document coordinates are:

```text
left = rotationCenterX - stageWidth / 2
top  = rotationCenterY - stageHeight / 2
width  = stageWidth
height = stageHeight
```

The guide is created under outer `svgroot`, outside authored `svgcontent`, with:

```text
data-ngvge-presentation-only="stage-size-guide"
pointer-events="none"
```

Therefore `getSvgString()` cannot serialize the guide into the authored SVG.

## One transform authority remains frozen

The hotfix does not introduce a second camera or coordinate system.

After SVG-Edit computes its native zoom and canvas geometry, NGVGE computes one final presentation translation. The exact same translation is applied to:

```text
svgcontent x/y
selectorParentGroup translate(x,y)
stage-guide translate(x,y)
```

Selection geometry remains `bbox * SVG-Edit zoom`; hit testing continues to use SVG-Edit's content CTM/zoom path.

Manual zoom and Hand/Space pan remain presentation-only and never call `setResolution()`.

## Fit behavior

When a Native Paint workspace context exists, Fit no longer means “fit the old SVG width/height rectangle”.

It means:

```text
FitBounds = union(StageGuideBounds, SVG-Edit getStrokedBBox())
```

Consequences:

- a tiny costume no longer expands until its old SVG rectangle dominates the whole editor;
- a normal costume keeps the stage-sized reference visible;
- artwork intentionally drawn outside the stage is included by Fit and cannot become visually lost;
- blank artwork still fits the stage guide.

The source SVG document resolution is not changed by Fit.

## Portable export normalization

An unbounded editing workspace means artwork may have negative coordinates or extend beyond the imported SVG width/height. A portable SVG cannot rely on editor-only overflow behavior, because Scratch/runtime renderers may clip to its root viewport.

Therefore export performs a **clone-only normalization** at the backend transfer boundary:

```text
live SVG-Edit document
    |  getSvgString()
    |  getStrokedBBox()
    v
serialized clone
    -> width/height = tight stroked artwork bounds
    -> viewBox = 0 0 width height
    -> renderable content translated by -sourceOrigin
    -> canonical SVG transfer
```

This does **not** call `setResolution('fit')`, mutate SVG-Edit history, or make the backend authoritative over the Project.

### Rotation-center preservation

The same source-origin translation is applied to costume rotation center metadata:

```text
exportRotationCenterX = liveRotationCenterX - artworkBounds.x
exportRotationCenterY = liveRotationCenterY - artworkBounds.y
```

Thus moving the portable SVG viewport around the artwork does not move the costume's semantic origin relative to the stage.

## Frozen authority boundary

This hotfix does not modify:

- `ngvge.vector-art-document@1` schema;
- `ngvge.paint-backend-contract@1`;
- Resource/Project/Transaction authority;
- ArtDocumentId / ResourceId identity;
- WS-10C Review/Commit semantics.

`setWorkspaceContext()` and `getExportMetadata()` are adapter controls only. They are not promoted into PaintBackendContract.

## Permanent regression

The stage-specific regression must continue to cover:

- real SVG-Edit 7.4.2 `show_outside_canvas` source contract;
- Scratch-style guide reference constants;
- old HF1 25% / 50% / 100% / 200% / Fit alignment;
- unbounded `svgcontent` overflow;
- hidden finite `canvasBackground`;
- stage guide derived from stage size + rotation center;
- Fit over Stage + artwork union;
- selection/content alignment for objects outside the imported SVG viewport;
- host resize does not resize document semantics;
- tight portable export of off-viewport artwork;
- rotation-center translation preservation;
- stage guide absent from exported SVG.

## F2C status

This hotfix removes the finite-canvas presentation defect but does not close WS-10F2C. F2C remains:

**IN PROGRESS / P0 CORE VERIFIED / P1 PARTIAL**

Remaining Vector Professional Tooling scope (Join/Split/Scissors and outstanding P1 tools) is unchanged.

## Superseding alignment correction | WS-10F2C-HF2

Real-browser evidence after HF1 showed that two implementation details were still insufficient: source inline `overflow:hidden` could continue clipping nested `svgcontent`, and an outer-root stage guide still maintained a second document-to-viewport mapping. `WS-10F2C-HF2 | Scratch-Style Unbounded Viewport Alignment` supersedes those implementation details while preserving HF1's product decision and all frozen transform/authority constraints.

HF2 moves the guide inside `svgcontent`, rebases the costume registration point to a stable editor origin, forces live nested-SVG overflow without serializing that presentation override, and reconstructs rotation-center metadata at tight export.
