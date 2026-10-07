# WS-10D｜2D Art & Animation Semantic Freeze

**Status:** `COMPLETE / ARCHITECTURE FROZEN`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-10C | COMPLETE / VERIFIED`  
**Contract ID:** `ngvge.paint-document-contract@1`

## 1. Purpose

WS-10D freezes NGVGE-owned 2D art and frame-animation semantics **before** SVG-Edit, miniPaint, Piskel, or any other OSS editor is integrated as a production backend.

The goal is not to implement a new editor in this stage. The goal is to ensure that future editor backends can be replaced without changing NGVGE Project identity, animation identity, authoring schema, transaction semantics, or runtime-facing animation metadata.

No production Paint behavior switches in WS-10D.

## 2. Ownership rule

NGVGE owns:

```text
ArtDocumentId
ResourceId
LayerId
FrameId
CelId
CelContentId
ClipId
MarkerId
PaletteId
PaletteEntryId
SliceId

Versioned authoring schema
Layer / Frame / Cel relationships
Linked/shared cel semantics
Animation clip semantics
Animation event marker semantics
Palette ownership
Slice / 9-slice / collision annotation semantics
Authoring-source vs export distinction
Project / Resource transaction identity
```

Replaceable backends may own only transient implementation state:

```text
SVG DOM/editor object
Canvas objects
miniPaint layer objects
Piskel frame/layer objects
brush engine internals
selection handles
render caches
undo stacks internal to a backend working session
```

Backend-local IDs are never NGVGE semantic IDs.

## 3. Frozen document families

### 3.1 Vector art

Stable schema:

```text
ngvge.vector-art-document@1
```

Vector authoring source v1 is canonical SVG.

The schema owns:

```text
ArtDocumentId
ResourceId
Viewport
sourceFormat = svg
```

An SVG editor backend may transform SVG internally, but its DOM nodes, editor instances, private layer IDs, or plugin objects do not become Project semantics.

### 3.2 Bitmap / pixel art

Stable schema:

```text
ngvge.animated-raster-document@1
```

Bitmap and pixel editing share one NGVGE authoring family:

```text
mode = bitmap | pixel
```

A static bitmap/pixel document is represented as an animated raster document containing one frame. NGVGE does not create a second incompatible static raster authoring schema.

## 4. Layer × Frame × Cel

Raster animation uses a stable two-dimensional timeline:

```text
                    Frame 1    Frame 2    Frame 3
Layer: Hair            Cel        Cel        Cel
Layer: Eyes            Cel        Cel        Cel
Layer: Body             Cel        Cel        Cel
```

The semantic identity is never the array index.

### Layer

Frozen fields include:

```text
LayerId
name
type = raster | group | mask
parentLayerId
visible
locked
alphaLocked
opacity
blendMode
clipToLayerId
maskTargetLayerId
```

Group layers cannot own Cels. Mask layers may own raster mask Cels but must name an existing semantic target.

### Frame

A Frame owns:

```text
FrameId
durationMs
```

FPS is a presentation/editing convenience derived from frame durations. Frame duration is the source semantic.

### Cel

A Cel is the semantic intersection of one Layer and one Frame:

```text
CelId
LayerId
FrameId
CelContentId
x / y
opacity
```

Only one Cel may occupy a Layer × Frame slot.

### Linked/shared Cels

Linked Cels are represented by multiple Cels referencing the same stable `CelContentId`:

```text
Cel A ─┐
       ├── CelContentId = ngvge:cel-content:body-held
Cel B ─┘
```

No `PiskelFrameId`, miniPaint layer object, DOM node identity, array index, or backend pointer is used to express sharing.

## 5. Animation clips

Stable identity:

```text
ClipId = ngvge:animation-clip:*
```

A clip defines a stable frame range and playback policy:

```text
name
startFrameId
endFrameId
playbackMode
    once
    loop
    ping-pong
    reverse
loopCount? // null = backend/runtime-defined continuous loop where applicable
```

Example runtime-facing clips:

```text
idle
walk
run
attack
hurt
death
```

Clip identity belongs to NGVGE and may later bind directly to Runtime Animation Components.

## 6. Animation markers / game events

Stable identity:

```text
MarkerId = ngvge:animation-marker:*
```

A marker is bound to:

```text
FrameId
offsetMs
kind = event | note
name
portable JSON payload
```

This creates the future seam:

```text
Better Paint Timeline
        ↓
Animation Marker
        ↓
NGVGE Animation Runtime
        ↓
