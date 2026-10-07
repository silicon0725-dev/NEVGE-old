# WS-10｜High-Capability Tool Integration

**Status:** `CURRENT`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-9 | COMPLETE / CERTIFIED`  

## Goal

WS-10 moves from generic Workspace capability infrastructure to real high-capability tools. A tool may reuse mature OSS components, but all project/resource/host access must enter through the WS-9 Capability / Provider / Context / Transaction / Review contracts.

WS-10 does not reopen the generic authority model certified by WS-9.

## Rules

Every high-capability tool must:

```text
register ToolId / WindowId
        +
declare ecosystem manifest
        +
declare capability surfaces
        +
pass Capability Admission
        +
bind scoped Providers
        +
use canonical NGVGE identity
        +
route privileged mutation through review policy
```

A tool must not create a second window authority, mount an independent application into `document.body`, retain raw Scratch/renderer/backend handles as its semantic API, or bypass reviewed Project mutation.

## Planned sequence

### WS-10A｜Better Paint Tool Admission & Resource Editing Session Foundation

Activate `ngvge.tool.paint`, approve the OSS intake seam, create a capability-admitted Paint session, and prove a real Resource metadata edit through Proposal -> Review -> Evidence -> Project Transaction -> Rollback.

Pixel/SVG content mutation is explicitly out of scope.

### WS-10B｜Paint Content Read / Working Copy Adapter

**Status:** `COMPLETE / VERIFIED`

Introduce a portable bounded image-content read capability, immutable source snapshot, transient dirty/stale working-copy model and replaceable scratch-paint adapter. Backend edits remain local and do not commit Project image content.

### WS-10C｜Reviewed Resource Content Replace Transaction

**Status:** `COMPLETE / VERIFIED`

Add versioned Resource content replacement semantics with impact preview, review evidence, bounded payload rules, commit, undo/rollback, and compatibility adapters.

### WS-10D｜2D Art & Animation Semantic Freeze

**Status:** `COMPLETE / ARCHITECTURE FROZEN`

Freeze NGVGE-owned Vector / Animated Raster authoring semantics before production OSS backend intake. Stable Layer / Frame / Cel / linked content / Clip / Marker / Palette / Slice identity cannot be derived from SVG-Edit, miniPaint, Piskel or another backend. WS-10D performs no production Paint behavior switch.

### WS-10E｜Paint Backend Contract & OSS Intake

**Status:** `COMPLETE / VERIFIED`

Freeze `ngvge.paint-backend-contract@1`, portable backend transfer semantics and formal OSS Intake for SVG-Edit, miniPaint and Piskel. No candidate becomes production authority or dependency in this stage.

### WS-10F｜Vector Backend Integration

**Status:** `IMPLEMENTED / CONDITIONAL VERIFIED`

Integrate the approved SVG-Edit `@svgedit/svgcanvas@7.4.2` vector backend against canonical SVG working documents. NGVGE adapter/contract integration is implemented; promotion to `COMPLETE / VERIFIED` is blocked only on executing the real published package-byte production build gate in an environment that can install the dependency.

### WS-10F2｜Native Paint Surface Replacement

Use the existing native Costume / Backdrop editor host as the primary Better Paint presentation instead of treating Paint as a standalone Workspace app.

#### WS-10F2A｜Native Paint Host Migration

**Status:** `COMPLETE / VERIFIED`

Route native SVG costume/backdrop selection into the shared PaintSession and SVG-Edit backend through canonical Resource adoption. Raster remains on the legacy native Scratch Paint compatibility surface until WS-10G.

#### WS-10F2B｜Unified Paint Shell

**Status:** `COMPLETE / VERIFIED`

Freeze the NGVGE-owned native tool rail, context toolbar, canvas chrome, panel rail and status bar. The primary Vector presentation externalizes SVG-Edit controls into this shell; raster remains a compatibility passthrough until WS-10G.

#### WS-10F2C｜Vector Professional Tooling

Expose professional SVG selection/path/node/shape/text operations through NGVGE-owned UI contracts.

#### WS-10F2D｜Vector Properties / Layers / Align / Pathfinder

Add collapsible professional panels while preserving the native Costume / Backdrop host.

#### WS-10F2E｜Native Working Copy / Dirty / Review UX

Complete unsaved-switch/close semantics and native reviewed-save presentation.

#### WS-10F2F｜Standalone Paint Window Retirement

Retire the standalone Better Paint window from normal product navigation once the native surface covers its diagnostics and review responsibilities.

#### WS-10F2G｜Native Vector Replacement Certification

Certify the native Vector replacement before adding production raster/pixel backends.

### WS-10G｜Bitmap Backend Integration

Integrate the approved bitmap backend into the same native Costume / Backdrop Paint Surface against NGVGE raster working documents and Layer semantics.

### WS-10H｜Pixel Backend Integration

Integrate the approved pixel backend into the same native Paint Surface without adopting its private Frame/Layer IDs.

### WS-10I｜Unified Timeline / Animation Working Copy

Implement the NGVGE Layer × Frame × Cel timeline, Clip/Marker editing, onion-skin projection and preview against the frozen semantic contract.

### WS-10J｜Animation Resource Save / Export

Add reviewed structured animation persistence and derived PNG sequence / GIF / APNG / WebP / sprite-sheet / atlas export paths.

### WS-10K｜Better Paint UX / Session Persistence

Complete mode switching, dirty/unsaved UX, keyboard/focus behavior, workspace session persistence, preview and game-asset annotation workflows.

### WS-10L｜Better Paint Certification

Run Better Paint cumulative certification across all three backends, static and animated authoring, reviewed save, rollback, persistence and full production build evidence.

Terminal capability work moves to the next high-capability tool program after Better Paint certification instead of sharing Paint-specific semantic stages.

## Current resume point

```text
WS-9 COMPLETE / CERTIFIED
        |
        v
WS-10 CURRENT
        |
        +-- WS-10A COMPLETE / VERIFIED
        +-- WS-10B COMPLETE / VERIFIED
        +-- WS-10C COMPLETE / VERIFIED
        +-- WS-10D COMPLETE / ARCHITECTURE FROZEN
        +-- WS-10E COMPLETE / VERIFIED
        +-- WS-10F IMPLEMENTED / CONDITIONAL VERIFIED
        |     `-- real package-byte build gate PENDING; user browser runtime evidence exists
        +-- WS-10F2A COMPLETE / VERIFIED
        |     `-- native Costume / Backdrop host is now primary Vector presentation
        +-- WS-10F2B COMPLETE / VERIFIED
        |     `-- unified native Paint shell owns presentation chrome; backends are canvas engines
        +-- WS-10F2C..WS-10F2G NEXT / PLANNED
        +-- WS-10G..WS-10L PLANNED
```
