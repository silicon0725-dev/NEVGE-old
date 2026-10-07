# 0009-C｜Scratch Compatibility Transform Projection

**Milestone:** 0009 Transform System  
**Status:** Complete / Gate Active  
**Date:** 2026-08-12  
**Authority:** ARC-0001 + ARC-C001.1-H certified entry baseline + 0009-A/B

## Purpose

0009-C makes Scratch Compatibility Authority operational for Transform2D. Live Scratch sprite transform state is projected into NGVGE Runtime Transform state while semantic ownership remains the stable NGVGE `NodeId`.

This stage is intentionally one-way:

```text
Scratch Target Authority
x / y / direction / size
        ↓
Scratch Compatibility Projection
        ↓
NGVGE Transform2D Runtime Store
        ↓
Semantic NodeId ownership
```

0009-C does **not** implement Editor → Scratch mutation. That compatibility Writer bridge is 0009-D.

## Authority and direction

The active 0009-A Authority vocabulary remains unchanged:

```text
State Domain: Transform2D
Writer:       scratch.compat.transform
Projection:   ngvge.semantic.transform
Direction:    Scratch → NGVGE
```

The Scratch projection service cannot call Scratch `setXY`, `setDirection`, or `setSize`. Its role is observation/projection only.

## Scratch → NGVGE transform mapping

Scratch Target representation is converted at the adapter boundary:

```text
Scratch x/y
    → NGVGE position [x, y]

Scratch direction
    → wrap180(90 - direction)
    → NGVGE Cartesian rotation degrees
      zero = +X/right
      positive = counter-clockwise

Scratch size (%)
    → size / 100
    → NGVGE uniform scale [s, s]
```

Examples:

```text
Scratch direction  90  → NGVGE rotation    0
Scratch direction   0  → NGVGE rotation   90
Scratch direction -90  → NGVGE rotation -180
Scratch direction 180  → NGVGE rotation  -90
```

Scratch `rotationStyle` is deliberately excluded. It is a Scratch rendering behavior, not Transform2D semantic state. A future Sprite Renderer / compatibility render component may represent that behavior independently.

## Persistent bootstrap versus runtime projection

0009-C freezes two distinct write paths.

### Explicit bootstrap

When a Scratch-bound semantic Node has no Transform2D component yet:

```text
Scratch Authority snapshot
        ↓ explicit bootstrap
Persistent Transform component
        ↓
Runtime Transform
```

This is a structural/project mutation and is allowed only at a bootstrap/reconciliation boundary.

### High-frequency runtime projection

After bootstrap:

```text
Scratch Target changes
        ↓ AFTER_EXECUTE / TARGETS_UPDATE
Runtime Transform Store
```

This path does **not**:

- mutate Runtime Component `data`;
- mutate Runtime Node persistent export state;
- write Scene/project source;
- store Scratch Target runtime identity;
- touch renderer private state.

The conformance gate runs repeated live projections and verifies byte-equivalent JSON semantics for Persistent state before and after the high-frequency sequence.

## Explicit persistence commit

Scratch remains the Writer Authority, so the latest authoritative Runtime Transform must still be capturable at a deliberate persistence boundary.

0009-C therefore adds an explicit commit operation:

```text
Scratch Authority
        ↓ latest runtime projection
Runtime Transform
        ↓ explicit commit boundary
Persistent Transform component.data
```

The commit path is never called by the high-frequency projection loop. It exists for save/snapshot integration and later 0009 stages.

## Runtime Node Model integration

0009-B originally established the Runtime Store against `RuntimeNodeGraph`. 0009-C adds a controlled adapter for the public Runtime Node Model + Runtime Node Type Registration capabilities so the Transform subsystem can run inside the actual Scene System module without exposing the private Runtime Node Graph.

The Scene System now creates:

```text
Runtime Node Model
        ↓
Transform2DRuntimeStore
        ↓
ngvge.transform2d-runtime capability
```

The published Runtime Transform capability is query/observation oriented. It deliberately does not expose unrestricted `patchRuntimeTransform()` or Scratch write-back operations.

## Scene System lifecycle integration

When Scene System completes enable:

```text
Scratch Sprite Adapter
        ↓
Transform Runtime Store
        ↓
Transform Runtime Capability
        ↓
Scratch Transform Projection
        ↓ start tracking
```

Disposal happens in reverse dependency order before Runtime Node Model teardown.

The projection listens to Scratch runtime transform-relevant execution/update boundaries and to Scratch binding reconciliation. Binding reconciliation may schedule a bootstrap for newly-created semantic nodes; normal frame projection remains runtime-only.

## Stable identity and target recreation

Scratch Target runtime IDs remain volatile compatibility identifiers. If Scratch recreates a target:

```text
old targetRuntimeId
        ↓ disappears
same BindingId
same NodeId
same Transform component identity
        ↓
new targetRuntimeId
```

The Runtime Transform is projected from the new target into the same semantic Node. No Scratch runtime ID enters Transform persistence.

## Backend isolation

The 0009-C adapter may read these Scratch semantic compatibility fields:

```text
x
y
direction
size
```

It must not depend on:

- `scratch-render` imports;
- `_allDrawables` / `_allSkins`;
- `_drawThese`;
- BitmapSkin / Drawable instances;
- WebGL/GPU handles;
- renderer-private transform state.

`src/lib/transform-system` itself remains Scratch-free. Scratch knowledge exists only in the compatibility adapter.

## Stage exit criteria

```text
[x] Scratch x/y/direction/size project into NGVGE Runtime Transform
[x] Projection is explicitly Scratch → NGVGE only
[x] Stable semantic NodeId remains Transform owner
[x] Missing Transform components bootstrap explicitly from Scratch Authority state
[x] High-frequency projection does not mutate Persistent Transform data
[x] High-frequency projection does not write Scene/project source
[x] Explicit Runtime → Persistent Authority snapshot commit exists
[x] Scratch target recreation preserves NodeId and Transform component identity
[x] Scratch rotationStyle / renderer state does not leak into Transform2D
[x] No Scratch Renderer private API dependency is introduced
[x] Scene System exposes a backend-independent Runtime Transform query capability
[x] Dedicated unit, self-test, conformance and permanent-regression coverage exists
```

These criteria complete 0009-C only. Editor write intent still cannot flow back to Scratch until 0009-D.

## 0009 execution stages

```text
0009-A  Transform2D Semantic Contract Foundation       COMPLETE
0009-B  Runtime / Persistent Component Wiring          COMPLETE
0009-C  Scratch Compatibility Projection               COMPLETE
0009-D  Editor PatchComponent Compatibility Bridge     NEXT
0009-E  Transform DoD Certification / Browser Verify   PLANNED
```

## Active gate

```text
npm run test:conformance:0009-c
```

The gate runs the certified C001.1 baseline plus 0009-A, 0009-B and 0009-C focused conformance suites.
