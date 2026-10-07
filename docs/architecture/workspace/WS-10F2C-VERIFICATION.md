# WS-10F2C Verification

Stage: **Vector Professional Tooling**

Status: **IN PROGRESS / P0 CORE VERIFIED / P1 PARTIAL**

## WS-10F2C-HF2 | Scratch-Style Unbounded Viewport Alignment

Real-browser evidence after HF1 showed that the finite nested SVG viewport could still clip authored geometry and that the outer-root Stage Guide still had a second transform implementation. HF2 replaces that implementation with the Scratch-style Editor Origin / Guide / View separation.

Focused evidence on the current tree:

- dedicated HF2 SVG-Edit + Scratch source contract: **22 / 22 PASS**
- inherited HF1 Infinite Workspace gate: **17 / 17 PASS**
- inherited WS-10F2B-HF1 real DOM/transform contract: **14 / 14 PASS**
- inherited WS-10F2B-HF1 semantic machine gate: **25 / 25 PASS**
- F2C real SVG-Edit professional-core source contract: **28 / 28 PASS**
- F2C machine gate: **40 / 40 PASS**
- SVG-Edit Vector backend adapter: **1 suite / 30 tests PASS**
- dedicated WorkspaceVectorEditor + NativePaintHost DOM/interaction: **2 suites / 3 tests PASS**

Permanent regressions now prove:

- imported `style="overflow:hidden"` cannot clip the live editor while selectors remain visible;
- the live `overflow: visible !important` override is restored to authored state during serialization;
- costume rotation center is rebased to one stable adapter-local editor origin without creating Working Copy dirty/history state;
- the Stage Guide is a child of `svgcontent`, uses document-space coordinates, and has no independent zoom/translation transform;
- Stage Guide, artwork and hit testing therefore share the same `svgcontent` DOM CTM;
- selector geometry continues to use SVG-Edit's native HF1 selector transform chain;
- Fit remains `union(stage, authored stroked artwork)`;
- tight export reconstructs rotation-center metadata from `editorOrigin - sourceOrigin`;
- 25% / 50% / 100% / 200% / Fit and Hand/Pan remain aligned;
- host resize/pan/zoom never calls semantic document `setResolution()`.

The current stage-specific production Webpack run again exceeded the execution window after Babel reported deoptimised code generation for the real 500KB+ `@svgedit/svgcanvas/dist/svgcanvas.js`. It returned no final webpack stats and is therefore **INCONCLUSIVE**, not PASS or FAIL.

## WS-10F2C-HF1 | Infinite Vector Workspace / Stage Guide

The finite SVG document rectangle is no longer treated as the Vector editing boundary.

Focused evidence on the current tree:

- dedicated real-package / Scratch-reference machine gate: **17 / 17 PASS**
- inherited WS-10F2B-HF1 real DOM/transform contract: **14 / 14 PASS**
- inherited WS-10F2B-HF1 semantic machine gate: **25 / 25 PASS**
- F2C real SVG-Edit professional-core source contract: **28 / 28 PASS**
- F2C machine gate after workspace changes: **40 / 40 PASS**
- SVG-Edit Vector backend adapter: **1 suite / 30 tests PASS**
- dedicated WorkspaceVectorEditor + NativePaintHost interaction run: **2 suites / 3 tests PASS**

The new permanent regression proves:

- `show_outside_canvas` / `svgcontent overflow=visible` keeps authored vector geometry available outside the imported SVG viewport;
- SVG-Edit's finite white `canvasBackground` is hidden from NGVGE presentation;
- the Scratch-referenced stage guide is presentation-only and centered on costume rotation center;
- Fit uses the union of stage-sized guide bounds and real stroked artwork bounds;
- selection geometry stays aligned for objects with coordinates outside the source SVG viewport;
- 25% / 50% / 100% / 200% / Fit continue to share the HF1 transform authority;
- portable export tightens off-viewport artwork and applies the same source-origin translation to rotation center;
- stage guide DOM is absent from the exported SVG;
- no workspace pan/zoom/Fit path calls semantic document `setResolution()`.

TypeScript scope and ESLint correctness both PASS on this working tree.

The stage-specific F2C production Webpack attempt exceeded the execution window while compiling the real SVG-Edit dependency and emitted no final webpack stats. Per Conformance rules it remains **INCONCLUSIVE**, not PASS or FAIL, until a complete stats callback is captured.

## Focused evidence

Latest focused run:

- real `@svgedit/svgcanvas@7.4.2` professional-core source contract: **28 / 28 PASS**
- NGVGE F2C machine gate: **40 / 40 PASS**
- SVG-Edit Vector backend adapter: **1 suite / 30 tests PASS**
- Workspace / Native Paint professional DOM and interaction: **4 suites / 7 tests PASS**

The package-source gate directly verifies native SVG-Edit behavior used by NGVGE, including multi-select, marquee, selection resize/rotate, Shift constraint, Alt-drag duplicate, object grouping/arrange, and path-edit/Bezier foundations. This prevents a mocked NGVGE adapter from being accepted when the pinned real package lacks the operation.

## HF1 inheritance after F2C changes

- SVG-Edit DOM/transform source gate: **14 / 14 PASS**
- HF1 semantic machine gate: **25 / 25 PASS**
- permanent 25% / 50% / 100% / 200% / Fit alignment regressions: **PASS**
- Hand/Pan shared-transform regression: **PASS**
- semantic document resize from host zoom/pan/resize: **none**

## Cross-cutting gates on the F2C working tree

- TypeScript scope: **PASS**
- ESLint correctness: **PASS**
- Integration: **4 suites / 5 tests PASS**
- Smoke: **1 / 1 PASS**
- Permanent Regression: **19 / 19 PASS**
- Full Unit: **Node 156 suites / 878 tests PASS; DOM harness 3 suites / 27 tests PASS**
- ARC-C001.1 baseline: **7 / 7 PASS**
- LRC-G1 certification: **9 / 9 PASS**
- LPL-G1 certification: **9 / 9 PASS**
- LEX-G1 certification: **9 / 9 PASS**
- LSC-G1 certification: **7 / 7 PASS**
- COL-0: **4 suites / 12 tests PASS**

## Explicit inconclusive evidence

- F2C production Webpack entry: **INCONCLUSIVE** in repeated stage-specific executions that exceeded the available execution window while Babel was processing the real `@svgedit/svgcanvas` distribution. No compiler error was emitted before timeout, but timeout is neither PASS nor FAIL.

HF1 has separate prior production Webpack evidence of **0 errors / 0 warnings**; that evidence freezes HF1 but must not be misrepresented as a completed F2C production build.

## Remaining feature blockers

F2C remains open because focused conformance success is not equivalent to completing the Handoff feature list. Outstanding work is:

- Join Path
- Split / Scissors
- Curvature Tool
- explicit Smooth/Pencil refinement
- Polygon
- Star
- dedicated Rounded Rectangle
- Eyedropper

Until these are implemented or formally re-scoped, F2C must not be marked COMPLETE/FROZEN.
