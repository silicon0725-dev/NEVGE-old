# WS-10B｜Paint Content Read / Working Copy Adapter

**Status:** `COMPLETE / VERIFIED`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-10A | COMPLETE / VERIFIED`  
**WS-9 Foundation:** `COMPLETE / CERTIFIED`

## Objective

WS-10B introduces the first portable image-content read seam and transient Paint working-copy model without granting Better Paint direct Project-content mutation authority.

The stage proves this path:

```text
canonical Image ResourceId
        ↓
resource-content-read#query
        ↓
portable immutable source snapshot
        ↓
Paint Working Copy
        ↓
replaceable scratch-paint adapter
        ↓
local vector / bitmap edits
```

The path stops at the working copy. Project image content replacement remains a WS-10C responsibility.

## Stable identities

```text
Capability
ngvge.workspace-capability.resource-content-read

Capability facade
ngvge.workspace-resource-content-read-capability@1

Provider
ngvge.workspace-capability-provider.resource-content-read

Paint working-copy model
ngvge.workspace-paint-working-copy-model@1

Scratch Paint working-copy adapter
ngvge.workspace-paint-working-copy-adapter.scratch-paint@1
```

The existing WS-10A identities remain unchanged:

```text
ToolId     ngvge.tool.paint
WindowId   paint
Session    ngvge.workspace-paint-tool-session@1
Backend    scratch-paint@2.1.61
```

## Resource content read authority

`resource-read#query` remains metadata-only. WS-10B adds a distinct capability surface:

```text
resource-content-read#query
```

The provider may use the existing Resource database content binding internally, but the Tool receives only a portable frozen snapshot:

```text
ImageContentSnapshot v1
├── ResourceId
├── kind = image
├── dataFormat
├── bitmapResolution
├── rotationCenterX/Y
├── sourceAuthorityRevision
├── byteLength
└── content
    └── data-uri
```

The facade does not expose:

```text
asset:<uuid> internal identity
Scratch asset object
Scratch Target
VM
renderer
skinId / soundId
backend handle
storage handle
```

Supported source formats in WS-10B:

```text
svg
png
jpg / jpeg → normalized to jpg
```

A single source read is bounded to:

```text
32 MiB estimated decoded image content
```

Oversized, unloaded, unsupported, missing, or non-canonical resources fail visibly.

## Two-layer content model

WS-10B deliberately separates authoritative source data from editable Tool state.

### Layer A — immutable source snapshot

```text
Resource Authority
        ↓
Content Provider
        ↓
ImageContentSnapshot
```

This snapshot records the source authority revision and represents what was read from the Project/Resource side.

### Layer B — transient working copy

```text
ImageContentSnapshot
        ↓ clone
WorkspacePaintWorkingCopyModel
        ↓
local Paint backend edits
```

Working-copy state includes:

```text
workingCopyId
ResourceId
sourceAuthorityRevision
dataFormat
bitmapResolution
rotationCenterX/Y
dirty
stale
portable content
```

The working copy is Tool-session state. It is not a persistent Project record and it is not Resource Authority.

## Dirty / stale semantics

Local drawing changes set:

```text
dirty = true
```

A dirty working copy cannot be silently replaced by selecting another Resource or by a Context-driven Resource switch. The user must explicitly discard local edits first.

Content-affecting Resource source events mark the copy:

```text
stale = true
```

Metadata-only changes such as rename/move do not make image pixels/SVG stale.

A stale working copy is never silently overwritten. Explicit reload/discard semantics control replacement from source.

## scratch-paint adapter

`scratch-paint@2.1.61` remains a replaceable OSS backend/UI implementation.

The adapter converts the portable working copy into backend input and converts backend updates back into portable edits:

```text
SVG source
Data URI → SVG text → sanitize → PaintEditor

Vector edit
PaintEditor SVG text → working copy svg-text

Bitmap edit
PaintEditor ImageData → browser Canvas → PNG data URI → working copy
```

The adapter does not receive Project transaction authority and does not return backend/native handles.

## Lazy backend activation

The legacy integration lazily installs the real Scratch Paint reducer when the classic costume editor is activated. Better Paint now has an explicit Workspace activation action so the same replaceable reducer/backend can be mounted inside the managed Workspace Paint view without pretending that the classic tab owns the new Tool lifecycle.

This activation only makes the editing backend available. It does not grant image-content mutation authority.

## Production mutation boundary

The following calls are not part of the WS-10B Better Paint content path:

```text
vm.updateSvg(...)
vm.updateBitmap(...)
vm.renameCostume(...)
replaceAssetFromCostume(...)
raw Scratch asset mutation
renderer mutation
```

Drawing callbacks run:

```text
PaintEditor onUpdateImage
        ↓
Scratch Paint Working Copy Adapter
        ↓
WorkspacePaintWorkingCopyModel.applyEdit(...)
```

and stop there.

WS-10A metadata transactions continue to use:

```text
Proposal → Review → Evidence → Project Command Host
```

but WS-10B local image content is not included in those metadata commits.

## Remount / minimize behavior

The Paint session owns the working copy, not the React canvas component. Therefore a Paint view remount can reconstruct backend input from the current working copy instead of rereading authoritative source and destroying unsaved local edits.

This preserves the Workspace rule:

```text
Tool session state
≠
Window runtime/presentation state
```

## DoD

- [x] distinct `resource-content-read#query` capability;
- [x] portable bounded image content facade;
- [x] canonical ResourceId required;
- [x] raw Scratch/backend objects excluded;
- [x] immutable source snapshot with source revision;
- [x] transient working-copy model;
- [x] dirty-state protection against silent Resource switching;
- [x] content-source staleness detection;
- [x] explicit reload/discard semantics;
- [x] SVG / PNG / JPG source support;
- [x] vector update → portable SVG working-copy edit;
- [x] bitmap update → PNG working-copy edit;
- [x] explicit lazy scratch-paint backend activation;
- [x] Paint session survives view remount independently of Window state;
- [x] no Project image-content mutation path activated;
- [x] no direct Resource mutate capability added to Paint;
- [x] production Webpack coverage for content/provider/adapter/UI path;
- [x] cumulative WS / architecture regression evidence;
- [x] WS-10B Certificate freeze.

## Explicit non-goals

WS-10B does not implement or certify:

- committing SVG/bitmap content to the Project;
- content replacement command schema;
- content impact preview / reviewed replacement transaction;
- Project persistence of dirty working-copy bytes;
- arbitrary filesystem image import/export;
- pixel-mode product completion;
- Terminal activation.

Those Project-content mutation semantics begin in WS-10C.
