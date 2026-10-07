# WS-10E｜Paint Backend Contract & OSS Intake

**Status:** `COMPLETE / VERIFIED`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-10D | COMPLETE / ARCHITECTURE FROZEN`  
**Contract ID:** `ngvge.paint-backend-contract@1`  
**Registry ID:** `ngvge.paint-backend-registry@1`  
**Transfer ID:** `ngvge.paint-backend-transfer@1`

## 1. Purpose

WS-10E converts the WS-10D art/animation semantic freeze into a replaceable backend boundary before SVG-Edit, miniPaint, Piskel, or another editor is allowed into production Better Paint.

This stage does **not** integrate those OSS projects into the production bundle. It freezes the contract they must satisfy and records formal OSS intake decisions from upstream primary sources researched on 2026-08-14.

```text
NGVGE PaintDocument
        +
portable content payloads
        +
stable semantic target
        ↓
PaintBackendContract v1
        ↓
replaceable editor backend
        ↓
PaintBackendTransfer v1
        ↓
NGVGE Working Copy / Review / Transaction
```

## 2. Authority rule

A Paint backend may own only transient implementation state inside its editing session.

It cannot own:

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
SliceId
Project mutation
Resource mutation
Transaction authority
Workspace persistence
Timeline semantics
```

Every backend descriptor carries an explicit all-false authority record. A descriptor that attempts to claim one of those authority domains is rejected.

No backend may add a hidden `saveProject`, `persist`, VM, renderer, filesystem, or equivalent authority method to the exposed binding surface.

## 3. Stable backend surface

`PaintBackendContract v1` exposes only:

```text
mount(container, portableOptions)
load(PaintBackendTransfer)
setActiveTarget(stable semantic IDs)
exportTransfer()
resize(portableSize)
focus()
dispose()

optional:
undo()
redo()
getHistoryState()
subscribe()
```

`container` is an explicit UI mount seam and is never serialized. All results/events crossing back from a backend must be portable JSON or a normalized PaintBackendTransfer; functions, DOM handles, editor instances, raw Canvas objects, VM/renderer handles, or backend model objects are rejected by the contract boundary.

## 4. PaintBackendTransfer v1

The transfer envelope contains:

```text
ngvge.paint-backend-transfer@1
├── normalized NGVGE PaintDocument
├── contentEntries[]
└── activeTarget
```

The backend must preserve `ArtDocumentId` and `ResourceId` across export.

### Vector transfer

Vector v1 is document-scoped:

```text
VectorArtDocument
+
exactly one canonical SVG source entry
semanticId = ArtDocumentId
```

### RGBA raster transfer

RGBA Cel content uses portable bounded raster payloads keyed by stable `CelContentId`.

### Indexed pixel transfer

Indexed pixel authoring is **not flattened to PNG** at this boundary.

It uses:

```text
kind = indexed-raster
encoding = base64-u8
width / height
one palette index per pixel
PaletteId
```

This preserves the WS-10D indexed Palette semantic owner and prevents a Piskel-style backend from silently converting indexed authoring source into a flattened RGBA export.

## 5. Timeline and animation ownership

Bitmap and Pixel backends may provide editing/rendering support for frames, layers, cels, previews, or onion-skin behavior, but:

```text
Timeline identity = NGVGE
FrameId           = NGVGE
LayerId           = NGVGE
CelId              = NGVGE
Clip / Marker      = NGVGE
```

A backend may translate those identities into transient local objects and back. It may not persist its private IDs into Project semantics.

This rule applies even to Piskel, despite Piskel already having its own frame/layer/animation UI.

## 6. Formal OSS intake

### 6.1 SVG-Edit / @svgedit/svgcanvas

**Decision:** `APPROVED_FOR_POC`  
**Planned role:** Primary Vector backend  
**Integration:** `library`

Primary source:

```text
https://github.com/SVG-Edit/svgedit
```

Observed upstream facts on 2026-08-14:

- upstream identifies SVG-Edit as a browser SVG editor;
- upstream explicitly splits the underlying `svgcanvas` editing engine from the editor UI;
- upstream documents embedding the editor in an arbitrary DOM container;
- upstream documents installing `@svgedit/svgcanvas` to build a custom editor;
- repository declares the MIT license.

