# WS-10N8-HF14.1｜Real Rapier API Compatibility / Green-Flag Runtime Start Fix

## Status

`IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED`

## Incident

HF14 correctly introduced native Rapier Cuboid/Ball/Capsule descriptors, but the primitive collider descriptor translation used the runtime Collider API shape (`setTranslation({x,y})`) instead of the Rapier `ColliderDesc` builder signature (`setTranslation(x, y)`).

With the real `@dimforge/rapier2d-compat 0.19.3`, this throws `The translation components must be numbers.` during the first Physics2D descriptor sync after project start. Runtime Phase Scheduler isolates frame-phase exceptions, so the browser symptom can be a silent green-flag simulation stall rather than a visible crash.

## Fix

- Native primitive collider descriptor offsets now call `ColliderDesc.setTranslation(x, y)` with two finite numbers.
- Shape-Aware mapping remains unchanged: Rectangle→Cuboid, Circle→Ball, Capsule→Capsule, unsafe/non-primitive geometry→ConvexHull.
- CharacterController Rapier shape-query adoption remains unchanged.
- The fake Rapier test backend now rejects invalid ColliderDesc translation signatures instead of accepting arbitrary arguments.
- A real Rapier compatibility unit test initializes the installed 0.19.3 dependency, creates an offset native Circle collider, syncs it into a world, steps gravity, and verifies that the dynamic body moves.

No NGVGE schema, authority, persistence, Transform2D, collision-filter, or project semantics change.
