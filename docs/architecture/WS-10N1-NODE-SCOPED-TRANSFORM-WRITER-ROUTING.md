# WS-10N1｜Node-scoped Transform Writer Routing

**Status:** IMPLEMENTED / MACHINE VERIFIED  
**Parent:** WS-10N0 Functional 2D Foundation Contract  
**Architecture Authority:** ARC-0001 + ARC-C001.1 + certified 0009 Transform2D chain

## 1. Purpose

WS-10N0 identified the first blocker for functional native nodes: the certified 0009 Transform2D command path assumed every editable Transform belonged to Scratch Compatibility Authority. That is correct for imported/native Scratch sprites, but it cannot make a pure NGVGE `Camera2D`, `TileMapLayer2D`, `Area2D`, or future native node functional because those nodes have no Scratch Target.

WS-10N1 introduces routing at the stable semantic `NodeId` boundary without weakening the existing global Authority Registry or changing the frozen Transform2D schema.

```text
Editor PatchComponent
        ↓
ngvge.transform2d-command
        ↓
Node-scoped Writer Router
        │
        ├─ Scratch binding exists
        │      ↓
        │  scratch.compat.transform
        │      ↓
        │  certified 0009-D bridge
        │
        └─ no Scratch binding exists
               ↓
          ngvge.native.transform
               ↓
          Transform2DRuntimeStore
               ↓ explicit commit
          Persistent Transform component
```

## 2. Stable routing key

The route is selected only from semantic node ownership:

```text
Routing key = NodeId
```

The following are explicitly forbidden as routing keys:

```text
Scratch targetRuntimeId
renderer Drawable/Skin identity
physics/backend handles
Editor widget identity
caller-selected authorityId
```

Scratch Target recreation therefore cannot change Transform writer ownership.

## 3. Scratch binding ownership is sticky

A node with a Scratch binding record remains Scratch-owned even when its current runtime target is `offline` or `missing`.

```text
BOUND   → Scratch writer
OFFLINE → Scratch writer
MISSING → Scratch writer
```

WS-10N1 deliberately does **not** fall back to the native writer when Scratch is temporarily unavailable. Doing so would turn a runtime disconnect into an implicit Authority Switch Transaction and could produce split-brain Transform state.

A true ownership migration is a later explicit operation and is outside WS-10N1.

## 4. Native Transform writer

The new native bridge is:

```text
ngvge.native.transform-command-bridge@1
```

Authority identity:

```text
ngvge.native.transform
```

It accepts the same Engine Protocol `PatchComponent` DTO used by 0009-D. It validates stable `NodeId` + exact Transform component identity, patches only the Transform runtime store, then commits the accepted Runtime Transform through the existing Runtime Node Model persistent mutation boundary.

Unlike Scratch Compatibility, native Transform accepts the full frozen Transform2D schema, including:

```text
scale = [scaleX, scaleY]
```

with non-uniform and negative values. Therefore XY Stretch is no longer a special extension for native nodes; it is normal Transform2D semantics.

## 5. Existing global Authority Registry remains unchanged

WS-10N1 does not silently register a second Writer in the frozen global `Transform2D` Authority Registry. The 0009 baseline still contains exactly one registered Writer:

```text
scratch.compat.transform
```

N1 adds a higher-level node-scoped command router for the mixed compatibility/native migration period. This preserves the already-certified single-writer registry invariant while allowing a pure NGVGE Node to become functional.

A future Authority Registry revision may model scoped authorities directly, but that is not required to unlock Camera/Collider/TileMap development.

## 6. 0009 compatibility preservation

The certified 0009-D Scratch bridge is unchanged and remains independently testable. Production Scene System wiring now composes it as one route behind the semantic `ngvge.transform2d-command` capability.

Therefore:

```text
Scratch-bound node
→ same setters
→ same Scratch clamp/acceptance semantics
→ same Scratch → NGVGE projection
→ same persistent commit
```

Non-uniform Scratch scale still fails closed because `.sb3`/Scratch `size` cannot represent it directly.

## 7. Scene System integration

Scene System now constructs:

```text
Scratch Transform Projection
Scratch Transform Command Bridge
Native Transform Command Bridge
        ↓
Transform2D Writer Router
        ↓
ngvge.transform2d-command capability
```

Disposal order revokes Router/bridges before the Transform Runtime Store.

## 8. What WS-10N1 does not do

WS-10N1 does not yet:

- create Camera2D/Collider2D/TileMap nodes in the UI;
- add native Node archetype creation workflow;
- implement Transform gizmos;
- implement an Authority Switch Transaction;
- change `.sb3` projection rules;
- define `.ne` file bytes;
- add Physics or Camera backends.

It only makes native Transform mutation legal and routable, which is the prerequisite for those stages.

## 9. Exit criteria

- [x] Native Transform Writer has stable authority identity.
- [x] Routing key is stable `NodeId`.
- [x] Scratch binding presence selects Scratch Writer.
- [x] Offline/missing Scratch Target cannot silently switch to Native Writer.
- [x] Unbound node selects Native Writer.
- [x] Native writer accepts full Transform2D scale `[x,y]` semantics.
- [x] Native editor writes commit through Runtime Node Model persistence.
- [x] Backend runtime handles do not enter results or persistent Transform data.
- [x] Existing 0009 Scratch bridge remains certified.
- [x] Existing global Transform Authority Registry remains unchanged.
- [x] Scene System publishes the same backend-independent Transform command capability.
- [x] Permanent regression coverage exists.

## 10. Next stage

`WS-10N2 | Functional Node Creation + Scratch Target Binding` can now use one Transform command API for both Scratch-backed Sprite nodes and pure native Node2D-derived nodes.
