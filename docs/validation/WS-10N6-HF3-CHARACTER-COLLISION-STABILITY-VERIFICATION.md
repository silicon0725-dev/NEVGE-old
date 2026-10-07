# WS-10N6-HF3 | Character Collision Stability Foundation Verification

Status: MACHINE VERIFIED / BROWSER EVIDENCE PENDING

## Scope

HF3 hardens CharacterBody2D without introducing Rigidbody/Physics2D backend authority.

- Contact slop prevents sub-epsilon resting penetration from becoming a blocking collision.
- `safeMargin` remains the authored separation policy; runtime contact slop is an implementation tolerance.
- CharacterController2D keeps a runtime-only last safe Transform/world anchor.
- Invalid runtime placement may recover to the last still-legal anchor; recovery never persists into `.ne`.
- Floor/wall selection prefers the strongest semantic surface while adding a small previous-contact stability bias.
- The selected CharacterBody2D receives editor-only velocity/contact-normal/last-safe diagnostics.

The design is informed by the user-provided UTBattleBox V22.2 reference implementation's contact slop,
last-legal anchor, stable surface probing and runtime debug vectors. NGVGE keeps its own NodeId/ComponentId,
Transform2D writer routing, Collider2D authority and backend isolation.

## Browser Gate

1. Place CharacterBody2D on a StaticBody2D floor and repeatedly call `move and slide` with downward velocity. The body must rest without visible vertical jitter.
2. Move away from a touching floor/wall. A tiny resting contact must not be reported as a new blocking collision.
3. Traverse a floor seam/corner made from two StaticBody2D colliders. Floor Normal / Floor Node should remain stable instead of alternating unnecessarily.
4. Slide along a wall/corner and confirm Wall Normal remains stable while the same wall remains the dominant contact.
5. Select CharacterBody2D. Stage debug should show the selected body origin and, when non-zero, the velocity vector.
6. While grounded, Stage debug should show Floor Normal. While on a wall, it should show Wall Normal.
7. After at least one legal Character move, Stage debug should show the last-safe anchor cross.
8. In Inspector Runtime Debug, `Last Safe X/Y`, `Recovery`, `Recoveries`, `Stable Floor`, and `Stable Wall` must be read-only.
9. Force an invalid runtime placement by moving/authoring the Character into a solid after a legal movement. The next Character solver call should restore the last legal runtime position when that anchor is still valid.
10. When recovery happens, runtime velocity/contact state must clear and `Recovery` should report `restored-last-safe`.
11. If the saved anchor is no longer legal because the surrounding solid geometry moved onto it, recovery must not teleport into another invalid placement.
12. Camera2D translation/rotation/non-uniform zoom must keep velocity/normal/anchor diagnostics aligned with the same world coordinates.
13. Parent Transform2D movement/rotation/non-uniform scale must preserve Collider/Character world-space consistency from HF1.
14. Scratch `touching?` remains unchanged; Character stability/recovery belongs only to NGVGE Collider2D/CharacterController2D.
15. Stop/Restart must discard last-safe/recovery/contact runtime state and restore authored Transform2D.
16. Full-screen/player-only mode must not expose Character editor diagnostics.

## Result

Browser evidence has not yet been supplied in this source snapshot. Do not Freeze WS-10N6-HF3 until the checks above pass in the real editor.
