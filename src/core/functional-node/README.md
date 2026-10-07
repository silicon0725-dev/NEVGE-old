# Functional Node Foundation

**Authority:** ARC-0001 / WS-10N0

This directory freezes backend-independent vocabulary for NGVGE's functional 2D node plan.
It does not register Camera, Collider, Physics or TileMap runtime providers by itself.

A Node archetype is a creation preset, not persistent identity and not a backend class.
The normative strategy is:

```text
Archetype
  -> stable Runtime Node type
  -> required NGVGE Components
  -> replaceable execution/render/physics backends
```

`.ne` is declared as the canonical native project target. `.sb3` remains a compatibility projection.
Hierarchy parentage and serialization ownership are separate semantic concepts.

The existing `ngvge.transform2d` contract is reused rather than redefined.
