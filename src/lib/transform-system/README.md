# NGVGE Transform System Runtime Wiring

`src/core/transform2d` owns stable Transform2D semantics. This directory owns the backend-independent JavaScript Runtime wiring used by 0009.

The system intentionally separates:

- **Persistent Transform** — `ngvge.transform2d` Runtime Component `data`, serialized through the Runtime Node persistent record.
- **Runtime Transform** — high-frequency state owned by `Transform2DRuntimeStore`, keyed by semantic `NodeId` and not serialized on every runtime write.
- **Editor Transform Command capability** — a backend-independent `ngvge.transform2d-command` capability that accepts the Core `PatchComponent` DTO contract and delegates execution to the currently installed Writer Authority bridge.

0009-C adds a Runtime Node Model adapter so the store can operate through the public Runtime Node Model and Type Registration capabilities rather than requiring callers to expose a private `RuntimeNodeGraph`. The Scene System publishes a read/observe-oriented `ngvge.transform2d-runtime` capability.

0009-D adds the command capability and a tiny Editor client helper. The capability itself contains no Scratch knowledge; the current Scratch implementation lives behind it in `src/lib/scratch-sprite-adapter/scratch-transform-command-bridge.js`. A future NGVGE-owned Transform Writer can replace that executor without changing the Editor-side `PatchComponent` contract.

Persistent state may explicitly hydrate Runtime state. Runtime state may explicitly commit back to Persistent state at a deliberate save/snapshot or Editor mutation boundary. Normal runtime projection writes do not mutate Component `data` or project source.

Scratch Target projection and current Scratch Writer compatibility are implemented outside this directory. This directory remains free of Scratch Target identity, Scratch Renderer Drawables/Skins, renderer private APIs, WebGL handles and Editor/React state.
