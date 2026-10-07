# WS-10N7｜TileSet Resource + TileMapLayer2D

Status: **FROZEN / MACHINE VERIFIED / BROWSER VERIFIED**

## Purpose

WS-10N7 establishes native structured TileMap authoring before full Rigidbody/Joints. It reuses the frozen NodeId / ResourceId / Transform2D / Collider2D authority model rather than projecting a game map from Scratch Lists, clones or backend handles.

## Stable semantic model

```text
Global TileSet Resource (ResourceId)
├─ tileSize
├─ textureResourceId -> global Image Resource
├─ atlas layout
└─ Tile Definitions
   ├─ atlas coordinate
   ├─ collision shapes
   ├─ navigation metadata
   ├─ terrain metadata
   ├─ variant group
   ├─ custom data
   ├─ animation metadata
   └─ scene/object stamp metadata

TileMapLayer2D Node
├─ Transform2D
└─ TileMapLayer2D Component
   ├─ tileSetResourceId
   ├─ Sparse Chunks
   ├─ visible
   ├─ zIndex / ySortEnabled
   ├─ collision layer / mask
   └─ navigation enabled
```

TileSet content is global resource authority. TileMapLayer2D stores only the ResourceId binding and per-layer sparse cell authoring data. Texture bytes and renderer handles never become TileSet identity.

## Sparse Chunk authority

TileMap cell authoring starts with Sparse Chunks, including negative coordinates. Empty chunks disappear after erase. A giant dense 2D Array or Scratch List is forbidden as the persistent authoring source.

```text
Chunk[-2, 1]
Chunk[-1, 0]
Chunk[0, 0]
Chunk[5, -3]
```

## Editor authoring surface

The Stage editor provides a command-routed transient preview and one persistent chunk patch per completed gesture:

- Pencil
- Eraser
- Picker
- Rectangle
- Line
- bounded Flood Fill
- Select / Move / Copy / Paste
- Flip X / Flip Y / quarter rotation
- deterministic Random Variant by `variantGroup`
- basic four-neighbour Terrain auto-connect by `terrainId + mask`
- Grid visibility
- Collision debug
- Navigation debug

The Inspector owns precise authoring for TileMapLayer2D and its bound TileSet Resource: resource binding, tile size, atlas rows/columns/margin/separation, atlas coordinate, per-tile Collider2D shape data, collision offset/rotation, terrain/variant/navigation metadata and custom-data JSON.

Flood fill is deliberately bounded in an infinite sparse plane. Empty-space fill outside existing authored bounds is a no-op; holes inside authored bounds may be filled.

## Collision projection

Tile collision does not create a second collision engine. TileMapLayer2D registers an external projection provider with the existing Collider2D Runtime Service:

```text
TileSet collision shape
+ Cell transform (flip / 90° rotation / grid position)
+ TileMap Transform2D hierarchy
        ↓
worldPoints
        ↓
Collider2D Runtime external projection
        ↓
queryPoint / raycast / overlaps / CharacterBody2D solver
```

Projected Collider views keep the owning TileMap NodeId as semantic identity and use projection IDs only as runtime query detail. No Rapier/Box2D handle exists in N7.

## Navigation projection foundation

Tiles marked with navigation metadata can be projected as world polygons when the TileMap layer enables navigation. This is a provider-ready semantic projection only; a full navigation server/pathfinding backend is not claimed in N7.

## Render projection

A replaceable Stage Canvas projection renders visible native TileMap layers even when they are not selected. Layers are ordered by `zIndex`; cells may use Y sort inside a layer. The selected layer is temporarily excluded from the passive renderer because the interactive TileMap editor owns its preview canvas.

This Canvas is a current editor/player render backend, not persistent authority. A later native renderer backend may replace it without changing TileSet, TileMapLayer2D, ResourceId or Sparse Chunk semantics. Interleaving native TileMap `zIndex` with individual Scratch drawable ordering is not frozen as semantic behavior in N7.

## Compatibility

- `.ne`: native TileSet Resource + TileMapLayer2D + Sparse Chunks.
- `.sb3`: no native TileMapLayer2D identity; compatibility projection is bake/partial.
- Scratch Lists and clones may be generated export artifacts but are never the native authoring source.

## Explicit non-goals / deferred backends

- no RigidBody2D / joints / mass / friction / restitution;
- no Rapier2D/Box2D identity;
- no full Navigation2D server or pathfinding backend;
- no production animation playback scheduler for animated tiles yet;
- no Scene Stamp instantiation runtime yet;
- no requirement that the current Canvas render adapter be the final native renderer.

These remain replaceable execution/provider work; the N7 stable data model already reserves metadata seams without pretending the backends exist.


## Browser verification / freeze

Real editor browser verification was user-confirmed PASS on 2026-08-18. WS-10N7 is therefore FROZEN. Later stages may replace execution/render backends, but must preserve the native TileSet ResourceId authority, Sparse Chunk authoring source, TileMapLayer2D binding semantics and shared Collider2D collision projection.
