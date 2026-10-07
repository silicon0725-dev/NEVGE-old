# LRC-2B | Runtime Policy Production Command Path

**Date:** 2026-08-13  
**Parent:** ARC-0001 | Kernel Independence Contract  
**Stage:** LRC-2B  
**Status:** COMPLETE / CERTIFIED AS PART OF LRC-2 FREEZE

## 1. Purpose

LRC-2A established the versioned Runtime Policy schema, profile registry, Writer Authority registry, resolver and Scratch adapter seam without switching production UI behavior.

LRC-2B connects that foundation to the production Legacy Advanced Settings path without returning Runtime Policy ownership to Scratch/TurboWarp UI setters.

The production mutation path is now:

```text
Legacy Advanced Settings / future Tool
        ↓
LegacyAdvancedSettingsBridge
        ↓
RuntimePolicy Editor Client
        ↓
Engine Protocol Command
PatchRuntimePolicyDomain
        ↓
RuntimePolicyCommandExecutor
        ↓
Host resolves unique Writer Authority
        ↓
RuntimePolicyResolver
        ↓
ScratchRuntimePolicyAdapter.applyDomain()
        ↓
Scratch VM / Renderer backend setter
```

The Editor never receives or supplies `authorityId`.

## 2. New production identities

```text
Command Capability
ngvge.runtime-policy-command
version 1

Command Executor
ngvge.runtime-policy-command-executor@1

Runtime Client
ngvge.runtime-policy-client@1

Legacy Settings Bridge
ngvge.legacy-advanced-settings-bridge@1

Legacy Quarantine
ngvge.legacy-runtime-settings-quarantine@1
```

## 3. Command contract

Supported commands:

```text
PatchRuntimePolicyDomain
ApplyRuntimePolicyProfile
```

`PatchRuntimePolicyDomain` accepts only:

```text
domain
patch
```

It explicitly rejects Editor-supplied `authorityId` and backend/legacy identity such as:

```text
vm
renderer
scratchTarget
backendHandle
opsPerFrame
miscLimits
stageWidth / stageHeight
_twconfig_
```

Writer Authority is resolved only inside the command executor through the existing Runtime Policy Authority Registry.

## 4. Commit rule

A Runtime Policy mutation is not committed merely because the DTO validates.

```text
current policy
    ↓
resolve candidate under Writer Authority
    ↓
apply candidate to Compatibility Backend
    ↓
backend apply succeeds
    ↓
commit currentPolicy = candidate
```

If backend application fails, the candidate is not committed and a ProtocolError is returned.

`ApplyRuntimePolicyProfile` also performs best-effort compensation for already-applied backend domains if a later domain fails.

## 5. Legacy Advanced Settings mapping

### Runtime Policy-owned

| Legacy control | NGVGE owner | Backend projection |
|---|---|---|
| Framerate | ExecutionProfile | `vm.setFramerate` |
| Interpolation | PresentationProfile / `scratch.sprite.transform` | `vm.setInterpolation` |
| High Quality Pen | PresentationProfile.renderQuality | `renderer.setUseHighQualityRender` |
| Infinite Clones | RuntimeSafetyPolicy.cloneBudget | bounded `maxClones` |
| Fencing | ScratchCompatibilityProfile.fencing | legacy runtime option |
| Remove Limits | explicit Scratch compatibility bundle | legacy `miscLimits` only inside adapter |
| Offscreen Drawable Culling | BackendHintSet | backend runtime option |
| Disable Compiler | ExecutionBackendPolicy | compiler enabled/disabled backend projection |

`miscLimits` is therefore not restored as Native Policy identity. The adapter collapses explicit compatibility fields to that legacy backend boolean only at the Scratch compatibility boundary.

## 6. Clone safety containment

The Legacy `Infinite Clones` checkbox no longer receives unbounded authority.

```text
Legacy checkbox intent
        ↓
cloneBudget.mode = legacy-unbounded-request
        ↓
hostHardCeiling
        ↓
finite Scratch backend maxClones
```

The Legacy UI reflects the policy request rather than testing whether the backend value is literally `Infinity`.

## 7. Explicit quarantine

The following controls are deliberately not promoted into Native Runtime Policy:

```text
OpsPerFrame
Warp Timer
Stage Size
Legacy storeProjectOptions()
```

They are hidden behind `ngvge.legacy-runtime-settings-quarantine@1` in the bridge.

This is temporary containment, not their final architecture:

- OpsPerFrame remains a Legacy scheduler hack pending retirement/quarantine work.
- Warp Timer remains a Legacy runtime/compiler safety control pending final Safety ownership/UX retirement.
- Stage Size belongs to Project/Scene geometry schema.
- `storeProjectOptions()` remains Legacy `_twconfig_` persistence and is handled by LRC-3/LPL boundaries later.

## 8. Production installation

`vm-listener-hoc` installs the Runtime Policy service once per Scratch Runtime.

The Runtime receives a non-enumerable public client facade at:

```text
runtime.ngvgeRuntimePolicy
```

This facade exposes command/query client behavior only. Resolver/Authority/adapter Host state remains in closure-owned service internals.

## 9. LRC-2 DoD assessment after 2B

Semantic DoD is implemented:

- versioned Runtime Policy schema: PASS
- Execution / Presentation / Safety / Compatibility separation: PASS
- Simulation / Presentation independence: PASS
- one Writer Authority per domain: PASS
- Scratch backend consumes Policy through Adapter: PASS
- Settings component direct VM/Renderer Runtime Policy writers: REMOVED
- OpsPerFrame absent from Native Policy: PASS
- miscLimits absent from Native Policy: PASS
- Stage Size absent from Runtime Policy: PASS
- compiler toggle runtime-only: PASS
- backend handles absent from Policy DTO: PASS
- cumulative conformance gate: PASS

This slice is now certified as part of the final LRC-2 Freeze. The repository-wide `npm run build:dev` completed on the final certification tree with exit code `0`. See `LRC-2-CERTIFICATION-FREEZE.md`.
