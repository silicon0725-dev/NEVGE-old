# LRC-2A | Runtime Policy Foundation

**Status:** COMPLETE / CERTIFIED AS PART OF LRC-2 FREEZE  
**Parent:** ARC-0001 | Kernel Independence Contract  
**Stage:** LRC-2 | Execution / Presentation / Safety Profile Foundation

Final milestone certification: `LRC-2-CERTIFICATION-FREEZE.md`.

## Intent

Establish NGVGE-owned Runtime Policy identity before migrating any production Legacy Advanced Settings writer. Scratch/02/TurboWarp remains a Compatibility Backend and may only consume resolved policy through an adapter seam.

## Implemented contracts

- `ngvge.runtime-policy-set@1`
- `ngvge.runtime-policy-profile-registry@1`
- `ngvge.runtime-policy-resolver@1`
- `ngvge.scratch-runtime-policy-adapter@1`
- `ngvge.presenter-capability/v1`

`RuntimePolicySet` separates:

- ExecutionProfile
- PresentationProfile
- RuntimeSafetyPolicy
- ScratchCompatibilityProfile
- ExecutionBackendPolicy (runtime-only)
- BackendHintSet (runtime-only)

Project/Scene geometry is deliberately absent.

## Frozen LRC-1 mapping preserved

- Scratch-compatible simulation defaults to 30 Hz.
- Presentation refresh is independent from simulation tick.
- `OpsPerFrame` is rejected as a Native Runtime Policy field.
- `miscLimits` is rejected as a Native Runtime Policy field.
- Stage width/height is rejected from Runtime Policy.
- Compiler/backend overrides are runtime-only, not ordinary project semantics.
- Offscreen drawable culling is a runtime-only backend hint.
- Clone budgets are always finite at application time; a legacy unbounded request is capped by a host hard ceiling.
- Legacy interpolation is represented only as capability for `scratch.sprite.transform`, never as project-wide resampling support.

## Authority

Each Runtime Policy domain receives exactly one Writer Authority through the generic ARC-C001.1 Authority Registry. Resolver domain patches must present the registered Writer Authority ID or fail closed.

## Persistence

`toProjectRuntimePolicyDTO()` persists only Execution, Presentation, Safety, and Scratch Compatibility. Execution Backend and Backend Hints are stripped from the project DTO.

Policy DTO validation rejects backend/private handles and legacy mixed fields including `vm`, `renderer`, Scratch Target handles, `_twconfig_`, `opsPerFrame`, `miscLimits`, and stage geometry.

## Scratch Adapter seam

`ScratchRuntimePolicyAdapter` currently maps only the explicitly safe LRC-2 foundation subset:

- `ExecutionProfile.simulationTickRate` -> `vm.setFramerate`
- transform-domain presentation policy -> `vm.setInterpolation`
- `RuntimeSafetyPolicy.cloneBudget` -> bounded `maxClones`
- `ScratchCompatibilityProfile.fencing` -> Scratch runtime option

It deliberately does not map `OpsPerFrame`, `miscLimits`, compiler overrides, HQ render, or backend hints.

## Production behavior switch

None in LRC-2A. `tw-settings-modal` remains the legacy writer temporarily. This is intentional: the Handoff requires the schema + resolver + adapter seam to exist before migrating Advanced Settings behavior.

## Verification

Run:

```text
node scripts/validate-lrc2-runtime-policy-foundation.js
node ./node_modules/jest/bin/jest.js --runInBand \
  test/unit/lib/runtime-policy/runtime-policy-foundation.test.js \
  test/unit/lib/runtime-policy/scratch-runtime-policy-adapter.test.js
```

## Remaining LRC-2 work

- Introduce Runtime Policy command/service ownership in production runtime integration.
- Migrate Legacy Advanced Settings writers to Runtime Policy commands.
- Remove direct VM/Renderer setter ownership from Settings UI.
- Add cumulative conformance package script and full baseline evidence.
- Certify LRC-2 DoD before entering LRC-3 compatibility import/export migration.
