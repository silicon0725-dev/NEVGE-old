# WS-10A｜Better Paint Tool Admission & Resource Editing Session Foundation

**Status:** `COMPLETE / VERIFIED`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-9 | COMPLETE / CERTIFIED`  
**OSS Intake:** `ADR-WS10A-SCRATCH-PAINT-INTAKE | APPROVED`

## Objective

Establish Better Paint as the first real high-capability Workspace tool without bypassing the WS-9 authority model.

WS-10A proves that an active resource-editing tool can:

1. enter through ToolRegistry / WindowManager;
2. acquire only declared capability surfaces;
3. consume the selected canonical image `ResourceId`;
4. query a portable Resource descriptor;
5. prepare a Project-scoped metadata change;
6. Review the proposal;
7. obtain fresh mutation evidence;
8. Commit through the Project Command Host;
9. Review and Rollback through the same policy boundary.

## Stable identities

```text
ToolId
ngvge.tool.paint

WindowId
paint

Session
ngvge.workspace-paint-tool-session@1

Backend adapter seam
ngvge.workspace-paint-backend.scratch-paint@1

Backend package
scratch-paint@2.1.61
```

## Ecosystem admission

Better Paint is an `ACTIVE` OSS-wrapped Workspace tool with Project-command authority.

Required services:

```text
Window Manager
Workspace Context
Tool Persistence
Project Lifecycle
Resource Manager
```

Declared capability surfaces:

```text
context-read#query
resource-read#query
project-command#propose
project-command#mutate
```

Not declared:

```text
resource-command#mutate
filesystem
process execution
network
credentials
raw Scratch VM / renderer access
```

## Resource editing session

WS-10A intentionally starts with canonical Resource metadata rather than image-content replacement.

Current supported change:

```text
ResourceId-addressed image rename
```

The mutation path is:

```text
Paint draft
  -> project-command#propose
  -> resource.rename command
  -> proposal review
  -> prepareMutationReview()
  -> fresh Review Evidence
  -> project-command#mutate
  -> Project Command Host
  -> Resource authority
```

Rollback path:

```text
committed transaction
  -> transaction review
  -> prepareRollbackReview()
  -> fresh rollback evidence
  -> Project Command Host rollback
```

The Paint session cannot call the Resource writer directly.

## Backend isolation

The repository already contains the legacy Scratch paint integration, which may call Scratch VM costume setters. That legacy compatibility path is not the WS-10A authority path.

The new Workspace Paint runtime does not call:

```text
vm.updateSvg
vm.updateBitmap
vm.renameCostume
Scratch Target mutation
renderer mutation
```

`scratch-paint` remains a candidate editing backend behind `PaintContentAdapter`; content mutation is deferred to WS-10B/WS-10C.

## Window / Dock integration

Paint is registered as a managed singleton Workspace tool. Window visibility, position, size, z-order, minimize/restore and Dock projection remain owned by the existing WindowManager / Dock model.

The Paint view does not mount its own `DraggableWindow`, use `document.body`, or create independent browser persistence.

## UI scope

WS-10A exposes a compact Better Paint shell that makes the reviewed mutation workflow visible:

```text
selected image Resource
ResourceId / format / reference metadata
editable Resource name draft
Review Changes
Commit Reviewed
Review & Rollback
review diagnostics / error surface
```

The actual vector/bitmap editor canvas is deliberately not claimed as complete in this stage.

## DoD

- [x] stable Paint ToolId and WindowId;
- [x] ToolRegistry / WindowManager / Dock / Launchpad integration;
- [x] approved `scratch-paint` OSS intake;
- [x] Paint ecosystem manifest ACTIVE;
- [x] capability descriptor uses Context + Resource query + Project propose/mutate;
- [x] no Resource direct-mutate capability;
- [x] stable Paint session / backend seam identities;
- [x] canonical ResourceId selection;
- [x] portable Resource query;
- [x] Proposal -> Review -> Evidence -> Commit path;
- [x] fresh Review -> Rollback path;
- [x] no new raw VM/renderer/Target authority;
- [x] SVG-only Dock / Launchpad icon;
- [x] Terminal remains PLANNED;
- [x] cumulative verification and production Webpack evidence;
- [x] WS-10A Certificate freeze.

## Explicit non-goals

WS-10A does not implement or certify:

- SVG path/content replacement;
- bitmap pixel replacement;
- pixel editor mode;
- direct costume mutation;
- arbitrary asset import/export;
- filesystem access;
- image content transaction schema;
- Terminal activation.
