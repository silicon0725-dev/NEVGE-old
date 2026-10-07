# WS-10N0｜Functional 2D Foundation Contract

**Status:** IMPLEMENTED / MACHINE VERIFIED  
**Parent:** WS-10N Functional Node / 2D Game Foundation Master Plan  
**Authority:** ARC-0001  
**Baseline:** 0008 Runtime Node Model + 0009 Transform COMPLETE/CERTIFIED + WS-10P0M-HF1

## Decision

WS-10N0 freezes the contract needed before turning the existing Node Tree into a functional game-authoring tree.

The implementation is intentionally contract-only. It does not register non-functional Camera, Collider, Character, Rigidbody or TileMap providers in the Node Library.

## Machine-readable contract

```text
src/core/functional-node/
├── functional-node-foundation.js
├── index.js
└── README.md
```

Contract identity:

```text
ngvge.functional-node-foundation@1
```

## Frozen rules

1. Archetype is a creation preset, never persistent Node identity.
2. Archetype implementation strategy is `base-node-plus-components`.
3. Backend objects may never own stable Node identity.
4. Existing certified `ngvge.transform2d` is reused for XY scale.
5. `.ne` is the native canonical format role; `.sb3` is a compatibility projection role.
6. Hierarchy `parentId` is not serialization ownership.
7. Native Transform mutation requires Node-scoped writer routing before implementation; the current Authority Registry is not silently weakened in WS-10N0.
8. Scratch compatibility role is explicit per archetype.
9. Collider semantics are separated from Rigidbody semantics.
10. TileMapLayer2D is native authoring state; Scratch list/bake data can only be generated compatibility output.

## Initial catalog

The contract includes nine descriptors:

```text
Node2D
Sprite2D
Camera2D
Area2D
StaticBody2D
CharacterBody2D
RigidBody2D
TileMapLayer2D
AudioSource2D
```

Only Node2D Transform semantics and Scratch-backed Sprite semantics are marked implemented/compatibility-backed. Future component requirements remain explicitly `planned`.

## Why the native Transform writer prerequisite is explicit

0009 certified the current one-way Scratch Compatibility Transform Authority. A native Node2D has no Scratch Target to act as Writer. Allowing Editor code to mutate Transform directly would create a second implicit writer and violate the existing Authority contract.

Therefore WS-10N1 must establish semantic-owner-scoped writer routing before native Transform mutation is exposed.

## Exit criteria

```text
[x] N0 Core contract conformance passes — 13/13
[x] focused N0 unit suite passes — 1 suite / 9 tests
[x] permanent regression includes N0 contract — 20/20
[x] ARC-C001.1 baseline remains PASS — 7/7, 0 waivers, 0 blockers
[x] 0009 Transform DoD remains PASS — 0009 A/B/C/D/E chain PASS
[x] lint/typecheck remain PASS
[x] integration remains PASS — 4 suites / 5 tests
[x] smoke remains PASS — 1 suite / 1 test
[x] full unit remains PASS — Node 167 suites / 928 tests; DOM 3 suites / 27 tests
```

WS-10N0 is machine verified. The next implementation stage is `WS-10N1 | Node-scoped Transform Writer Routing`.
