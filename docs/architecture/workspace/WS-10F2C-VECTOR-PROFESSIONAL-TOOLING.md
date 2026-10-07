# WS-10F2C | Vector Professional Tooling

Status: **IN PROGRESS / P0 CORE VERIFIED / P1 PARTIAL**

Architecture parent: `ARC-0001 | Kernel Independence Contract`

Inherited frozen contracts:

- `WS-10D | 2D Art & Animation Semantic Freeze`
- `WS-10E | PaintBackendContract & OSS Intake`
- `WS-10F2B-HF1 | Selection Overlay Zoom / Transform Alignment`

## Goal

Raise Native Vector Paint from Scratch-level editing toward a professional vector workflow without importing the SVG-Edit App Shell and without granting the backend Project, Resource, persistence, transaction or stable-identity authority.

```text
NGVGE Native Paint Shell
        |
        | tools / context actions / shortcuts / zoom-pan intent
        v
WorkspaceVectorEditor imperative surface
        |
        v
SVG-Edit Vector Backend Adapter
        |
        v
@svgedit/svgcanvas@7.4.2 operations
```

The UI vocabulary belongs to NGVGE. SVG-Edit remains a replaceable operation engine.

## Implemented P0 object tooling

- Selection (`V`)
- Direct Selection (`A`) for path edit entry
- SVG-Edit native Shift multi-select foundation
- SVG-Edit native marquee selection foundation
- Delete / Backspace
- Cut / Copy / Paste
- Duplicate (`Ctrl/Cmd+D`)
- Group / Ungroup (`Ctrl/Cmd+G`, `Shift+Ctrl/Cmd+G`)
- Bring Forward / Send Backward
- Bring to Front / Send to Back
- arrow-key nudge; Shift uses accelerated nudge
- SVG-Edit native transform selector resize / rotate foundation
- SVG-Edit native Shift transform constraint foundation
- SVG-Edit native Alt-drag duplicate foundation

No-selection and capability-invalid commands fail as bounded no-ops. The bridge does not synthesize dirty state: authoring dirty state is raised only from SVG-Edit's real `changed` event.

## Implemented P0 path tooling

- Pen / Path (`P`)
- Direct path editing through `pathActions.toEditMode()`
- Bezier/path grips supplied by the real SVG-Edit path-edit layer
- adjacent anchor insertion foundation through `clonePathNode()`
- delete selected anchor
- convert/toggle selected segment type
- force selected segment to Line / Cubic Curve
- open / close subpath
- link/unlink control points foundation

### Still open in P0

The installed core does not expose a ready NGVGE-safe command for these Handoff requirements, so they are **not** claimed complete:

- Join Path
- Split / Scissors operation

They require a controlled NGVGE path-operation extension over canonical SVG/path semantics or a separately admitted SVG-Edit operation. Backend-private path identity must not become Project identity.

## Implemented P1 foundations

- Hand (`H`)
- Space-drag temporary Hand
- Zoom (`Z`)
- 25% / 50% / 100% / 200% / Fit status control
- pointer zoom in; Shift pointer zoom out
- artboard/viewport pan and Fit foundation
- existing freehand Pencil path creation
- unbounded Vector Workspace presentation (`WS-10F2C-HF1`)
- Scratch-style stable editor-origin / viewport separation (`WS-10F2C-HF2`)
- Scratch-style stage-size guide centered on the stable editor origin
- Fit over `union(stage guide, stroked artwork)` rather than the imported SVG viewport alone
- off-viewport portable SVG normalization with rotation-center preservation

Hand/Pan and the unbounded workspace explicitly preserve HF1, with HF2 removing the last second transform implementation:

```text
Scratch-style editorOrigin (costume rotation center rebased to 0,0)
        |
        v
SVG-Edit setZoom() + updateCanvas()
        -> svgcontent CTM
              -> authored layers
              -> presentation-only stage guide in document coordinates
        -> selectorParentGroup native translation
        -> DOM screenCTM hit testing
```

The finite SVG-Edit `canvasBackground` is hidden and no longer represents an authoring boundary. The live nested `svgcontent` forces `overflow: visible !important`, including when imported SVG source contains inline `overflow:hidden`; that live override is restored to authored state during serialization so it cannot leak into Resource content. The Native Paint host remains the only screen viewport. Pan/zoom/Fit never calls `setResolution()`.

The stage guide is adapter presentation state only. It lives inside `svgcontent`, inherits the exact same document-to-viewport transform as artwork, derives from runtime `stageWidth × stageHeight`, and is detached during export. It is never promoted into `ngvge.vector-art-document@1`.

At Native Vector load, authored roots are translated so the Working Copy rotation center maps to the stable editor origin. When artwork leaves the imported SVG viewport, portable export tightens the serialized SVG around authored stroked bounds and reconstructs rotation-center metadata as `editorOrigin - sourceOrigin`. This mirrors Scratch Paint's editor-origin/content-tight export model without mutating Project/Resource authority.

### Still open in P1

- Curvature Tool
- explicit Smooth / Pencil refinement workflow
- Polygon
- Star
- Rounded Rectangle as a dedicated tool
- Eyedropper

The SVG-Edit core sanitizer understands several SVG shapes, but the installed core does not provide all of these as complete app-independent drawing operations. F2C therefore does not pretend that App-Shell extension features are core capabilities.

## Keyboard contract implemented in this checkpoint

```text
V                Selection
A                Direct Selection
P                Pen
T                Text
M                Rectangle
L                Ellipse
H                Hand
Z                Zoom
Delete/Backspace Delete object / selected path node
Ctrl/Cmd+C/X/V   Copy / Cut / Paste
Ctrl/Cmd+Z       Undo
Shift+Ctrl/Cmd+Z Redo
Ctrl/Cmd+D       Duplicate
Ctrl/Cmd+G       Group
Shift+Ctrl/Cmd+G Ungroup
Arrow            Nudge
Shift+Arrow      Accelerated nudge
Space drag       Temporary Hand pan
Shift            Native SVG-Edit constraint modifier
Alt drag         Native SVG-Edit duplicate modifier
```

## Authority boundary

F2C does not change `PaintBackendContract`, Working Copy, Review or Resource transaction semantics. In particular:

- no raw `vm.updateSvg()` / `vm.updateBitmap()` authoring path;
- no SVG-Edit File/Open/Save authority;
- no backend private ID promoted to NGVGE stable identity;
- no document resize from workspace zoom/fit/pan;
- no SVG-Edit App Shell reintroduced into Native Paint.

## Exit condition

F2C may become `COMPLETE / VERIFIED` only when the remaining P0 path operations and selected P1 professional tools are implemented or explicitly split into a separately frozen successor scope. Current verification therefore certifies the implemented P0 core, not the whole F2C feature list.
