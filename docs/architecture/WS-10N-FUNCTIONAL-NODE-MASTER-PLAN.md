# WS-10N｜Functional Node / 2D Game Foundation Master Plan

**Status:** ACTIVE PLAN  
**Parent authority:** ARC-0001 Kernel Independence Contract  
**Entry baseline:** 0008 Runtime Node Model + 0009 Transform System COMPLETE/CERTIFIED + WS-10P0M-HF1  
**Native project target:** `.ne`  
**Compatibility profile:** Scratch 3 / `.sb3`

## 1. Why WS-10N exists

The current repository already has a stable Runtime Node Model, Scene System, Scratch Sprite Binding and a certified Transform2D contract. However, several user-visible Project Node types are still authoring records only; they do not yet own runtime capabilities such as Camera, collision, character motion, physics or tile-map rendering.

WS-10N turns the Node Tree from a structural/project browser into the primary functional 2D authoring model.

The target is not "Scratch sprites in a different tree UI". The target is:

```text
Stable NGVGE NodeId
    +
Versioned Components / Resources
    +
Runtime Scene Tree lifecycle
    +
Replaceable execution/render/physics backends
    +
Scratch compatibility projection
```

## 2. Godot-informed principles adopted

Godot is used as a product/architecture reference, not as an implementation or class hierarchy dependency.

Borrowed principles:

1. Nodes are functional runtime building blocks and are composed into trees.
2. A saved scene is a reusable/instantiable tree rather than only a screen/page.
3. Runtime activation is tied to entering an active scene tree.
4. Hierarchy parentage is not the same concept as serialization ownership.
5. Camera, collision bodies, trigger areas, character controllers and TileMap layers are first-class 2D authoring concepts.
6. TileMap layers should be separate scene-tree objects and share reusable TileSet resources.

Primary references reviewed:

- Godot stable `Nodes and Scenes`: https://docs.godotengine.org/en/stable/getting_started/step_by_step/nodes_and_scenes.html
- Godot stable `Nodes and scene instances`: https://docs.godotengine.org/en/stable/tutorials/scripting/nodes_and_scene_instances.html
- Godot stable `TileMapLayer`: https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html
- Godot stable `Area2D`: https://docs.godotengine.org/en/stable/classes/class_area2d.html
- Godot stable `CharacterBody2D`: https://docs.godotengine.org/en/stable/classes/class_characterbody2d.html

NGVGE deliberately does **not** copy Godot's inheritance tree. NGVGE continues to use stable Node identity plus Component/Capability composition.

## 3. Existing NGVGE facts that must not be reimplemented

### 3.1 Runtime Node model already exists

The current `ngvge.runtime-node-model@1.3.1` already owns stable Node identity, hierarchy, lifecycle, Component ownership and persistence boundaries.

### 3.2 Scratch Sprite binding already exists

`ngvge.sprite-node` and `ngvge.scratch-target-binding` already separate semantic NodeId / BindingId from volatile Scratch target identity.

### 3.3 Transform2D already exists and is certified

`ngvge.transform2d@1` already contains:

```text
position : vec2
rotation : degrees
scale    : vec2
```

Therefore XY Stretch is **not** a new side-channel and must not be implemented by writing Scratch Renderer private state as project semantics.

The open issue is authority: 0009 currently keeps Scratch Compatibility as the Transform Writer. Native Node transform mutation needs a scoped writer-routing stage before NGVGE-owned native nodes can edit Transform independently of a Scratch target.

## 4. Node archetypes are presets, not identities

WS-10N freezes this rule:

```text
Node Archetype
!= NodeId
!= Backend Class
```

A Node Library entry creates a stable Runtime Node plus a required Component bundle.

Example:

```text
CharacterBody2D preset
    ↓
ngvge.node2d
+ ngvge.transform2d
+ ngvge.collider2d
+ ngvge.character-controller2d
```

This makes functionality replaceable and keeps node creation UX convenient.

## 5. Initial Functional 2D catalog

