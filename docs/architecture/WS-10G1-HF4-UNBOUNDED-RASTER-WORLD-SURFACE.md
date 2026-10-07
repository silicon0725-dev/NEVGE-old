# WS-10G1-HF4｜Unbounded Raster World Surface

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING

## Scope

HF4 fixes the remaining Bitmap editing boundary exposed by the HF3 browser retest. The HF2 compositor/camera model and
HF3 compatibility pivot resolver remain intact. HF4 changes only replaceable Raster-backend authored storage behavior.
It does not reopen ARC-0001, WS-10D Art/Animation Semantic Freeze, WS-10E PaintBackendContract, or any Vector
conformance/frozen transform contract.

## Browser failure that superseded HF3

After HF3 corrected the imported bitmap pivot, the browser still showed a hard drawing/display limit at the source PNG
rectangle. Brush strokes could enter transparent space only until they crossed the imported raster bounds, where they
were clipped/stopped.

The cause was explicit in the backend: the imported PNG canvas was still treated as both authored pixel storage and the
valid document domain. `documentToPixel()` rejected world-space coordinates outside `[0,width) x [0,height)`. Therefore
the camera could pan through an apparently unbounded world while the actual authored raster remained bounded by the
source image dimensions.

This is a storage/world-model defect, not another camera or Stage Guide transform defect.

## Scratch Vector reference

Reference-only source: `scratchfoundation/scratch-paint` at
`f8966f09df9a994c207db10b4ab52f530a1172d8` (AGPL-3.0).

Scratch separates project/world content from `paper.view`: content items exist in project coordinates while the view
owns zoom/pan. Its Vector interaction domain can include the visible view rather than being defined by an imported SVG
rectangle. Scratch also keeps Raster, Painting, Background Guide, Outline, and other guide layers separate.

NGVGE adopts that architectural separation, not Scratch's implementation code. In particular, NGVGE does **not** copy
Scratch's finite `MAX_WORKSPACE_BOUNDS` clamp. The Stage Guide remains presentation-only and does not define the Raster
authoring boundary.

## HF4 contract

### Imported PNG is a storage seed, not the world

The decoded PNG initializes an offscreen Raster surface, but its width/height no longer define the legal authored
workspace. The backend tracks a world-space `surfaceOrigin` separately from the Canvas pixel origin.

For an imported bitmap:

```text
world-space pixel position = surfaceOrigin + storage pixel position
```

The effective costume rotation center represented by that storage is therefore:

```text
rotationCenter = -surfaceOrigin
```

### Dynamic authored-surface growth

Before Brush commits a stroke segment, the backend computes the stroke's world-space bounds. If any part lies outside
the current authored surface, storage grows in chunked increments with padding. Existing pixels are copied into the
replacement offscreen Canvas at the appropriate offset and `surfaceOrigin` is adjusted by the exact left/top growth.

Camera center, zoom, pan, Stage Guide geometry, and editor origin are not moved when storage grows.

This means drawing beyond the source image edge expands authored storage underneath a stable world, rather than moving
or resizing the editor viewport around the user.

### Shared world/camera mapping

Artwork rendering, Stage Guide rendering, Brush input, Eyedropper input, and viewport composition continue to use the
single HF2 camera contract. HF4 only changes world-to-storage mapping after the camera has produced document/world
coordinates.

### Undo / Redo

Raster history snapshots include both RGBA storage and `surfaceOrigin`. Undo/Redo therefore restore storage dimensions,
pixels, and world placement atomically. Undoing a stroke that first expanded left/up can shrink back to the original
surface without shifting the Stage Guide or camera.

### Export geometry

Export dimensions follow the current authored surface dimensions, not the original PNG dimensions. The exported
rotation center is derived from the effective surface origin so left/top growth is compensated correctly:

```text
rotationCenterX = -surfaceOrigin.x
rotationCenterY = -surfaceOrigin.y
```

This geometry still flows through Working Copy / Review / Transaction authority. The Raster backend does not directly
own Project persistence.

## Deliberate limits of the P0 implementation

"Unbounded workspace" does not mean allocating an actually infinite bitmap. HF4 uses a dynamically growing contiguous
Canvas as the current P0 storage implementation. It is sufficient to remove the imported-PNG boundary for normal
editing, but extremely distant authored islands could require very large allocations.

A future storage optimization may replace this with sparse/tiled chunks without changing the world/camera or
PaintBackendContract semantics established here.

Flood Fill and Eyedropper intentionally operate on currently authored finite raster storage. An infinite transparent
flood is undefined and is not introduced by HF4.

## Non-goals

- no Scratch App Shell or AGPL implementation copied into NGVGE core;
- no `MAX_WORKSPACE_BOUNDS` or equivalent artificial workspace clamp;
- no new ArtDocument / AnimatedRasterDocument schema;
- no Layer/Frame/Cel identity changes;
- no Project, Persistence, Transaction, or Resource authority transfer;
- no Vector viewport rewrite;
- no automatic deletion of dirty pixels created by earlier browser-failed builds.

## Browser exit condition

From a clean Working Copy, draw a Brush stroke that begins inside the imported bitmap and crosses each original PNG
edge into transparent world space. The stroke must remain visible and editable beyond the old boundary. Then pan farther
away, draw again, run 25% / 50% / 100% / 200% / Fit, save/reopen, and verify that Stage Guide, artwork, pointer mapping,
and costume pivot remain stable.