NGVGE decision:

```text
Prefer @svgedit/svgcanvas / component-level integration
over adopting the complete SVG-Edit application shell.
```

PoC must prove canonical SVG load/edit/export through `PaintBackendTransfer v1` while preserving NGVGE document/resource identity.

### 6.2 miniPaint

**Decision:** `CONDITIONAL_POC`  
**Planned role:** Primary Bitmap backend candidate  
**Integration:** `controlled-fork`

Primary source:

```text
https://github.com/viliusle/miniPaint
```

Observed upstream facts on 2026-08-14:

- browser image editor with layers, selections, drawing tools, filters and JSON layer export;
- repository declares the MIT license;
- upstream README's documented embedding path is an iframe around the full application.

NGVGE decision:

```text
PRODUCTION iframe embedding = FORBIDDEN
```

The PoC must extract/wrap the useful canvas/layer/tool implementation behind PaintBackendContract. miniPaint file I/O, application shell, persistence, dialogs and backend-local identity do not become Workspace authority.

Bitmap animation Timeline remains NGVGE-owned; miniPaint is expected to edit NGVGE-selected raster frame/cel state rather than define animation identity.

### 6.3 Piskel

**Decision:** `CONDITIONAL_POC`  
**Planned role:** Primary Pixel backend candidate  
**Integration:** `controlled-fork`

Primary source:

```text
https://github.com/piskelapp/piskel
```

Observed upstream facts on 2026-08-14:

- browser sprite/pixel-art editor built in JavaScript/HTML/CSS;
- supports sprites/animation and has frame/layer/onion-skin concepts in the upstream project;
- repository declares Apache-2.0;
- current repository contains modern browser-development/test infrastructure;
- upstream states that large refactors and UX-impacting feature PRs are unlikely to be reviewed due to limited maintainer time.

NGVGE decision:

A controlled integration fork is expected. Piskel's private Frame/Layer IDs, timeline ordering, palette objects, local persistence and application shell are adapters only.

The PoC must prove:

```text
NGVGE Layer/Frame/Cel/Palette
        ↕ adapter
Piskel transient model
        ↕
PaintBackendTransfer v1
```

without adopting Piskel IDs as Project semantics.

### 6.4 Scratch Paint

**Decision:** `COMPATIBILITY_ONLY`

The existing `scratch-paint` integration remains available as compatibility/reference implementation during migration. It is not the target Vector/Bitmap/Pixel multi-backend architecture and does not block replacement.

## 7. Admission states

```text
SVG-Edit     approved-for-poc
miniPaint    conditional-poc
Piskel       conditional-poc
scratch-paint compatibility-only
```

No candidate is `production-admitted` in WS-10E.

No SVG-Edit, miniPaint or Piskel package/source is added to the production dependency graph in this stage.

## 8. PoC acceptance gates for WS-10F/G/H

Every backend integration PoC must prove:

1. it consumes a normalized `PaintBackendTransfer`;
2. it exports a normalized transfer with the same `ArtDocumentId` / `ResourceId`;
3. backend-local IDs never cross the adapter boundary;
4. changes remain Working Copy changes until the existing NGVGE Review/Transaction path commits them;
5. timeline semantics stay NGVGE-owned;
6. no independent persistence/file/project authority is activated;
7. dispose releases all transient backend state;
8. production bundle impact and license obligations are recorded before promotion from PoC.

## 9. Non-goals

WS-10E does not:

- vendor or install SVG-Edit, miniPaint or Piskel;
- switch the Better Paint production editor;
- implement the unified Timeline;
- implement animation persistence;
- reopen WS-9 Capability/Transaction authority;
- change WS-10D authoring schemas.

## 10. Resume point

```text
WS-10D  2D Art & Animation Semantic Freeze
COMPLETE / ARCHITECTURE FROZEN
        ↓
WS-10E  Paint Backend Contract & OSS Intake
COMPLETE / VERIFIED
        ↓
WS-10F  Vector Backend Integration
NEXT
```