| Archetype | Base semantic runtime type | Required capability/components | WS-10N entry state |
| --- | --- | --- | --- |
| Node2D | `ngvge.node2d` | Transform2D | Transform implemented |
| Sprite2D | `ngvge.sprite-node` | Transform2D + Visual2D + ScriptHost | Scratch compatibility-backed |
| Camera2D | `ngvge.node2d` | Transform2D + Camera2D | planned |
| Area2D | `ngvge.node2d` | Transform2D + Collider2D(sensor) | planned |
| StaticBody2D | `ngvge.node2d` | Transform2D + Collider2D | planned |
| CharacterBody2D | `ngvge.node2d` | Transform2D + Collider2D + CharacterController2D | planned |
| RigidBody2D | `ngvge.node2d` | Transform2D + Collider2D + Rigidbody2D | planned |
| TileMapLayer2D | `ngvge.node2d` | Transform2D + TileMapLayer2D | planned |
| AudioSource2D | `ngvge.node2d` | Transform2D + AudioEmitter2D | planned |

Only implemented providers may be surfaced as working Node Library entries. Planned archetypes are contract/catalog entries until their provider gate passes.

## 6. Collision and physics split

Collision must be useful before a complete rigid-body backend exists.

```text
Collider2D
├─ Rectangle
├─ Circle
├─ Capsule
└─ Convex Polygon
```

Collider owns geometry/query semantics. `sensor: true` provides Area/trigger behavior. Physics bodies consume Collider geometry but do not own its stable identity.

This matches the reviewed ECO-0 direction:

- `Lazy Collisions` → P0 rewrite target `Collider2D + collision query blocks`;
- `Rigidbodies` → P1 rewrite target `Rigidbody2D / Collider2D / PhysicsMaterial`.

External physics backends (Rapier2D, Box2D or future alternatives) remain replaceable. Their handles are runtime-only.

## 7. Camera2D

Camera2D is P0 functional-node work, not a renderer extension authority.

Target component surface:

```text
Camera2D
├─ enabled
├─ zoom [x,y]
├─ offset
├─ limits
├─ position smoothing
├─ rotation smoothing
├─ priority
└─ optional follow binding
```

Scratch projects without an explicit Camera retain Scratch-compatible default viewport behavior. Creating an explicit Camera2D is an NGVGE-native feature and is reported by the Scratch compatibility analyzer.

## 8. TileSet + TileMapLayer2D

RPG authoring must not require users to maintain map arrays through Scratch Lists.

Native authoring model:

```text
TileSet Resource
        ↓
TileMapLayer2D Node
        ↓
Sparse/chunked TileMap document
```

Initial TileSet semantics should cover:

- atlas slicing;
- tile stable local identity;
- terrain/autotile connectivity;
- collision data;
- navigation data;
- tile animation;
- custom data;
- scene/object stamps later.

Initial TileMap editor should cover pencil, eraser, picker, rectangle, line, fill, selection, copy/paste and terrain painting.

Scratch export may compile TileMap data to generated lists/helper blocks or bake visual layers, but those generated lists are compatibility output, never NGVGE authoring authority.

## 9. Parent and serialization owner are different semantics

Future `.ne` scene records must not assume:

```text
parentId == serialization owner
```

WS-10N reserves the vocabulary:

```text
parentId
serializationOwnerId
```

`parentId` controls runtime/editor hierarchy. `serializationOwnerId` controls which saved Scene Resource owns a node when scene instancing is implemented.

This field is not retroactively injected into current persistent records by WS-10N0; the rule is frozen before the later `.ne` scene-schema stage.

## 10. `.ne` and `.sb3`

Native persistence target:

```text
.ne = canonical NGVGE project
```

Scratch:

```text
.sb3 = compatibility projection
```

Native components must never be weakened because `.sb3` cannot express them.

Each functional archetype declares a Scratch projection role:

```text
target      → maps to a Scratch target when compatible
container   → hierarchy-only; not a Scratch target
bake        → can produce generated compatibility output
native-only → not directly representable in standard Scratch 3
```

A pure imported Scratch project must retain lossless-ish round-trip metadata independently of the richer native model.

## 11. Execution plan

### WS-10N0｜Functional 2D Foundation Contract

**This stage.** Freeze archetype/component vocabulary, `.ne`/`.sb3` roles, parent/owner separation, native Transform writer prerequisite and the RPG-first feature order. No fake Camera/Physics/TileMap provider is registered.

### WS-10N1｜Node-scoped Transform Writer Routing

Required before native Node2D editing can become authoritative.

- keep existing 0009 Scratch-backed behavior intact;
- route Transform Writer by semantic Node/binding profile;
- native Node → NGVGE Transform writer;
- Scratch-backed compatibility Node → Scratch writer unless promoted;
- preserve one-writer-per-owner invariant;
- no renderer-private identity in Transform semantics.

