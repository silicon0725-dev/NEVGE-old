# WS-10N4 | Camera2D

Status: `FROZEN / MACHINE VERIFIED / BROWSER VERIFIED`

Architecture parent: `ARC-0001 | Kernel Independence Contract`
Node-plan parent: `WS-10N | Functional 2D Foundation`
Depends on: `WS-10N0`, `WS-10N1`, `WS-10N2 + HF1`, `WS-10N3 + HF1`

## 1. Purpose

WS-10N4 is the first native-only functional 2D node after the Scratch role-management closure. It turns `Camera2D` from a planned archetype into an actually creatable Node2D preset with a semantic Camera component, a runtime viewport service and a controlled Scratch-render backend adapter.

The stage borrows the mature game-engine separation of camera semantics from rendering implementation, but does not import a Godot class hierarchy and does not promote the reviewed Scratch Camera V2 extension's drawable monkey-patching model into NGVGE authority.

## 2. Semantic shape

```text
Camera2D archetype
├─ Runtime type: ngvge.node2d
├─ ngvge.transform2d@1
│  ├─ position [x,y]
│  ├─ rotation
│  └─ scale [x,y]
└─ ngvge.camera2d@1
   ├─ enabled
   ├─ zoom [x,y]
   ├─ offset [x,y]
   └─ priority
```

Position and rotation remain Transform2D authority. Camera2D does not duplicate those fields.

N4 P0 intentionally defers follow-target binding, smoothing and camera limits. They will be added only when their runtime semantics and Inspector behavior are implemented; no placeholder properties are serialized.

## 3. Active camera rule

For the active Scene, the runtime service selects:

```text
enabled Camera2D components
→ highest priority
→ stable NodeId lexical tie-break
```

The selected result becomes the single runtime viewport state:

```text
Camera2DRuntimeService.viewportState
├─ activeCameraNodeId
├─ sceneId
├─ position
├─ rotation
├─ offset
├─ zoom
└─ priority
```

Renderer-private handles and matrices are not stored in the Camera component or Node record.

## 4. Scratch render backend

The first adapter is:

```text
ngvge.scratch-render.camera2d-adapter
```

It changes the Scratch renderer projection rather than mutating each Drawable position/scale/rotation.

Conceptually:

```text
clip
= Scratch baseline ortho
× zoom
× rotate(-cameraRotation)
× translate(-(cameraPosition + offset))
× world
```

This preserves Scratch target world-space positions as the compatibility execution authority. When no explicit Camera2D is active, the adapter restores the exact native Scratch stage projection and native offscreen-culling policy.

Scratch's built-in offscreen Drawable culling is disabled while an explicit Camera2D is active because native culling assumes the untransformed stage rectangle and can incorrectly reject world Drawables revealed by camera movement.

## 5. Runtime vs persistent editing

Inspector edits are persistent semantic mutations:

```text
Inspector
→ ngvge.camera2d-command
→ PatchCamera2D
→ Runtime Node component data
→ runtime viewport refresh
```

Scratch Camera blocks are runtime mutations:

```text
Scratch block
→ Camera2D Runtime capability
→ runtime Camera/Transform state
→ viewport refresh
```

They do not persist every frame into project data. `PROJECT_START` and `PROJECT_STOP_ALL` restore Camera runtime state and native Camera Transform runtime state from authored component data.

## 6. Scratch Blocks bridge ownership

The Camera block extension must receive the real VM extension object and therefore cannot cross the first-party module portable-service facade as a class instance. Registration is owned by the raw-VM first-party framework bootstrap (`runtime-integration.js`) and is idempotent per VM.

The Scene module only publishes portable semantic Camera capabilities. The Scratch block implementation resolves those capabilities at execution time. This preserves the module boundary instead of weakening service-facade portability rules.

## 7. Coordinate query

N4 exposes reversible:

```text
worldToScreen([x,y])
screenToWorld([x,y])
```

and the Scratch block projection provides `mouse world x/y` through that inverse transform.

N4 does **not** claim that every native Scratch renderer picking/dragging path has already been made camera-aware. Browser acceptance must explicitly test click/drag behavior under translated, zoomed and rotated Camera2D. A failure there is an N4 hotfix trigger, not a reason to move camera authority back into Drawable mutation.

## 8. Provider admission

`Camera2D` is surfaced by `ngvge.functional-node-creation` only when a real viewport provider is available. Headless/unit Scene System activation without a compatible Scratch renderer still works, but Camera2D is hidden rather than exposing a node whose camera cannot affect a viewport.

## 9. Compatibility

```text
.ne  → native Camera2D authoring authority
.sb3 → no direct native Camera representation
```

An imported Scratch project with no explicit Camera2D keeps baseline Scratch viewport behavior. Creating an explicit Camera2D changes Scratch compatibility to a native-only feature; later compatibility export may bake/project selected camera effects, but the standard `.sb3` format does not become Camera2D authority.

## 10. Research intake

The ECO-0 first-party candidate pack classified the community Camera extension as `REWRITE_MODULE`, P0, with the target shape `CameraComponent + CameraService + Blocks`. N4 follows that reuse decision: UX and camera-transform ideas are referenced, while renderer/VM private identity mutation remains backend-only and replaceable.
