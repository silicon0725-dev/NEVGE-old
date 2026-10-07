# 0009-A｜Transform2D Semantic Contract Foundation

**Milestone:** 0009 Transform System  
**Status:** Complete / Gate Active  
**Date:** 2026-08-12  
**Authority:** ARC-0001 + ARC-C001.1-H certified entry baseline

## Purpose

0009-A establishes the backend-independent semantic contract that later 0009 stages will project into. It intentionally does not wire live Scratch runtime mutation yet.

The stage exists to prevent the Transform system from being defined by Scratch Target fields, renderer Drawables, or editor widget state.

## Frozen semantic vocabulary for 0009 implementation

Transform2D component type:

```text
ngvge.transform2d
```

Initial Schema version:

```text
1
```

Persistent value:

```text
Transform2D
├── position : vec2       world-units
├── rotation : angle      degrees
└── scale    : vec2
```

Default value:

```json
{
  "position": [0, 0],
  "rotation": 0,
  "scale": [1, 1]
}
```

All numeric values must be finite. Unknown Transform2D fields fail closed. Scratch Target identity and backend-native handles are not Transform2D data.

## Initial Authority declaration

0009 begins with Scratch as Compatibility Authority:

```text
State Domain: Transform2D
Writer:       scratch.compat.transform
Projection:   ngvge.semantic.transform
Direction:    authority-to-projection
Meaning:      Scratch → NGVGE
```

The generic Authority Registry still enforces a single Writer. 0009-A only freezes and validates this registration vocabulary; live write authorization and authority-switch transactions remain later work.

## Editor protocol expression

Transform edits can be represented using the already-frozen generic Engine Protocol vocabulary:

```text
Command: PatchComponent
Payload:
  nodeId
  componentId
  patch
```

0009-A provides `createTransform2DPatchComponentCommand()` and validates the resulting DTO through the Core Protocol gate. It does not yet route that command to the Scratch Writer Authority.

## Boundary rules

`src/core/transform2d` may depend only on Core semantic foundations. It must not import or embed:

- Scratch VM objects;
- Scratch Target runtime IDs;
- Scratch Renderer Drawables / Skins;
- renderer private arrays or WebGL handles;
- editor/React state.

The active 0009-A conformance gate scans for those representation leaks.

## Stage exit criteria

```text
[x] Versioned Transform2D Schema descriptor exists
[x] Transform2D value normalization is fail-closed and Persistent-DTO-safe
[x] Scratch Compatibility Writer declaration exists
[x] Scratch → NGVGE projection direction is explicitly represented
[x] Transform edit is expressible as PatchComponent
[x] Core Transform2D contract contains no Scratch Renderer/native handle leakage
[x] Dedicated unit, self-test, conformance and permanent-regression coverage exists
```

These items are contract-level foundations. They do not claim the complete 0009 Definition of Done.

## 0009 execution stages

```text
0009-A  Transform2D Semantic Contract Foundation       COMPLETE
0009-B  Runtime / Persistent Component Wiring          NEXT
0009-C  Scratch Compatibility Projection               PLANNED
0009-D  Editor PatchComponent Compatibility Bridge     PLANNED
0009-E  Transform DoD Certification / Browser Verify   PLANNED
```

### 0009-B target

The next stage will establish the actual `ngvge.transform2d` Runtime Component on stable semantic Node ownership, define the Persistent Transform record versus Runtime Transform state boundary, and ensure initial component creation does not embed a Scratch Target.

### 0009-C target

Scratch target state will project into the Runtime Transform representation without per-frame project-source writes. Initial project/bootstrap synchronization and high-frequency runtime projection must be explicitly separated.

### 0009-D target

Editor transform intent will be routed through `PatchComponent` while Scratch remains the unique Writer Authority. This stage must not fake ARC-C001.3 Mutation Context or Projection Loop Prevention as already complete.

### 0009-E target

The final 0009 certification will close every checkbox in the Master Plan Transform Definition of Done, including Scratch Adapter Boundary evidence, no renderer-private imports, future authority reversal interface, persistence, and browser validation.

## Active gate

```text
npm run test:conformance:0009-a
```

This runs the certified C001.1 entry baseline check plus the Transform2D semantic self-test, conformance validator and focused unit suite.