Gameplay Event
```

Marker payloads must remain portable JSON. Backend objects, functions, VM handles, renderer handles, and DOM references are invalid.

## 7. Palette semantics

Stable identity:

```text
PaletteId
PaletteEntryId
```

Palette ownership is explicit:

```text
embedded
or
resource-backed
```

Indexed raster documents must identify a Palette owner.

Embedded palette v1 is capped at 256 indexed entries. Resource-backed palettes reference canonical `ngvge:resource:*` identity and must not duplicate palette entry data in the document.

A future Palette Resource may therefore be shared by multiple sprites without adopting a pixel-editor backend's private palette model.

## 8. Slice / game-asset annotation semantics

Stable identity:

```text
SliceId = ngvge:slice:*
```

Frozen v1 roles:

```text
generic
nine-slice
hitbox
hurtbox
```

Slices may be global or frame-keyed. A slice key may include:

```text
bounds
pivot
nine-slice center bounds
```

This creates a stable game-asset seam for UI 9-slice regions and collision/hurt regions without binding authoring metadata to a particular editor.

## 9. What is NOT Project semantic state

The following are editor/session presentation state and are deliberately excluded from the frozen document schemas:

```text
active frame
active layer
canvas zoom
canvas pan
window geometry
onion skin enabled/count/colors
preview zoom
brush selection
brush size
selected tool
selection marquee
reference-image window placement
timeline scroll/zoom
backend undo cursor
```

These belong to Workspace / Tool session persistence, not Project resource semantics.

## 10. Onion skin and preview

Onion skin and realtime preview are required Better Paint features, but their UI configuration is not part of `AnimatedRasterDocument v1`.

They consume the stable Frame/Cel graph:

```text
NGVGE Frame/Cel Working Copy
        ↓
Paint backend rendering projection
        ↓
Onion Skin / Preview
```

This prevents Piskel/Krita-like editor preferences from becoming Project serialization authority.

## 11. Authoring source != export

Frozen rule:

```text
Authoring Source
≠
Distribution / Runtime Export
```

The animated authoring document must preserve semantic structure such as Layers, Frames, Cels, shared CelContent, Clips, Markers, Palette, and Slices.

The following are derived exports only:

```text
PNG
PNG sequence
GIF
APNG
animated WebP
sprite sheet
texture atlas
runtime JSON metadata
```

Saving an editable project as a flattened GIF/sprite sheet is not a valid NGVGE authoring persistence strategy.

## 12. WS-10B / WS-10C compatibility

Existing static image infrastructure remains valid:

```text
resource-content-read
Paint Working Copy
resource.content.replace
Review Evidence
Project Transaction
```

WS-10D does not replace those paths.

Instead, they become the static-content compatibility foundation beneath the future structured art-document layer.

No new animation mutation command is introduced in WS-10D.

## 13. Reserved but not invented in v1

The following are explicitly reserved for later semantic extensions and must **not** be represented using backend-private state meanwhile:

```text
TileSet / Tilemap authoring schema
vector animation timeline
skeletal animation
procedural brush documents
reference-image project resources
advanced filter/mask graphs
cross-document animation libraries
audio tracks in the art timeline
```

Adding them requires a versioned NGVGE contract or separate semantic resource type.

## 14. Backend intake consequence

Future OSS candidates must adapt to these contracts.

Correct:

```text
OSS editor state
    ↓ adapter
NGVGE Art Working Copy
    ↓
NGVGE semantic document
```

Forbidden:

```text
Piskel frame id → FrameId
miniPaint layer object → Layer semantic identity
SVG-Edit DOM object → Resource identity
OSS serialization blob → authoritative NGVGE Project schema
```

If an OSS editor cannot map cleanly into the frozen contracts, it may be reduced to a lower-level drawing/rendering component or rejected.

## 15. Frozen invariants

WS-10D freezes these invariants:

1. Stable NGVGE semantic IDs never use backend/local indices.
2. Bitmap and pixel authoring use Layer × Frame × Cel.
3. Static raster is a one-frame instance of the raster authoring model.
4. Shared `CelContentId` expresses linked Cels.
5. Frame duration is semantic; FPS is derived UI/playback configuration.
6. Clip and Marker identities are NGVGE-owned.
7. Marker payload is portable data only.
8. Indexed documents have explicit Palette ownership.
9. Slices are semantic game-asset annotations, not editor overlays.
10. Onion-skin/zoom/tool-selection state is Workspace session state, not Project state.
11. Authoring documents are not flattened export formats.
12. OSS editor internal models remain replaceable implementation detail.
13. Existing WS-9 reviewed mutation boundaries remain authoritative.
14. WS-10D performs no production behavior switch.

## 16. Freeze statement

`ngvge.paint-document-contract@1`, `ngvge.vector-art-document@1` and `ngvge.animated-raster-document@1` are architecture-frozen at the semantic level defined by WS-10D.

Later WS-10 stages may implement, extend through explicit versioning, or adapt backends to these contracts. They may not silently redefine these identities or replace them with backend-specific IDs/schema.
