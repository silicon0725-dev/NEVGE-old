# WS-10F｜Vector Backend Integration

**Status:** `IMPLEMENTED / CONDITIONAL VERIFIED`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-10E | COMPLETE / VERIFIED`  
**Date:** `2026-08-15`

## Goal

Integrate the approved SVG-Edit vector backend against the WS-10D/WS-10E NGVGE-owned contracts without importing the SVG-Edit application shell or granting the backend Project, Resource, transaction, persistence, timeline, or semantic-identity authority.

WS-10F production flow is:

```text
canonical SVG Resource
        ↓
Paint Working Copy
        ↓
ngvge.paint-backend-transfer@1
        ↓
ngvge.paint-backend-adapter.svg-edit@1
        ↓
@svgedit/svgcanvas@7.4.2
        ↓
canonical SVG export
        ↓
Paint Working Copy
        ↓
WS-10C reviewed resource.content.replace
```

## Pinned OSS dependency

```text
package  @svgedit/svgcanvas
version  7.4.2 exact
license  MIT
mode     library / canvas core
```

The full `svgedit` Editor/App Shell is not integrated. The adapter consumes only the `SvgCanvas` library API. The dependency is exact-pinned in `package.json` and `bun.lock`.

Primary upstream evidence used for this intake/integration:

- https://github.com/SVG-Edit/svgedit
- https://www.npmjs.com/package/@svgedit/svgcanvas
- https://github.com/SVG-Edit/svgedit/blob/v7.4.2/packages/svgcanvas/svgcanvas.d.ts
- https://github.com/SVG-Edit/svgedit/blob/v7.4.2/docs/tutorials/Events.md
- https://github.com/SVG-Edit/svgedit/blob/v7.4.2/src/editor/panels/LeftPanel.js

## Stable integration identities

```text
Backend candidate
ngvge.paint-backend.svg-edit

Backend adapter
ngvge.paint-backend-adapter.svg-edit@1

Transfer adapter
ngvge.paint-backend-transfer-adapter.svg-edit@1

NGVGE vector controls
ngvge.vector-paint-backend-controls@1
```

SVG-Edit private DOM ids, selection ids, layer objects, history objects, or element references are not NGVGE identities.

## Vector transfer boundary

The backend receives a `VectorArtDocument` and one canonical SVG `document-source` entry. `ArtDocumentId` is deterministically derived from the canonical `ResourceId`; export must preserve both.

```text
ResourceId
ngvge:resource:...
        ↓
ArtDocumentId
ngvge:art-document:...
        ↓
VectorArtDocument
        ↓
canonical SVG
```

The adapter never promotes SVG-Edit DOM elements or its internal layers to `LayerId`/Project semantics.

## Minimal NGVGE-owned vector toolbar

WS-10F intentionally does not embed SVG-Edit's complete UI. Better Paint provides a small Workspace-native toolbar over `SvgCanvas.setMode()`:

```text
Select
Freehand
Line
Rect
Ellipse
Path
Text
Undo
Redo
```

`freehand` maps to the upstream `fhpath` mode; private backend mode names remain inside the adapter.

## Presentation boundary

Workspace resize is presentation-only. The adapter changes its mount container dimensions and does **not** call SVG-Edit `setResolution()` from Workspace resize because document geometry must not be mutated by window geometry.

## Change propagation

The adapter listens to the SVG-Edit `changed` canvas event and exports canonical SVG back into the transient NGVGE Paint Working Copy. Backend undo/redo remains backend-local authoring history until the user explicitly commits through the existing WS-10C Project transaction path.

```text
SvgCanvas changed
      ↓
backend exportTransfer()
      ↓
Working Copy dirty
      ↓
Review
      ↓
Evidence
      ↓
Project transaction
```

No `vm.updateSvg`, raw Scratch Asset, renderer, or Project mutation is performed by SVG-Edit.

## Raster compatibility seam

WS-10F changes only SVG resources:

```text
SVG    → SVG-Edit vector backend
PNG/JPG → scratch-paint compatibility raster backend
```

The raster compatibility seam remains until the approved bitmap backend is integrated in a later stage.

## External package-byte verification boundary

The current execution harness cannot resolve/download new npm package bytes through its shell. WS-10F therefore separates two forms of evidence:

1. **NGVGE adapter/contract evidence** — executed and PASS using an injected API-compatible verification double.
2. **Published package-byte gate** — requires the real installed `@svgedit/svgcanvas@7.4.2` package and must PASS before WS-10F may be upgraded to `COMPLETE / VERIFIED`.

The verification double is local test infrastructure only and is excluded from the Overlay. `package.json` and `bun.lock` pin the official package so a normal dependency install resolves the real bytes.

## Authority freeze

SVG-Edit owns none of:

```text
ResourceId
ArtDocumentId
Project state
Resource state
Workspace persistence
Project transaction
Review evidence
Timeline identity
Window/Tool identity
```

It is a replaceable vector editing backend only.

## DoD

- [x] SVG-Edit dependency exact-pinned to 7.4.2.
- [x] Bun lock integrity pinned.
- [x] No full SVG-Edit App Shell integration.
- [x] `PaintBackendContract` binding implemented.
- [x] canonical SVG load/export implemented.
- [x] ResourceId / ArtDocumentId preserved across backend export.
- [x] NGVGE-owned minimal vector tool controls implemented.
- [x] changed-event → Working Copy flow implemented.
- [x] Undo/Redo adapter implemented.
- [x] Workspace resize cannot mutate SVG document geometry.
- [x] SVG resources select SVG-Edit; raster remains compatibility backend.
- [x] Project save remains WS-10C Review/Evidence/Transaction.
- [x] Focused NGVGE tests pass.
- [x] TypeScript and correctness ESLint pass.
- [ ] Real published `@svgedit/svgcanvas@7.4.2` package-byte production build gate — blocked by current harness package-network access.

Until the final item is executed with actual installed package bytes, WS-10F remains `IMPLEMENTED / CONDITIONAL VERIFIED`, not `COMPLETE / VERIFIED`.
