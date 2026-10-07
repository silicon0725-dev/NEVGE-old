# WS-10F HF3 | SVG-Edit Vector Presentation Isolation

Status: `HOTFIX / VERIFIED`

## Problem

`@svgedit/svgcanvas` is embedded without the full SVG-Edit App Shell. The low-level canvas can successfully load a canonical SVG while still lacking the App Shell's presentation context. Two host-side presentation assumptions were missing:

1. the outer SVG root was left at its intrinsic editor dimensions rather than being fitted to the Better Paint surface;
2. inline SVG `currentColor` inherited NGVGE's light Workspace text color instead of the standalone SVG initial black color.

This can produce an apparently blank white vector canvas even though `setSvgString()` succeeded and the document is present.

## Fix

The SVG-Edit adapter now owns a presentation-only outer-root projection:

```text
canonical SVG source
        ↓
SVG-Edit svgcontent          (authoring source; unchanged)
        ↓
SVG-Edit outer svgroot       (presentation only)
        ├─ width/height = 100%
        ├─ viewBox = 0 0 documentWidth documentHeight
        ├─ preserveAspectRatio = xMidYMid meet
        └─ color = black (standalone currentColor baseline)
```

The adapter does **not** call `setResolution()` or `setCurrentZoom()` to implement Workspace fitting because those APIs alter authored document/viewBox semantics.

## Authority / persistence boundary

The presentation projection is never serialized by `exportTransfer()`. The exported SVG source remains the canonical Working Copy SVG byte-for-byte until the user actually edits the document.

## Regression coverage

- `currentColor` SVG remains source-identical on export;
- outer presentation root is fitted to the current document dimensions;
- resize remains presentation-only;
- document resolution APIs are not used;
- Vector production Webpack entry remains green.
