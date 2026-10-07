# WS-9F | Project / Resource Capability Provider Foundation

Status: COMPLETE / VERIFIED  
Authority: ARC-0001  
Baseline: WS-9E COMPLETE / VERIFIED

## Purpose

WS-9E established a generic runtime Provider Registry and deliberately left Project/Resource capability surfaces explicit rather than fabricating backend-specific implementations.

WS-9F fills the safe portion of those gaps:

```text
ProjectLifecycleHost + Workspace Context
        ↓
portable Project read Provider

Global Asset Database
        ↓
canonical ResourceId seam
        ↓
portable Resource read Provider
        ↓
bounded Resource command Provider
```

Project mutation remains unavailable because NGVGE does not yet have a stable native Project Command Authority that can satisfy ARC-0001 without promoting Scratch project payloads or `vm.loadProject()` into Workspace semantics.

The goal is therefore not "make every Provider green". The goal is to make every capability state truthful, portable, and authority-safe.

## Stable identities

Capability facade identities:

- `ngvge.workspace-project-read-capability@1`
- `ngvge.workspace-project-command-capability@1`
- `ngvge.workspace-resource-read-capability@1`
- `ngvge.workspace-resource-command-capability@1`

Provider identities:

- `ngvge.workspace-capability-provider.project-read`
- `ngvge.workspace-capability-provider.project-command.propose`
- `ngvge.workspace-capability-provider.project-command.mutate`
- `ngvge.workspace-capability-provider.resource-read`
- `ngvge.workspace-capability-provider.resource-command.propose`
- `ngvge.workspace-capability-provider.resource-command.mutate`

Portable schema versions:

- Workspace Project Snapshot v1
- Workspace Resource Descriptor v1
- Workspace Resource Command v1

## Canonical Resource identity

Before WS-9F the Global Asset Database already had an internal record identity:

```text
asset:<uuid>
```

That identity is an implementation/database compatibility key. It is not an ARC stable ResourceId and must not cross the Workspace capability boundary as semantic identity.

WS-9F advances the Global Asset persistence schema to **v3** and introduces a distinct persistent canonical identity:

```text
ngvge:resource:<opaque-token>
```

Each Global Asset record now owns both roles:

```text
record.id
= asset:*                         // database/internal compatibility key

record.resourceId
= ngvge:resource:*               // NGVGE semantic Resource identity
```

New records receive a canonical ResourceId immediately. Legacy v2 serialized Global Asset records that do not contain one remain readable, receive a canonical ResourceId during deserialization, and are persisted as v3 on subsequent serialization.

Replacing the runtime content backing an existing Global Asset preserves its `resourceId`.

The Asset Manager now projects `selectedAsset.resourceId` into Workspace Context rather than projecting the internal Global Asset database ID.

Workspace Context's Resource domain also rejects non-canonical Resource IDs. This prevents a later consumer from silently re-promoting `asset:*`, Scratch asset IDs, costume objects, or renderer handles into NGVGE Resource identity.

## Project read Provider

`project-read#query` is backed by:

```text
WorkspaceContextService
+
ProjectLifecycleHost
```

The Tool-visible snapshot is intentionally narrow:

```text
schemaVersion
projectId
lifecycle
  hostId
  phase
  projectGeneration
  activeOperation
```

The current `projectId` remains the WS-9C session-scoped Project Context identity:

```text
ngvge.project-context.gN
```

It is **not** claimed to be the future Persistent Project Model's canonical ProjectId.

The Provider does not expose:

- Scratch project JSON;
- `vm.serializeProjectJSON()`;
- `vm.loadProject()`;
- Scratch Target objects;
- VM or Renderer handles;
- raw Project backend payloads.

This makes Project read useful for Tool context/lifecycle awareness without pretending that the current Scratch project container is NGVGE's stable Project semantic model.

## Project command Provider

WS-9F registers both Project command surfaces so diagnostics can report their true state:

```text
project-command#propose
project-command#mutate
```

Both are intentionally:

```text
provider-unavailable
```

with diagnostic:

```text
NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY
```

The registry therefore knows that an implementation slot exists, but binding fails closed.

WS-9F explicitly rejects this shortcut:

```text
Workspace Project Command
        ↓
vm.loadProject / serializeProjectJSON / Scratch payload mutation
```

A later stage must establish a native transaction-safe Project Command Host before these surfaces can become READY.

## Resource read Provider

`resource-read#query` resolves a canonical ResourceId against the existing Resource authority seam and returns a portable descriptor.

Image descriptor fields:

```text
schemaVersion
resourceId
kind = image
name
dataFormat
folderId
referenceCount
bitmapResolution
rotationCenterX
rotationCenterY
```

Sound descriptor fields:

```text
schemaVersion
resourceId
kind = sound
name
dataFormat
folderId
referenceCount
rate
sampleCount
```

