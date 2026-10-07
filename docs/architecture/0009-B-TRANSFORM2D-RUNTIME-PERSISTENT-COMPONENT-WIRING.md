# 0009-B｜Transform2D Runtime / Persistent Component Wiring

**Milestone:** 0009 Transform System  
**Status:** Complete / Gate Active  
**Date:** 2026-08-12  
**Authority:** ARC-0001 + ARC-C001.1-H certified entry baseline + 0009-A semantic contract

## Purpose

0009-B turns the `ngvge.transform2d` semantic contract from 0009-A into an actual Runtime Component owned by a semantic Runtime Node, while preserving a strict boundary between project-persistent Transform data and high-frequency Runtime Transform state.

This stage intentionally does **not** project Scratch Target state yet. Scratch compatibility projection begins in 0009-C.

## Runtime Component registration

Transform2D is registered in the existing Runtime Component Type Registry as:

```text
typeId:        ngvge.transform2d
schemaVersion: 1
cardinality:   one
ownerModuleId: ngvge.transform-system
```

A semantic Runtime Node may own at most one Transform2D component. Component ownership is expressed through the Runtime Node's `NodeId`; Scratch Target identity is not an owner key and is not part of the component record.

## Persistent / Runtime split

0009-B freezes two representations:

```text
Persistent Transform
Runtime Node
└── Runtime Component: ngvge.transform2d
    └── data
        ├── position
        ├── rotation
        └── scale

Runtime Transform
Transform2DRuntimeStore
└── NodeId
    ├── ComponentId
    ├── runtime revision
    ├── position
    ├── rotation
    └── scale
```

The Persistent representation is serialized by `RuntimeNodeGraph.exportState()` through the existing Runtime Component persistent record. The Runtime representation is owned by `Transform2DRuntimeStore` and is not serialized by the Runtime Node graph.

## Explicit hydration boundary

Persistent Transform may seed Runtime Transform through an explicit bootstrap/hydration operation:

```text
Persistent Component data
        ↓ explicit hydrate
Transform2DRuntimeStore
```

A later mutation to Persistent Component data does not silently overwrite a live Runtime Transform. Rehydration must be explicitly requested at a bootstrap/commit boundary.

This is intentional because the current Writer Authority remains Scratch Compatibility Authority. Persistent project data is not treated as a per-frame Runtime Writer.

## High-frequency Runtime rule

`replaceRuntimeTransform()` and `patchRuntimeTransform()` mutate only Runtime Transform storage.

They do not:

- call Runtime Node Graph semantic mutation APIs;
- modify Runtime Component `data`;
- increment the Runtime Node Graph semantic revision;
- modify `RuntimeNodeGraph.exportState()`;
- write project source.

The 0009-B conformance gate exercises repeated Runtime Transform updates and verifies that Graph revision and exported Persistent state remain byte-equivalent at the JSON semantic level.

## Lifecycle wiring

The Runtime Store observes Runtime Node Graph lifecycle events only for attachment cleanup:

- Transform component add → initial Runtime hydrate;
- Transform component remove → Runtime entry removed;
- semantic Node destroy → Runtime entry removed.

`component:data` does not auto-hydrate live Runtime state.

## Boundary rules

`src/lib/transform-system` may depend on the Core Transform2D contract and the public Runtime Node/Component model. It must not depend on or embed:

- Scratch VM Target objects;
- volatile Scratch target runtime IDs;
- Scratch Renderer Drawables or Skins;
- renderer private arrays or draw methods;
- WebGL/GPU native handles;
- Editor/React widget state.

## Stage exit criteria

```text
[x] ngvge.transform2d is an explicit cardinality-one Runtime Component type
[x] Runtime Component ownership is semantic NodeId ownership
[x] Persistent Transform is serialized through Component data
[x] Runtime Transform has separate non-persistent storage
[x] Persistent → Runtime bootstrap is explicit
[x] Runtime writes do not mutate Persistent Component data
[x] Runtime writes do not mutate Runtime Node Graph semantic revision
[x] Runtime writes do not alter exported project/runtime persistent state
[x] Component/Node removal cleans Runtime Transform state
[x] Scratch Target / Renderer representation is excluded from 0009-B wiring
[x] Dedicated unit, self-test, conformance and permanent-regression coverage exists
```

These criteria complete 0009-B only. The full 0009 Definition of Done remains open until 0009-E certification.

## 0009 execution stages

```text
0009-A  Transform2D Semantic Contract Foundation       COMPLETE
0009-B  Runtime / Persistent Component Wiring          COMPLETE
0009-C  Scratch Compatibility Projection               NEXT
0009-D  Editor PatchComponent Compatibility Bridge     PLANNED
0009-E  Transform DoD Certification / Browser Verify   PLANNED
```

## Active gate

```text
npm run test:conformance:0009-b
```

The gate runs the complete 0009-A cumulative baseline followed by the 0009-B Runtime/Persistent wiring self-test, conformance validator and focused unit suite.
