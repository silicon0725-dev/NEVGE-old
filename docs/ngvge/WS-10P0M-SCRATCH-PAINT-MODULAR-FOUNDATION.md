# WS-10P0M｜Scratch Paint Modular Foundation

Status: **IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING**

## Purpose

WS-10P0M replaces the experimental custom Vector/Raster editor route as the default Native Paint presentation with a vendored, modularized Scratch Paint baseline. It does **not** change the frozen NGVGE Art/Animation semantic model, PaintBackendContract, Working Copy authority, Resource identity, Review, Transaction, or Persistence authority.

The original Scratch Paint interaction model remains the behavioral baseline. This stage changes composition boundaries, not authoring semantics.

## Upstream baseline

The vendored source was taken from the exact dependency resolved by the current NGVGE `bun.lock`:

- repository: `02engine/scratch-paint`
- resolved revision: `a7a5c73`
- upstream package version: `2.1.61`
- upstream license in this resolved source: GNU GPL v3

The original license, README, and upstream package metadata are retained under `src/lib/vendor/scratch-paint/`.

## Module architecture

The old Paint Editor composition was hard-coded in one top-level component. WS-10P0M introduces `ngvge.scratch-paint.module-registry@1` and these stable presentation slots:

1. `fixedToolbar`
2. `propertiesToolbar`
3. `toolRail`
4. `workspace`
5. `canvasControls`
6. `workspaceOverlay`
7. `sidePanel`
8. `bottomPanel`

The first five slots reproduce the existing Scratch Paint GUI. The final three are empty extension slots in the default registry.

Intended future consumers:

- Layers -> `sidePanel`
- Timeline / animation -> `bottomPanel`
- Onion skin / pixel grid / guides -> `workspaceOverlay`

A module registry is immutable after admission. Extensions replace or compose slots by constructing a new registry; they do not mutate a global Scratch Paint singleton.

## Runtime module facade

Scratch Paint helper functionality is also exposed as namespaced implementation modules:

- `workspace`: view / layer / guides
- `document`: bitmap / format
- `interaction`: selection / group / order / snapping
- `history`: undo
- `tools`: modes

These are implementation facades for Enhanced Scratch Paint. They are **not** promoted to NGVGE Kernel identity or authority.

## Native Paint route

For SVG and PNG/JPG Resources, Native Paint now uses:

`NativePaintHost -> WorkspaceScratchPaintEditor -> Modular Scratch Paint`

Both Vector and Bitmap therefore share the original Paper workspace and original Scratch Paint GUI behavior.

The former `WorkspaceVectorEditor` / SVG-Edit and `WorkspaceRasterEditor` custom Raster Core remain in the source tree as experimental history but are no longer imported by the default Native Paint host.

Unsupported formats and the explicit Compatibility option still use the direct Scratch Paint VM wrapper as a fallback.

## Authority boundary

Scratch Paint remains an editor implementation only.

Edits flow through:

`Scratch Paint -> scratch-paint-working-copy-adapter -> Paint Working Copy -> Review -> Transaction -> Resource`

Scratch Paint does not own Project identity, Resource identity, LayerId/FrameId/CelId semantic identity, Transaction authority, or Persistence.

## Non-goals

WS-10P0M intentionally does not implement:

- user-visible Layers
- Timeline / animation
- Pixel mode
- Onion skin
- professional new tools
- new document schemas

Those features start only after the modular baseline is browser-verified.

## Success condition

The browser should look and behave like the original Scratch Paint editor for both Vector and Bitmap, while DOM inspection shows the module registry marker and NGVGE Working Copy/Review controls remain outside the Paint implementation.
