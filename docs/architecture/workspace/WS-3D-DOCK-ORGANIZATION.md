# WS-3D | Dock Organization

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-13
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Workspace Parents:** WS-0 / WS-1 / WS-2 / WS-3A / WS-3B / WS-3C

## 1. Objective

WS-3D turns the WS-3A organization metadata seam into a real Dock topology and interaction surface:

```text
separator
group
folder
custom organization
```

The fundamental identity rule remains unchanged:

```text
Folder / Group / Separator
        ≠
ToolId / WindowId
```

Organization nodes reference stable ToolIds. They never replace, namespace, mutate or derive new ToolIds.

## 2. Stable identities

```text
ngvge.workspace-dock-organization-model@1
ngvge.workspace-dock-organization-preference@1
```

Organization node identities are Dock-owned metadata identities:

```text
ngvge.dock.group.*
ngvge.dock.folder.*
ngvge.dock.separator.*
```

They are not ToolRegistry identities and cannot be used as WindowIds.

## 3. Preference v1

```text
DockOrganizationPreference
├── schemaVersion = 1
├── containers[]
│   ├── id
│   ├── kind = group | folder
│   ├── label
│   └── toolIds[]
└── separators[]
    ├── id
    └── beforeToolId | null
```

Rules:

1. every referenced ToolId must exist in the Workspace Tool Registry;
2. one ToolId may belong to at most one Group/Folder;
3. Group/Folder identities are independent from ToolId;
4. one separator may occupy a given anchor;
5. unknown fields fail closed;
6. backend handles, Scratch Target identity, renderer identity and Window runtime authority are excluded.

## 4. Authority split

### DockRuntimeModel continues to own

- pinned ToolIds;
- global Dock Tool order;
- Tool/Window runtime projection;
- the existing per-Tool `groupId/folderId` compatibility seam.

### DockOrganizationModel owns

- Group/Folder topology;
- Separator topology;
- Group/Folder labels;
- Tool membership in one organization container;
- runtime-only Folder expanded/collapsed state;
- organization presentation projection.

### WindowManager continues to own

- open / close;
- minimize / restore;
- activate / focus;
- maximize;
- position / size;
- z-index and Window runtime authority.

WS-3D does not call WindowManager mutation APIs.

## 5. Organization projection

The presentation path is:

```text
DockRuntimeModel.listItems()
        +
DockOrganizationPreference
        ↓
DockOrganizationModel.project(items)
        ↓
Tool / Separator / Group / Folder nodes
        ↓
WorkspaceDock
```

Groups remain flat labeled containers.

Folders render as a compact aggregate Dock item and expose their member ToolItems when expanded. Aggregate `running/minimized/active` state is derived from member DockItems rather than copied from WindowManager.

Separators are presentation-only boundaries anchored before a stable ToolId.

## 6. User interaction

A Tool organization menu is available through:

```text
right click
or
Shift + F10
```

It supports:

- create Group from Tool;
- create Folder from Tool;
- insert/remove Separator before Tool;
- move Tool to an existing Group/Folder;
- remove Tool from its current container;
- dissolve a Group/Folder.

The model also exposes `renameContainer()` for later Workspace Settings/management UI without changing Tool identity.

Drag behavior remains authority-safe:

```text
single Tool drag
→ Dock order only

single Tool drop on Group/Folder container
→ membership + Dock order

whole Group/Folder drag
→ Dock global Tool order block move
```

No Window geometry/focus authority is duplicated.

## 7. Runtime-only boundary

WS-3D introduces no persistence writer.

```text
localStorage      NONE
sessionStorage    NONE
windowStateStorage NONE
```

The organization preference schema is intentionally versioned now so WS-4 can persist it later without redefining WS-3D semantics.

Folder `expanded/collapsed` state is deliberately excluded from preference v1 and remains transient UI state.

## 8. Placement compatibility

WS-3C remains the only Dock placement/geometry source.

Groups, Folders, Separators and Folder popovers adapt to the same projected orientation and edge placement:

```text
top / bottom → horizontal
left / right → vertical
```

WS-3D does not introduce a second placement contract.

## 9. Explicit non-goals

WS-3D does not implement:

- Launchpad — WS-3E;
- minimize/restore animation — WS-3F;
- Workspace persistence/settings — WS-4;
- nested Group/Folder hierarchy;
- backend-specific Tool organization;
- a replacement Tool Registry or Window Manager.

## 10. Verification

- Machine Gate: **45/45 PASS**
- Focused Jest: **16/16 PASS**
- WS-0 → WS-3D cumulative: **PASS**
- Legacy containment / Project lifecycle / Extension / Collaboration gates: **PASS**
- 0009-E: **12/12 PASS**
- Permanent Regression: **19/19 PASS**
- Unit: **604 tests PASS**
- Integration: **5/5 PASS**
- Smoke: **1/1 PASS**
- TypeScript: **PASS**
- ESLint correctness: **PASS**
- real Dock production Webpack: **0 errors / 0 warnings / PASS**
- real full Editor Webpack: **0 errors / 0 warnings / PASS**

See `WS-3D-VERIFICATION.md` and `WS-3D-CERTIFICATE.json` for the evidence record.
