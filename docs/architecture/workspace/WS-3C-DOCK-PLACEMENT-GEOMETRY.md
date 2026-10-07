# WS-3C | Dock Placement & Geometry

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-13
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Workspace Parents:** WS-0 / WS-1 / WS-2 / WS-3A / WS-3B

## 1. Objective

Replace the WS-3B provisional bottom-center CSS placement with an explicit, portable Dock placement preference and geometry projection model without introducing Workspace persistence or a second Window authority.

## 2. Stable identities

```text
ngvge.workspace-dock-placement-model@1
ngvge.workspace-dock-placement-preference@1
```

The preference schema is versioned independently so WS-4 can compose it into the future WorkspacePreferencesSchema without redefining placement semantics.

## 3. Preference contract

```text
placement
├── top
├── bottom
├── left
└── right

alignment
├── start
├── center
└── end

offsetX
offsetY
```

Coordinate semantics are screen-relative and invariant across edges:

```text
+offsetX → move right
+offsetY → move down
```

Unknown fields fail closed. Scratch Targets, WindowIds, renderer handles, backend IDs, DOM nodes and other runtime/backend identities are not part of this schema.

## 4. Orientation projection

```text
top / bottom → horizontal
left / right → vertical
```

The Dock component consumes only the placement projection:

```text
DockPlacementModel
      ↓
placement / alignment / orientation / offsetX / offsetY
      ↓
data-* attributes + CSS variables
      ↓
WorkspaceDock presentation
```

The model owns no WindowManager operations and does not mutate open/close/minimize/restore/focus/z-order/geometry of Workspace windows.

## 5. Interaction adaptation

WS-3B interaction authority remains unchanged. Only presentation-sensitive keyboard reorder changes with orientation:

```text
horizontal → Alt + Left / Right
vertical   → Alt + Up / Down
```

Mouse drag reorder continues to mutate Dock ordering only.

## 6. Production integration

The custom Workspace creates one `DockPlacementModel` and passes it to `WorkspaceDock`.

The default preference preserves the verified WS-3B appearance:

```text
placement = bottom
alignment = center
offsetX = 0
offsetY = 0
```

The current stage deliberately provides no end-user Settings control. WS-4 will own persistence/settings integration.

## 7. Explicit non-goals

WS-3C does not implement:

- versioned Workspace persistence — WS-4;
- separator/folder/group presentation — WS-3D;
- Launchpad — WS-3E;
- minimize/restore animation — WS-3F;
- a second Window geometry authority;
- Scratch/backend-specific placement identity.

## 8. Certification result

WS-3C Machine Gate: **43/43 PASS**.
Focused tests: **13/13 PASS**.
WS-0 → WS-3C cumulative: **PASS**.
Real Dock production-entry Webpack: **0 errors / 0 warnings / PASS**.

See `WS-3C-VERIFICATION.md` and `WS-3C-CERTIFICATE.json` for the complete evidence record.