### WS-10N2｜Functional Node Archetype Creation

**Status:** FROZEN / MACHINE VERIFIED / BROWSER VERIFIED (WS-10N2-HF1)

- Node Library consumes archetype descriptors;
- creating Node2D automatically provisions required Transform2D;
- creating Sprite2D goes through the existing Scratch compatibility lifecycle when the Scratch profile is active;
- remove/retire authoring-only fake Physics/Collider entries once replacements exist;
- Inspector consumes Component schemas rather than duplicate node-property fields.

### WS-10N3｜Sprite / Scratch Role-Manager Parity

**Status:** FROZEN / MACHINE VERIFIED / BROWSER VERIFIED (WS-10N3-HF1)

- Node Tree create/delete/duplicate/rename selects and operates real Scratch-backed Sprite targets when appropriate;
- Scratch Blocks editing target follows selected semantic Node binding;
- target-local variables and clone semantics stay compatible;
- native role manager may replace Scratch sprite list only after parity gate.

### WS-10N4｜Camera2D

**Status:** FROZEN / MACHINE VERIFIED / BROWSER VERIFIED

- Camera2D schema + runtime service;
- Scratch-renderer adapter first;
- viewport transform single source of truth;
- Inspector + Blocks projection;
- default Scratch viewport remains compatibility behavior.

### WS-10N5｜Collider2D / Area2D

**Status:** IMPLEMENTED / MACHINE VERIFICATION IN PROGRESS / BROWSER EVIDENCE PENDING

- shape schemas;
- layers/masks;
- solid vs sensor;
- overlap / point / ray / shape query API;
- viewport gizmos;
- no rigid-body dependency required.

### WS-10N6｜CharacterBody2D

- controlled velocity;
- move-and-collide / move-and-slide semantics;
- floor/wall/ceiling state;
- RPG/top-down and platformer-friendly movement APIs.

### WS-10N7｜TileSet + TileMapLayer2D

- TileSet Resource;
- chunked/sparse map storage;
- editor painting tools;
- collision extraction;
- terrain/autotile;
- Scratch compatibility compiler/bake seam.

### WS-10N8｜Physics2D Backend Contract + POC

- Rigidbody2D / Static / kinematic semantics;
- PhysicsMaterial;
- backend isolation;
- first backend POC chosen independently of persistent schemas;
- physics handles never become Node/Component IDs.

### WS-10N9｜Scene Instancing / Serialization Ownership / `.ne` Scene Records

- serializable Scene Resource tree;
- scene instance source identity;
- `parentId` vs `serializationOwnerId`;
- instance overrides;
- ephemeral Scratch clone runtime instances remain non-persistent.

### WS-10N10｜Functional Node Total Certification

A Node Tree feature-parity and native-2D foundation gate. Only after this gate may the legacy Scratch role manager be hidden by default.

## 12. RPG minimum viable authoring closure

The first target where NGVGE should be able to build a simple RPG without Scratch-list map plumbing is:

```text
Node/Scene
+ Transform2D / XY scale
+ Sprite2D
+ Camera2D
+ Collider2D / Area2D
+ CharacterBody2D
+ TileSet
+ TileMapLayer2D
+ Resource bindings
+ Scratch Blocks compatibility
```

Full Rigidbody simulation is not required for this RPG closure.

## 13. ECO-0 intake mapping

The uploaded candidate pack is treated as implementation/UX research, not authority:

- Transform NonUniform Scale / Renderer Control → CORE_PROMOTE requirement; rewrite against Transform2D.
- Camera V2 → Camera2D provider/adapter research.
- Lazy Collisions → Collider2D/query UX research.
- Rigidbodies → Physics2D algorithm/UX research; do not keep Sprite/renderer identity.
- Tile Grids → grid placement/query research; superseded semantically by TileSet + TileMapLayer2D.

## 14. Non-goals

WS-10N does not:

- clone the Godot class hierarchy;
- make Scratch targets persistent Node identity;
- make Rapier/Box2D handles stable IDs;
- model TileMap as a Scratch List;
- make `.sb3` the canonical NGVGE project;
- reimplement the already-certified Transform2D contract;
- claim Camera/Physics/TileMap functionality before the matching runtime provider gate passes.
