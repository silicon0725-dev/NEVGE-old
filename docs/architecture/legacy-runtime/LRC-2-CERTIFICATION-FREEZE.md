# LRC-2 | Runtime Policy Foundation Certification / Freeze

**Parent:** ARC-0001 | Kernel Independence Contract  
**Milestone:** LRC-2 | Execution / Presentation / Safety Profile Foundation  
**Date:** 2026-08-13  
**Status:** **COMPLETE / CERTIFIED / ARCHITECTURE FROZEN**

## 1. Decision

LRC-2 is complete and frozen.

The milestone established NGVGE-owned Runtime Policy semantics and moved the Legacy Advanced Settings Runtime Policy writers behind the production Engine Protocol / Writer Authority / Compatibility Adapter path.

Final certification result:

```text
LRC-2 machine DoD                         12 / 12 PASS
LRC-2 focused Runtime Policy tests        4 suites / 21 tests PASS
ARC-C001.1 minimum baseline               7 / 7 PASS
0009-E Transform DoD                      12 / 12 PASS
Permanent Regression                     19 / 19 PASS
Unit / Node environment                   85 suites / 444 tests PASS
Unit / DOM harness                         3 suites / 26 tests PASS
Unit total                                88 suites / 470 tests PASS
Integration                                3 suites / 4 tests PASS
Smoke                                      1 suite / 1 test PASS
Runtime Node Public Boundary              PASS
Runtime Component / Service Facade        PASS
TypeScript strict/noEmit scope            PASS
ESLint correctness                        PASS
Workspace CSS/PostCSS cumulative gates    PASS
Real repository Webpack build:dev         PASS / exit code 0
Active Architecture Waivers               0 for LRC-2
```

The previous LRC-2B Webpack evidence hold is resolved. The repository-wide `npm run build:dev` completed on the final certification tree and returned exit code `0`.

## 2. Frozen semantic ownership

The following identities are now part of the LRC-2 frozen contract:

```text
Runtime Policy Set
ngvge.runtime-policy-set@1

Profile Registry
ngvge.runtime-policy-profile-registry@1

Resolver
ngvge.runtime-policy-resolver@1

Runtime Policy Command Capability
ngvge.runtime-policy-command / version 1

Command Executor
ngvge.runtime-policy-command-executor@1

Runtime Client
ngvge.runtime-policy-client@1

Scratch Compatibility Adapter
ngvge.scratch-runtime-policy-adapter@1

Presenter Capability Schema
ngvge.presenter-capability/v1

Legacy Advanced Settings Bridge
ngvge.legacy-advanced-settings-bridge@1

Legacy Runtime Settings Quarantine
ngvge.legacy-runtime-settings-quarantine@1
```

Later stages may extend these contracts through explicit versioning or adapters, but must not silently weaken their ownership boundaries.

## 3. Certified LRC-2 Definition of Done

The executable certification entrypoint is:

```text
node scripts/validate-lrc2-runtime-policy-certification.js
```

It certifies twelve requirements:

1. Runtime Policy has a versioned NGVGE-owned Schema.
2. Execution, Presentation, Safety and Scratch Compatibility are separate semantic domains.
3. Simulation tick and presentation refresh are independent.
4. Every Runtime Policy domain has exactly one Writer Authority.
5. Scratch consumes Runtime Policy through the Compatibility Adapter.
6. Legacy Advanced Settings no longer directly owns Runtime Policy VM/Renderer mutation.
7. `OpsPerFrame` is not a Native Runtime Policy field.
8. `miscLimits` is not a Native Runtime Policy field.
9. Stage geometry is outside Runtime Policy.
10. Execution backend/compiler overrides and backend hints remain runtime-only.
11. Runtime Policy DTOs reject Scratch/backend-private handles and legacy mixed transport identity.
12. LRC-2 has cumulative certification and real Webpack freeze gates.

Machine-readable evidence is stored in:

```text
docs/architecture/legacy-runtime/LRC-2-RUNTIME-POLICY-CERTIFICATE.json
```

## 4. Frozen Policy model

The top-level semantic model remains:

```text
RuntimePolicySet
│
├── ExecutionProfile
├── PresentationProfile
├── RuntimeSafetyPolicy
├── ScratchCompatibilityProfile
├── ExecutionBackendPolicy        runtime-only
└── BackendHintSet                runtime-only
```

Project/Scene geometry is not part of Runtime Policy.

Project persistence contains only:

```text
schemaVersion
profileId
execution
presentation
safety
scratchCompatibility
```

`executionBackend` and `backendHints` are stripped from project persistence.

## 5. Simulation / Presentation separation