The Tool-visible Resource descriptor strips internal/backend fields such as:

```text
id               // asset:* internal DB key
assetId          // Scratch storage identity
md5ext
asset            // runtime asset object
skinId
soundId
backend handle
```

The Resource database may retain those implementation fields internally, but Provider normalization prevents them from crossing the Tool capability facade.

## Resource command Provider

WS-9F intentionally exposes only a bounded metadata command vocabulary:

```text
rename
move
delete
```

All commands are addressed by canonical ResourceId.

### Proposal surface

`resource-command#propose` validates and normalizes a command without mutating the Resource authority.

Unknown fields and unsupported command kinds fail closed. In particular, WS-9F does not accept binary replacement, raw asset objects, Scratch costume/sound objects, renderer handles, or backend handles.

### Mutation surface

`resource-command#mutate` performs:

```text
ResourceId
    ↓
Resource authority resolves internal record
    ↓
existing database history/perform seam
    ↓
rename / move / delete
```

The internal `asset:*` ID is resolved only inside the trusted Provider implementation. It never becomes the Tool command identity.

A move to a non-null folder requires that folder to exist in the current Resource authority. A missing ResourceId or folder fails visibly before mutation.

Binary data replacement is deliberately outside WS-9F. Paint/IDE/resource editors will require an explicit content-edit transaction contract rather than reusing this metadata command facade.

## Capability descriptor surface uniqueness

WS-9F corrects a WS-9A assumption that one descriptor could request a capability only once.

Command capabilities legitimately need both:

```text
resource-command#propose
resource-command#mutate
```

Therefore descriptor uniqueness is now defined by:

```text
capabilityId + access
```

rather than by `capabilityId` alone.

Duplicate exact surfaces still fail closed; distinct access surfaces remain independently admitted and revocable.

## Provider availability

Project/Resource providers remain dynamic Provider Registry entries.

Examples:

```text
ProjectLifecycleHost present
→ project-read READY

Project Command Host absent
→ project-command PROVIDER_UNAVAILABLE

Resource authority present
→ resource-read READY
→ resource-command READY when command/history seam is complete

Resource authority disappears
→ existing binding's next facade call fails closed
```

Provider readiness is not cached forever at bind time. The WS-9E dynamic availability guard remains in force.

## Production bootstrap

The GUI supplies the core Provider Registry with existing authority seams:

```text
ProjectLifecycleHost
Global Asset Database getter
```

The Resource database is obtained lazily through the existing Global Asset database installation/lookup seam. The Provider Registry does not become its owner and does not receive authority to mutate arbitrary Scratch/runtime state.

## Explicit non-goals

WS-9F does not:

- create a native Project Command Host;
- expose Scratch project JSON as Project semantics;
- expose `vm.loadProject()` or VM setters to Tools;
- make the session `ngvge.project-context.gN` identity a persistent ProjectId;
- expose `asset:*` as ResourceId;
- expose Scratch asset IDs, costumes, sounds, raw asset objects, renderer objects, or backend handles;
- provide Resource binary/content replacement;
- activate Paint or Terminal;
- add filesystem, process, network, browser, or credential capabilities;
- transfer Project/Resource writer authority into Workspace Context or Provider Registry.

## Definition of Done

- [x] Global Asset persistence schema advances to v3 for canonical ResourceId;
- [x] canonical `ngvge:resource:*` ResourceId exists and persists for Global Asset records;
- [x] legacy Global Asset records without ResourceId migrate visibly into canonical identity;
- [x] internal `asset:*` remains implementation identity only;
- [x] Resource Context projection uses canonical ResourceId;
- [x] Workspace Context rejects non-canonical ResourceId;
- [x] `project-read#query` has a portable Provider facade;
- [x] Project read does not expose Scratch/backend payloads;
- [x] `project-command#propose|mutate` are registered but fail closed as provider-unavailable;
- [x] `resource-read#query` returns portable Resource descriptors;
- [x] Resource descriptors exclude internal/backend identity and objects;
- [x] `resource-command#propose` validates a bounded command schema;
- [x] `resource-command#mutate` resolves ResourceId internally and uses the existing Resource history seam;
- [x] invalid Resource/folder targets fail visibly before mutation;
- [x] descriptor uniqueness supports independent propose/mutate surfaces;
- [x] Resource provider availability is dynamically rechecked;
- [x] Provider Registry remains non-authoritative;
- [x] Terminal/Paint remain PLANNED / UNADMITTED;
- [x] cumulative architecture/containment/regression gates remain protected.

## Resume point

WS-9F establishes safe Project query and Resource query/metadata-command surfaces, while making the missing Project mutation authority explicit.

The recommended next stage is:

```text
WS-9G | Project Command Host & Transaction Foundation
```

That stage should resolve the remaining `project-command` provider-unavailable surface with a native, transaction-safe NGVGE Project command contract rather than a Scratch payload shortcut.
