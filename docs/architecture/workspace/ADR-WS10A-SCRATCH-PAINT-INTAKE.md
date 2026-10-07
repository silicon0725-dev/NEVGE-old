# ADR-WS10A｜scratch-paint OSS Intake

**ADR ID:** `ADR-WS10A-SCRATCH-PAINT-INTAKE`  
**Status:** `APPROVED`  
**Stage:** `WS-10A | Better Paint Tool Admission & Resource Editing Session Foundation`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-9 | Workspace Tool Capability Host & Reviewed Mutation Foundation`  

## Decision

NGVGE may reuse the already-present `scratch-paint@2.1.61` package as the Better Paint visual editing backend / UI component, but the package is not promoted to NGVGE semantic authority.

Package metadata observed in the current source tree:

```text
package: scratch-paint@2.1.61
license: GPL-3.0
repository: https://github.com/02engine/scratch-paint.git
```

The OSS intake is approved only behind an explicit NGVGE adapter seam.

## Semantic responsibility

`scratch-paint` may own transient paint-editor concerns such as:

- drawing interaction state;
- paint canvas presentation;
- vector/bitmap editing helpers;
- transient selection and tool state inside the paint surface.

It must not own:

- `ToolId` or `WindowId` identity;
- canonical `ResourceId` identity;
- Workspace Context authority;
- Project transaction identity;
- Project / Resource mutation authority;
- NGVGE persistence identity;
- capability admission or permission policy;
- reviewed mutation semantics;
- backend-independent serialization protocol.

## Authority boundary

The new Workspace Better Paint tool must not receive raw:

```text
Scratch VM
Scratch Target
costume object
renderer object
skin handle
backend/private handle
```

WS-10A therefore does not call `vm.updateSvg`, `vm.updateBitmap`, `vm.renameCostume`, or equivalent Scratch setters from the new Workspace Paint runtime.

Metadata mutation currently travels through:

```text
Better Paint Tool
  -> WS-9 Capability Admission
  -> Resource read facade
  -> Project command proposal
  -> Transaction review
  -> Review evidence
  -> Project transaction
  -> existing Resource authority
```

## Backend seam

The intended Backend seam is:

```text
WorkspacePaintSession
        |
        +-- Resource / Project capability facades
        |
        +-- PaintContentAdapter              [WS-10B+]
                |
                +-- scratch-paint@2.1.61
                |
                +-- portable working copy / content output
                        |
                        +-- reviewed NGVGE Project transaction
```

WS-10A establishes the session and authority boundary but intentionally does not mount `scratch-paint` as a direct content writer. The content adapter is a later stage because binary/SVG replacement requires its own versioned Resource command semantics and rollback policy.

## Maintenance and footprint

`scratch-paint` is already an existing dependency of the 02Engine-derived GUI and therefore WS-10A does not introduce a new package family into the bundle. The new Workspace integration must not broaden the fork contract beyond an adapter that NGVGE can replace.

The full paint backend should be mounted only when the Better Paint tool needs its editing surface; WS-10A itself uses the reviewed session shell and does not require the backend to become a new global runtime singleton.

## Browser / desktop support

The selected backend is already used by the browser-integrated Scratch GUI path in the current project. Desktop packaging may continue to consume it through the same front-end dependency, subject to the NGVGE adapter boundary and the package license obligations.

## Migration / escape plan

NGVGE must be able to replace `scratch-paint` with another bitmap/vector/pixel editor without changing:

- `ngvge.tool.paint`;
- Paint `WindowId`;
- canonical `ResourceId`;
- Paint capability descriptor;
- Project command / review contracts;
- Workspace persistence scope;
- Tool admission semantics.

Only `PaintContentAdapter` and backend-specific presentation code may require replacement.

## Rejected alternative

Rejected:

```text
Workspace Paint
  -> import Scratch VM
  -> vm.updateSvg / vm.updateBitmap / renameCostume
```

That path would make a compatibility backend own the new Workspace mutation contract and would violate ARC-0001 and WS-9I reviewed mutation policy.

## Approval scope

This ADR approves `scratch-paint@2.1.61` for the Better Paint backend seam only. It does not certify pixel/SVG content replacement, image import/export, arbitrary filesystem access, or direct Scratch costume mutation. Those capabilities require later WS-10 stages and their own conformance evidence.
