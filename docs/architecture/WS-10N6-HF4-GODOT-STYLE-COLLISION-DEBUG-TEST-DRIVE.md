# WS-10N6-HF4 | Godot-style Collision Debug + Character Test Drive

Status: IMPLEMENTED / MACHINE VERIFIED / PRODUCTION NODE-EXPLORER WEBPACK PASS / FULL EDITOR WEBPACK INCONCLUSIVE / BROWSER EVIDENCE PENDING
Parent: `WS-10N6 | CharacterBody2D / CharacterController2D`

## Purpose

HF4 closes a browser-verification usability gap: Collider2D and CharacterController2D existed semantically, but the editor did not make collision authoring/testing obvious enough.

The UX is informed by Godot's split between editable collision shapes and a scene-wide "visible collision shapes" debug switch, plus Godot CharacterBody2D's kinematic movement model. NGVGE keeps its existing Component/Capability architecture; it does not copy Godot's class hierarchy or make a backend object authoritative.

## Collision-shape authoring visibility

Selected Collider2D geometry is treated as an editor authoring shape and stays visible even when scene-wide debug shapes are Off. An explicit per-node `Hidden` preference can still suppress it.

Scene-wide editor debug modes are:

```text
All
Selected
Off
```

The Stage exposes a direct `Collision Shapes` control, and the Inspector exposes the same global policy alongside the per-node Gizmo override.

Visible Collider2D geometry now projects:

- outline/fill;
- selected shape handles and center mark;
- node label for the selected shape;
- overlap state (`COLLISION`) directly on the Stage.

All of this is editor-only visualization. Collision queries remain owned by Collider2D Runtime Service.

## CharacterBody2D test drive

CharacterBody2D remains kinematic. HF4 does not invent Rigidbody2D mass/force/gravity persistence.

To make N6 browser verification practical, the Inspector now provides an editor-only Test Drive:

```text
Platformer
- A/D or Left/Right
- Space jump
- preview gravity

Top-down
- WASD / Arrow keys
- no gravity
```

The preview uses the existing CharacterController2D runtime capability:

```text
setVelocity()
moveUsingVelocity(1/60)
→ moveAndSlide()
→ Collider2D solver
```

Preview speed/gravity/jump settings are stored in an editor-only runtime service and never enter `.ne`, CharacterController2D component data, or Scratch compatibility state.

`Start Test` resets runtime state to the authored Transform before beginning. `Pause` preserves the current runtime pose for inspection. `Reset` stops the preview and restores the authored Transform.

## Fixed preview scheduler

The Test Drive host uses a bounded editor-only fixed step:

```text
60 Hz
max frame contribution = 0.25 s
max catch-up steps = 8
```

This is a verification harness, not the future project-wide Physics2D Scheduler contract. N8 may replace or generalize scheduling without changing Character/Collider semantic identity.

## Deferred

Still deferred to later Physics2D/controller work:

- Rigidbody2D dynamic simulation;
- force/impulse/mass/friction/restitution;
- Rapier2D/Box2D backend handles;
- project-wide physics tick settings;
- one-way platform authoring;
- dynamic-body push response.