LRC-2 freezes this relation:

```text
Simulation Tick Rate
        ≠
Presentation Refresh Policy
```

A profile may therefore express, for example:

```text
Simulation: 30 Hz
Presentation: display refresh
```

without silently changing Scratch simulation cadence.

Legacy Scratch interpolation is capability-scoped to:

```text
scratch.sprite.transform
```

with:

```text
supportsInterpolation = true
supportsResampling = false
```

It does not mean the whole project, Pen, Stamp, custom drawables, 3D, or extension-defined renderer state support resampling.

## 6. Authority and production mutation path

The frozen production path is:

```text
Settings / Tool
      ↓
Runtime Policy Command DTO
      ↓
RuntimePolicyCommandExecutor
      ↓
Host resolves unique Writer Authority
      ↓
RuntimePolicyResolver
      ↓
ScratchRuntimePolicyAdapter
      ↓
Scratch Compatibility Backend setter
```

Editor-side code does not receive or submit Writer `authorityId`.

A candidate Policy is committed only after backend application succeeds. Backend application failure leaves the previously committed Policy authoritative.

## 7. Legacy Advanced Settings containment

The Legacy Advanced Settings Runtime Policy-owned controls are now routed through the Runtime Policy bridge:

```text
Framerate
Interpolation
High Quality Render
Clone Budget
Fencing
explicit compatibility limit bundle
Compiler backend override
Offscreen drawable culling hint
```

Legacy `Infinite Clones` is frozen as a compatibility request, not unbounded authority:

```text
legacy-unbounded-request
        ↓
hostHardCeiling
        ↓
finite backend maxClones
```

`miscLimits` is allowed only as a Scratch backend projection of explicit compatibility fields. It is not a Native NGVGE field.

## 8. Explicitly not claimed by this Freeze

LRC-2 does **not** claim that every Legacy runtime ingress in the 02/TurboWarp fork has already been migrated through Runtime Policy.

The following Legacy sources remain intentionally for LRC-3 containment and precedence work:

```text
_twconfig_
legacy URL/runtime parameter ingress
Green Flag / shortcut FPS gestures
legacy tw-state-manager initialization
other legacy direct VM callers
legacy project-option import/export
```

Their existence does not make them NGVGE Runtime Policy Authority. LRC-3 must translate them at the Compatibility boundary and define explicit precedence.

The following controls also remain outside Native Runtime Policy by design:

```text
OpsPerFrame
Warp Timer
Stage width / height
legacy storeProjectOptions transport
```

Ownership remains deferred as follows:

- `OpsPerFrame` -> Legacy scheduler quarantine / retirement.
- Warp Timer -> Runtime Safety / compiler watchdog containment.
- Stage geometry -> versioned Project/Scene viewport schema.
- `_twconfig_` / legacy project options -> LRC-3 import/export compatibility boundary.

## 9. Freeze rules for future stages

After this Freeze, later work must not:

```text
add opsPerFrame to RuntimePolicySet
add miscLimits to RuntimePolicySet
add stageWidth/stageHeight to RuntimePolicySet
persist compiler/backend override as normal project gameplay semantics
merge simulation tick with presentation refresh
claim project-wide interpolation from Scratch transform interpolation
let Editor/Settings supply Writer Authority identity
let a new Settings UI call Runtime Policy VM/Renderer setters directly
store Scratch Target / renderer / VM / private backend handles in Policy DTOs
make _twconfig_ Native NGVGE authority
```

If a future requirement needs a semantic change to the frozen Policy contract, it requires an explicit Architecture Record / schema version change rather than an in-place compatibility hack.

## 10. Executable gates

Cumulative semantic/regression certification:

```text
npm run test:legacy-containment:lrc2-certification
```

Full freeze gate including the real repository Webpack entry:

```text
npm run test:legacy-containment:lrc2-freeze
```

The freeze gate is defined as the cumulative Certification Gate followed by:

```text
npm run build:dev
```

The final certification run executed the same constituent gates and the final repository Webpack build returned exit code `0`.

## 11. Governance consequence

Current state:

```text
LRC-1   COMPLETE / AUDIT FREEZE
LRC-2A  COMPLETE / certified as part of LRC-2
LRC-2B  COMPLETE / certified as part of LRC-2
LRC-2   COMPLETE / CERTIFIED / ARCHITECTURE FROZEN
```

The next engineering stage is now:

```text
LRC-3 | Legacy Runtime Settings Compatibility Adapter
```

LRC-3 may consume the frozen Runtime Policy contract, but must not redefine it merely to preserve Legacy `_twconfig_`, URL settings, Green Flag gestures, or other old ingress behavior.
