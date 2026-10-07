# 0009-D｜Editor PatchComponent Compatibility Bridge

**Milestone:** 0009 Transform System  
**Status:** COMPLETE / Active Manual Gate  
**Baseline:** 0009-C Scratch Compatibility Transform Projection  
**Date:** 2026-08-12

## 1. Purpose

0009-D closes the missing Editor write-intent path while preserving the initial Transform2D Authority decision:

```text
Editor / Inspector intent
        ↓
Engine Protocol Command DTO
PatchComponent
        ↓
ngvge.transform2d-command
        ↓
Scratch Compatibility Bridge
        ↓
Scratch Writer Authority
        ↓
Scratch → NGVGE projection
        ↓
Runtime Transform
        ↓ explicit editor mutation commit
Persistent Transform
```

The Editor does not call `target.setXY()`, `target.setDirection()` or `target.setSize()` directly. The public capability is semantic and backend-independent; the current implementation is replaceable when Transform Authority is inverted in a future phase.

0009-D does **not** implement ARC-C001.3 Mutation Context, generic Projection Loop Prevention, generic transactions, or Authority Switch Transaction.

## 2. Semantic capability

`src/lib/transform-system/transform2d-command-capability.js` defines:

```text
CapabilityId: ngvge.transform2d-command
Version:      1
Input:        Engine Command DTO / PatchComponent
```

The Editor-facing helper `createTransform2DEditorClient()` converts semantic edit input into the already-frozen `PatchComponent` DTO contract from 0009-A. It contains no Scratch target mutation code and no volatile backend identity.

The Scene System publishes this capability. The capability identity does not contain `scratch`, so future Writer replacement does not require an Editor API rename.

## 3. Current Compatibility Writer bridge

`src/lib/scratch-sprite-adapter/scratch-transform-command-bridge.js` is the current implementation behind the semantic capability.

It performs the following fail-closed sequence:

1. normalize and validate the Engine Protocol DTO;
2. accept only `command / PatchComponent`;
3. validate exact Transform patch payload shape;
4. resolve stable semantic `NodeId` and exact Transform component identity;
5. resolve the live Scratch binding inside the Compatibility Adapter;
6. preflight every requested Scratch operation before mutating the target;
7. write through Scratch Target public transform setters;
8. project the *actual accepted Scratch Authority state* back into Runtime Transform;
9. explicitly commit that accepted Runtime snapshot to Persistent Transform;
10. return a portable `PatchComponentApplied` Engine Event DTO.

Failure is returned as a portable Protocol Error DTO. When a Scratch setter fails after mutation has begun, the bridge performs local best-effort compensation. This is deliberately scoped to this compatibility command and is **not** declared to be the future generic transaction system.

## 4. Representation mapping

### Position

```text
Transform2D.position [x, y]
        ↓
ScratchTarget.setXY(x, y, true)
```

The forced Scratch move flag is used because this is explicit Editor intent rather than continuation of player dragging.

### Rotation

```text
Scratch direction = wrapScratch(90 - Transform rotation)
```

The inverse conversion matches 0009-C's Scratch → NGVGE projection convention.

### Scale

Scratch currently exposes one `size%` value, while NGVGE Transform2D owns a two-axis scale.

Therefore under the current Scratch Writer Authority:

```text
[x, x] where x >= 0    representable
[x, y] where x != y    FAIL CLOSED
negative scale         FAIL CLOSED
```

0009-D does not average non-uniform scale or silently discard an axis.

Scratch may clamp a representable requested size. After mutation, the bridge re-reads Scratch through the 0009-C projection service and commits the **accepted** value rather than pretending the requested value succeeded unchanged.

## 5. Runtime versus Persistent behavior

0009-C high-frequency projection remains unchanged:

```text
Scratch runtime update → Runtime Transform only
```

0009-D Editor commands are explicit project mutations:

```text
Editor PatchComponent
→ Scratch Authority
→ Runtime projection
→ explicit Persistent Transform commit
```

This distinction preserves the 0009 requirement that high-frequency Runtime updates do not write project source each frame while still allowing user-authored Editor changes to become persistent project state.

## 6. Identity and boundary guarantees

0009-D preserves:

```text
NodeId                  = semantic Transform owner
ComponentId             = exact component mutation target
Scratch target id       = volatile adapter-only identity
Scratch Target object   = adapter-only runtime object
Renderer private state  = not required
```

Neither success events nor Persistent Transform records contain `targetRuntimeId`, Drawable IDs, Skin IDs, renderer handles, or Scratch Target objects.

## 7. Projection service extension

0009-D adds focused node-level operations to the existing 0009-C service:

```text
projectNode(nodeId)
commitNodeToPersistent(nodeId)
```

These avoid projecting or committing every binding when one Editor command edits a single Transform.

They preserve the same one-way Scratch → NGVGE projection semantics established by 0009-C.

## 8. Explicit non-goals

0009-D does not claim:

- NGVGE Transform Authority;
- generic Mutation Context;
- generic Projection Loop Prevention;
- generic transaction/rollback infrastructure;
- non-uniform Scratch scale support;
- renderer-private Transform implementation;
- final 0009 Definition of Done closure.

Those claims would exceed the current architecture baseline.

## 9. Completion criteria

```text
[x] Editor Transform intent enters through PatchComponent
[x] Editor-facing capability is backend-independent
[x] Scratch remains the unique current Writer Authority
[x] Stable NodeId and exact ComponentId are validated before write
[x] Scratch public transform setters are isolated inside Compatibility Adapter
[x] Accepted Scratch state is reprojected before persistence
[x] Explicit Editor mutations update Persistent Transform
[x] High-frequency 0009-C projection remains runtime-only
[x] Non-uniform / negative scale fails closed under Scratch Authority
[x] Protocol Error DTO returned for rejected commands
[x] Volatile Scratch target identity does not escape or persist
[x] No Scratch renderer private dependency is introduced
[x] Future Authority replacement can keep the same semantic command capability
[x] No false claim of ARC-C001.3 Mutation Context / Loop Prevention / generic transactions
[x] Dedicated unit, self-test, conformance and permanent-regression coverage exists
```

These criteria complete 0009-D only.

## 10. Execution stages

```text
0009-A  Transform2D Semantic Contract Foundation       COMPLETE
0009-B  Runtime / Persistent Component Wiring          COMPLETE
0009-C  Scratch Compatibility Projection               COMPLETE
0009-D  Editor PatchComponent Compatibility Bridge     COMPLETE
0009-E  Transform DoD Certification / Browser Verify   NEXT
```

## 11. Active gate

```text
npm run test:conformance:0009-d
```

This runs the certified C001.1 baseline, 0009-A/B/C cumulative gates, then the 0009-D self-test, conformance validator and focused unit suite.
