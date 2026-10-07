# WS-10N5-HF1 | Collider2D Editor Visibility Verification

Status: `FROZEN / MACHINE VERIFIED / BROWSER VERIFIED`

## Machine evidence

```text
HF1 Conformance                         PASS 9/9
HF1 component + creation tests         PASS 2 suites / 11 tests
Inherited WS-10N5 focused              PASS 10 suites / 56 tests
ESLint correctness (changed JS/JSX)    PASS
```

## Browser acceptance

1. Create one Area2D without manually naming it. The Node Explorer and Collision2D menus should show `Area2D`, not a generic `Node2D`.
2. A visible dashed Rectangle 100x100 collider must appear on the Stage immediately in editor mode.
3. Create a second Area2D. Both colliders must remain visible; the selected one must be emphasized.
4. Change Shape between Rectangle/Circle/Capsule/Convex Polygon; the visible geometry must update immediately.
5. Change Transform2D position/rotation/non-uniform scale and Collider offset/local rotation; overlay must follow.
6. Activate Camera2D and test translate/rotation/zoom/non-uniform zoom; all collider overlays must remain aligned.
7. Deselect the Area2D or select another non-collider Node. Existing active collider geometry must remain visible in the editor.
8. Full-screen/player-only modes must not expose editor collision gizmos.
9. Scratch native `touching?` remains unchanged.

Browser acceptance was completed before the explicit WS-10N6 transition; N5/HF1 is frozen.
