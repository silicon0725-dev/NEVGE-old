# WS-10N6-HF2 | Inspector Authoring Unification Verification

Status: MACHINE VERIFIED / BROWSER EVIDENCE PENDING

## Browser Gate

1. Select a Scratch-bound Sprite in Node Explorer. `Runtime Node`, `Transform2D`, and `Sprite Appearance` should be expanded by default.
2. Change Transform2D X and Y in Inspector. The sprite must move immediately on Stage.
3. Change Transform2D Rotation. The sprite must rotate immediately.
4. Change uniform Scale for the Scratch-bound Sprite. The Scratch target size projection must update; Inspector must identify the authority as `Scratch Compatibility`.
5. Confirm X/Y/Rotation/Scale edits do not use the legacy target-property path as a second Transform writer.
6. Toggle `Visible`, `Rotation Style`, and `Draggable` in `Sprite Appearance`; these remain explicit Scratch compatibility properties.
7. Select a native Node2D and confirm X/Y/Rotation plus independent Scale X / Scale Y remain editable under `NGVGE Native` authority.
8. Select Area2D / StaticBody2D / CharacterBody2D. `Collider2D` should be expanded by default.
9. Switch Shape among Rectangle, Circle, Capsule and Convex Polygon. Stage collider geometry must update live.
10. Edit shape geometry, Offset, Local Rotation, Layer, Mask, Sensor and Scale Policy; Stage/query behavior must update consistently.
11. Set Collider Gizmo to `Hidden`; only that collider must disappear from the editor overlay without changing overlap/query results.
12. Set it to `Selected Only`; it must appear only while that node is selected.
13. Set it to `Always`; it must remain visible even when another node is selected.
14. Set it back to `Inherit Editor`; scene-wide baseline visualization must resume.
15. Camera2D translate/rotate/non-uniform zoom must preserve collider gizmo alignment.
16. CharacterController2D Runtime Debug values must remain read-only; authoring fields remain editable.
17. Stop/Restart must clear runtime-only controller state while authored Transform/Collider/Controller configuration remains.
18. Full-screen/player-only modes must not expose editor collider gizmos.

## Result

Browser evidence has not yet been supplied in this source snapshot. Do not Freeze WS-10N6-HF2 until the checks above pass in the real editor.
