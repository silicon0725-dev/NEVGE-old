# WS-10N6-HF3 | Character Collision Stability Foundation

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING
Parent: `WS-10N6 | CharacterBody2D / CharacterController2D`

## Purpose

HF3 hardens the native kinematic controller after the first browser-facing CharacterBody2D implementation. It is informed by the user-provided `UTBattleBox V22.2` collision/controller implementation, especially its contact slop, last-legal anchor, surface-normal stability and runtime diagnostics.

The reference implementation is not promoted into NGVGE authority. SDF/CSG battle-region semantics, Scratch target identity, BattleBox object records and its fixed controller policies remain outside the NGVGE core model.

## Stable separation

`safeMargin` remains CharacterController2D authored data. HF3 adds a small runtime `CONTACT_SLOP` tolerance so a sub-epsilon resting penetration does not become a new blocking initial overlap.

```text
authored safeMargin
        +
runtime contact slop
        ↓
stable separation at impact
```

Contact slop is an implementation tolerance, not persistent project identity.

## Last-safe recovery

Character runtime state now tracks:

```text
lastSafeTransform
lastSafeWorldOrigin
recoveryStatus
recoveryCount
```

Before a solver move, the current placement is captured only when it is legal against active solid Collider2D geometry. After movement, the placement is checked again. If external mutation or a solver edge case leaves the Character penetrating solid geometry, the runtime may restore the last-safe Transform only when that anchor is still legal.

Recovery clears runtime velocity/contact state and never writes recovery metadata into Persistent Project Model.

## Stable surface selection

When multiple collision contacts are produced during one move/slide sequence, floor and wall selection no longer depend on incidental "last collision wins" ordering.

The selected semantic contact prefers:

```text
surface alignment
+
small same-Node stability bonus
+
small previous-normal stability bonus
```

The bias is deliberately small: a geometrically stronger floor/wall contact still wins. Stable NodeId is used only as semantic contact identity; backend handles are not introduced.

## Editor diagnostics

For the selected CharacterBody2D, the Stage may project editor-only diagnostics:

- current origin
- velocity vector
- floor normal
- wall normal
- last-safe anchor

Inspector Runtime Debug also exposes last-safe coordinates, recovery state/count, and stable floor/wall NodeIds as read-only values.

These diagnostics are projections of runtime state and do not become scene/component persistence.

## Deferred work

HF3 does not add:

- Rigidbody mass/forces/friction/restitution
- Rapier2D/Box2D handles
- SDF/CSG as Collider2D canonical storage
- project-wide fixed Physics2D scheduler policy
- one-way platform policy
- full angular/scaled moving-platform carry

Those remain future Physics2D / controller-policy work.
