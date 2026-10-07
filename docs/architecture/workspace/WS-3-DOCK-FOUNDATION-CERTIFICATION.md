# WS-3 | Dock Foundation Certification

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-14
**Architecture Parent:** ARC-0001 | Kernel Independence Contract

WS-3 is complete only as the cumulative result of:

```text
WS-3A Dock Runtime Model
WS-3B Basic Interaction
WS-3C Placement & Geometry
WS-3D Organization
WS-3E Launchpad
WS-3F Minimize / Restore Animation
```

The machine DoD validates all Handoff requirements:

1. Dock does not copy Window semantic state.
2. ToolId and WindowId remain distinct.
3. pinned/running/minimized/active projections are correct.
4. top/bottom/left/right placement exists.
5. alignment + offsetX/Y exist.
6. drag reorder exists.
7. separator exists.
8. folder/group organization exists.
9. Launchpad exists and is ToolRegistry-backed.
10. multi-instance Tool projection preserves Window instances.
11. Dock icons remain SVG-only.
12. minimize/restore animation is Presentation, never state authority.
13. keyboard/focus accessibility remains intact.
14. Classic/compatibility UI remains outside the Dock semantic model.

Machine result:

```text
WS-3 Dock Foundation DoD PASS (14/14)
```

WS-3 does not include Workspace persistence/settings. Runtime Dock placement, organization, pin/order state and presentation transition state remain non-persistent until WS-4 defines the versioned Workspace persistence contract.
