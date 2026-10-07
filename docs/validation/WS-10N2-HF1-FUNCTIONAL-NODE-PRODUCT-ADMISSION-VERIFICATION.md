# WS-10N2-HF1 | Functional Node Product Admission + Boundary Closure

**Status:** `IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING`

## Trigger

The first WS-10N2 browser check exposed the real product-path failure:

```text
Node Explorer root: Entities
footer: 1 targets · 2 compatibility nodes · 0 native nodes
Legacy Sprites: Stage only
```

The two visible `Node2D` records were therefore project-compatibility nodes, not WS-10N2 Runtime Functional Nodes. WS-10N2 browser evidence is recorded as **FAILED** until this hotfix is browser-accepted.

## Root cause 1 | Scene System product admission was not reachable from the obvious Add-node path

`ngvge.scene-system` is intentionally still `defaultEnabled: false`. WS-10N2 functional creation exists only while that module is active, but the default Node Explorer creation path could still open the old project-compatibility presets.

This hotfix does **not** globally flip Scene System to default-enabled. A global default-enable experiment was rejected because project restore currently enables module defaults before persisted module data is deserialized; activating Scene System in that phase can schedule compatibility reconciliation against data whose schema has not yet been validated/migrated.

Instead, Node Explorer now exposes an explicit primary functional-node launcher. The user gesture:

```text
Add functional scene node
    -> enable ngvge.scene-system if needed
    -> resolve the freshly published active Scene root
    -> open Runtime Functional Node creation
```

The generic root `Create` entry uses the same path whenever the module framework is present.

## Root cause 2 | capability arrays lose JavaScript Array identity across the service facade

First-party capability/service facades intentionally do not transfer object authority. An array returned by one capability can therefore arrive as an array-like facade with numeric keys and a non-enumerable `length` rather than a local `Array`.

Forwarding such a value directly into Runtime Node command protocol validation is invalid because it is not a portable local DTO.

Added:

```text
src/lib/first-party-modules/materialize-portable-capability-value.js
```

`ProjectExplorer` materializes Functional Node archetype/creation-plan values before they cross the next command/protocol boundary. Nested `components`, `position` and `scale` values become real local arrays.

## Root cause 3 | Scratch Sprite creation attempted to transfer an ArrayBuffer through a module service boundary

The lifecycle bridge previously built a `.sprite3` archive and called `vm.addSprite(ArrayBuffer)` through a service facade. The facade rejects raw ArrayBuffer/Blob ownership transfer by design.

Scratch VM accepts a portable sprite JSON descriptor directly. WS-10N2-HF1 now sends that descriptor instead, preserving the service boundary while Scratch provisions its default costume/storage representation.

The bridge still performs the existing semantic reconciliation and rollback rules:

```text
Scratch Target creation
    -> stable NGVGE binding reconciliation
    -> semantic component provisioning
    -> rollback target/binding if post-target provisioning fails
```

`NodeId != Scratch Target ID` remains unchanged.

## Product behavior after HF1

Before activation:

```text
Scene System off
Node Explorer may still show old compatibility records
```

First click of the primary `+` functional-node launcher:

```text
Scene System activates from the user event
Entities root -> active Scene presentation
creation menu -> Node2D / Sprite2D (+ admitted plugin runtime types)
```

`Node2D`:

```text
creates ngvge.node2d
+ Transform2D
+ no Scratch Target
```

`Sprite2D`:

```text
creates real Scratch Sprite Target
-> stable Scratch binding
-> ngvge.sprite-node
-> Transform2D semantic component
```

Planned Camera2D / Area2D / CharacterBody2D / TileMapLayer2D archetypes remain hidden until their actual runtime providers exist.

## Machine / permanent verification

Permanent machine gate:

```text
npm run test:node-plan:ws10n2-hf1:machine
```

The real VM path verifies:

- Scene System starts opt-in;
- explicit host-client admission enables it;
- Functional Node Creation / Runtime Node Model / Scratch Adapter / Runtime Command capabilities publish;
- facade arrays are materialized into real arrays;
- native Node2D creates without adding a Scratch Target;
- Sprite2D creates through the real Scratch VM boundary;
- Sprite2D adds exactly one Scratch target;
- that target resolves to a stable bound semantic Node;
- creation plans contain no `targetId`, `targetRuntimeId` or `bindingId` backend identities.

A permanent regression contract also protects facade-array materialization.

## Browser acceptance gate

WS-10N2-HF1 may be promoted to browser verified only when all of the following are observed in the actual editor:

1. The Node Explorer toolbar exposes the functional `+` launcher.
2. On first click with Scene System inactive, the explorer changes from the compatibility `Entities` presentation to the active Scene presentation.
3. The creation dialog offers `Node2D` and `Sprite2D`; future fake archetypes remain absent.
4. Creating `Node2D` increments native/runtime node state and does **not** create a Legacy Sprite.
5. Creating `Sprite2D` creates exactly one semantic runtime node and exactly one real Legacy Sprite target.
6. The footer no longer classifies newly created Functional Node2D records as compatibility nodes.
7. Existing compatibility Node2D records created before HF1 remain compatibility records; HF1 performs no unsafe automatic migration.

Only after this browser gate passes may WS-10N2 be frozen and WS-10N3 begin.
