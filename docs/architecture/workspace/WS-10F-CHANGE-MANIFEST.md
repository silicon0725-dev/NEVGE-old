# WS-10F Change Manifest

Baseline: `WS-10E | COMPLETE / VERIFIED`

## Production

- Pin `@svgedit/svgcanvas@7.4.2` in package metadata/lock.
- Add SVG-Edit Vector backend adapter and transfer adapter.
- Add Workspace-native Vector editor surface and minimal tool controls.
- Route SVG Better Paint sessions to SVG-Edit; retain raster compatibility backend.
- Keep all Project mutation on WS-10C reviewed transaction path.

## Tests / gates

- Add SVG-Edit adapter/transfer tests.
- Update Better Paint/runtime tests for SVG-vs-raster backend selection.
- Add WS-10F machine validator and real-package byte validator.

## Explicit exclusions

- No full SVG-Edit Editor/App Shell.
- No SVG-Edit persistence, Project, Resource, timeline or identity authority.
- No miniPaint or Piskel production integration.
- No test verification shim in Overlay.
