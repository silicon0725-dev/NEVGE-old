# WS-10N2 Verification

**Stage:** Functional Node Creation + Scratch Target Binding  
**Status:** IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING

## Stage-specific machine evidence

```text
npm run test:node-plan:ws10n2:focused
```

Covers:

- inherited WS-10N0 and WS-10N1 gates;
- 20-point N2 conformance gate;
- Node2D creation-plan provisioning of `ngvge.transform2d@1`;
- Sprite2D availability only with Scratch compatibility lifecycle support;
- planned Camera/Collider/Character/TileMap archetypes remaining hidden;
- functional creation service runtime-type filtering;
- Scratch target creation followed by stable binding and semantic Transform provisioning;
- rollback of a newly-created Scratch target when semantic component provisioning fails;
- native Inspector independent Scale X / Scale Y;
- Scratch-backed Inspector uniform Scale;
- Node Explorer archetype-to-runtime creation projection;
- extension/runtime node entries retained alongside core archetypes.

Permanent regression adds:

```text
functional-node-creation
```

and permanently checks the native Node2D / Scratch Sprite2D creation seam and backend-identity exclusion.

## Production build gate

```text
npm run test:node-plan:ws10n2:webpack
```

This runs the N2 machine gate plus the existing WS-5 Node Explorer and editor webpack entries.

## Browser acceptance required

Browser verification must perform all of the following in the real editor:

1. Enter an active Scene and open `+ Add Scene Node`.
2. Confirm exactly one `Node2D` authoring entry appears.
3. Create Node2D and confirm no new Scratch Sprite/Target is created.
4. Select Node2D and confirm Inspector shows Position X/Y, Rotation, Scale X, Scale Y and `Authority = NGVGE Native`.
5. Set non-uniform scale such as X=2, Y=0.5 and confirm it remains authoritative after selection changes.
6. Confirm `Sprite2D` appears when Scratch compatibility is active.
7. Create Sprite2D and confirm a real Scratch target is created and one stable semantic Runtime Node/binding represents it.
8. Confirm Sprite2D owns a Transform2D component and Inspector reports `Authority = Scratch Compatibility` with uniform Scale.
9. Confirm Camera2D, Area2D, CharacterBody2D and TileMapLayer2D are **not** surfaced yet.
10. Register/use an existing extension-provided Runtime Node type and confirm it remains available in the creation dialog.

Until this browser evidence passes, record N2 as `BROWSER EVIDENCE PENDING`, not COMPLETE/VERIFIED.
