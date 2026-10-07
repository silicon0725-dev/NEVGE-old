# COL-0 | Stable Semantic Collaboration Boundary

Status: COMPLETE / VERIFIED

## Purpose

COL-0 separates NGVGE collaboration semantics from the existing PeerJS/Scratch collaboration backend. The network/CRDT/peer implementation remains replaceable transport. Stable NGVGE identity and mutations use NodeId, versioned portable operations, Engine Commands, Project Lifecycle Host and Extension Hosts.

## Stable identities

- `ngvge.collaboration-semantic-host@1`
- `ngvge.collaboration-semantic-client@1`
- `ngvge.collaboration-operation/v1`
- Authority domain: `ngvge.collaboration.semantic`
- Writer: `authority:ngvge.collaboration-semantic-host`

## Boundary

```text
Legacy Peer / future CRDT transport
        |
        | legacy payload normalization
        v
Collaboration Semantic Host
        |
        +-- NodeId -> Runtime Node Command
        +-- NodeId -> Transform2D Command
        +-- Project bytes -> Project Lifecycle Host
        +-- Extension descriptor/id -> Scratch Extension Host
        |
        v
Compatibility adapters / replaceable backends
```

A collaboration semantic operation is protocol-portable plain data and explicitly rejects `target`, `targetId`, `targetRuntimeId`, `bindingId`, `vm`, `renderer` and `extensionManager` fields.

## Node identity

Scratch `target.id` is volatile local backend identity. COL-0 obtains stable NodeId through `ngvge.scratch-sprite-node-adapter`. Current legacy wire messages may carry both `nodeId` and `targetId`; NodeId is primary, while targetId is a compatibility shadow for older peers. The semantic operation DTO itself never contains targetId.

Remote rename/delete/transform operations are routed to existing Runtime Node / Transform2D command capabilities. Visibility and rotationStyle remain explicit Scratch compatibility fallbacks because a native Renderable command is not yet available.

## Project lifecycle

Project stream serialization/loading explicitly calls `ngvge.project-lifecycle-host@1`. Legacy JSON synchronization no longer copies a remote Scratch target runtime id into local project data. `targetInfo.id` survives only as old-peer mapping metadata; `targetInfo.nodeId` and `currentEditingNodeId` carry stable identity.

## Extension containment

Collaboration no longer reads or mutates `extensionManager`, `_loadedExtensions`, `loadExtensionURL`, `loadExtensionIdSync` or `reorderExtension` directly. Scratch Extension Host now provides observable load/unload/reorder operations, and Collaboration consumes that Host.

## Transport independence

COL-0 semantic modules contain no PeerJS connection/session objects. PeerJS remains the current transport backend. A future CRDT backend must translate into the same semantic operation boundary rather than defining NodeId, ResourceId, project lifecycle or extension authority.

## Explicit remaining debt

Blocks, costume/sound/index-based assets, old target-id mapping, presence target naming, and visibility/rotationStyle compatibility are recorded in `COL-0-legacy-collaboration-debt-matrix.csv`; they are not treated as native collaboration semantics.


## Verification

COL-0 is verified by `npm run test:collaboration:col0-certification`. The production module-resolution gate is `npm run test:collaboration:col0-webpack`, which compiles the real `src/lib/collaboration-service.js` entry through `webpack.config.js[0]`.

Certification must preserve LRC-G1, LPL-1, LEX-1, 0009-E, permanent regression, Unit, Integration, Smoke, TypeScript and correctness ESLint gates.
