# LRC-3 | Legacy Runtime Settings Compatibility Adapter

Status: COMPLETE / VERIFIED  
Parent: ARC-0001 | Kernel Independence Contract  
Depends on: LRC-2 | Runtime Policy Foundation — COMPLETE / CERTIFIED / ARCHITECTURE FROZEN

## 1. Purpose

LRC-3 removes Legacy Scratch/TurboWarp/02 runtime settings from the old implicit last-writer-wins model without changing the frozen Runtime Policy v1 schema.

The compatibility boundary is:

```text
Legacy source
  |_ _twconfig_
  |_ URL/session flags
  |_ Advanced Settings
  |_ Green Flag gestures
  |_ FPS/Turbo controls
  |_ Blocks mount defaults
        |
        v
LegacyRuntimeSettingsCompatibilityService
        |
        +--> per-key precedence resolver
        +--> LegacyScratchProjectOptionsAdapter
        +--> migration records + diagnostics
        |
        +--> Runtime Policy Command/Authority --> ScratchRuntimePolicyAdapter
        +--> Scheduler quarantine             --> Scratch backend
        +--> Runtime Safety quarantine        --> Scratch backend
        +--> Project/Scene viewport owner     --> Scratch backend
```

Scratch remains the compatibility backend. It does not own NGVGE Runtime Policy semantics.

## 2. Stable compatibility identities

```text
ngvge.legacy-runtime-settings-compatibility@1
ngvge.legacy-scratch-project-options-adapter@1
ngvge.legacy-runtime-precedence@1
ngvge.project-scene-viewport-compatibility@1
```

These are compatibility-layer identities. They do not replace Runtime Policy identities frozen by LRC-2.

## 3. Explicit precedence

Precedence is resolved independently for every semantic key:

```text
Native Project semantic policy          500
Legacy Project Import                   400
Explicit Session Override               300
Workspace / Device                      200
Backend Automatic                       100
```

Equal-precedence session sources use the latest explicit intent for the affected semantic key only. A source cannot overwrite unrelated keys.

Important consequence:

```text
URL says FPS = 144
Project _twconfig_ says FPS = 60
=> effective FPS = 60

User changes URL/session FPS intent to 120 while project is active
=> project remains effective at 60
=> session intent 120 is retained

Next project has no FPS claim
=> project claim is removed
=> session 120 resumes
```

This prevents a project-level compatibility option from erasing session preference while also preventing session controls from silently overriding project compatibility semantics.

## 4. _twconfig_ import boundary

The Scratch VM package still contains its historical `Runtime.parseProjectOptions()` and `Runtime.storeProjectOptions()` implementations, but NGVGE does not use either as an active authority.

`VMListener` installs `LegacyRuntimeSettingsCompatibilityService` before project use. The service shadows both Runtime instance entry points: `parseProjectOptions` becomes the NGVGE compatibility importer, while `storeProjectOptions` becomes the explicit NGVGE Legacy export adapter.

The active path is therefore:

```text
Scratch project targets installed
        |
        v
runtime.parseProjectOptions()
        |
        v
NGVGE LegacyScratchProjectOptionsAdapter
        |
        +--> parse ExtendedJSON
        +--> construct migration records
        +--> emit diagnostics
        +--> submit semantic source claims
        +--> resolve precedence
        +--> route to domain owner
```

The parser itself does not directly call Runtime Policy setters.

The historical export entry is similarly contained:

```text
runtime.storeProjectOptions()
        |
        v
NGVGE explicit Legacy export adapter
        |
        +--> serialize compatibility view
        +--> write/update _twconfig_ comment only for explicit Legacy export
```

This keeps import and export compatibility behind one owner and prevents a second `_twconfig_` writer from surviving beside the NGVGE adapter.

## 5. Frozen migration rules

| Legacy field | LRC-3 owner | Result |
|---|---|---|
| `framerate` | ExecutionProfile | `execution.simulationTickRate`; non-30 emits compatibility diagnostic |
| `opsPerFrame` | Legacy scheduler quarantine | `1` is dropped as default; non-default remains quarantined |
| `turbo` | ExecutionProfile | `execution.legacyScratchTurboMode` |
| `interpolation` | PresentationProfile | Scratch transform interpolation capability; refresh is independent |
| `hq` | Presentation + Scratch Compatibility | render quality plus Pen-size compatibility split |
| `runtimeOptions.maxClones` | RuntimeSafetyPolicy | finite budget or bounded legacy-unbounded request |
| `runtimeOptions.fencing` | ScratchCompatibilityProfile | explicit fencing semantic |
| `runtimeOptions.miscLimits` | ScratchCompatibilityProfile | expanded into explicit compatibility fields |
| `runtimeOptions.offscreenDrawableCulling` | BackendHintSet | runtime-only backend hint |
| `width` / `height` | Project/Scene viewport compatibility | explicitly outside RuntimePolicy |

Warp Timer and compiler override are not imported from `_twconfig_` into Native project semantics. Their live Legacy ingress remains routed to runtime safety quarantine / runtime-only execution backend ownership.

## 6. HQ + miscLimits split

Legacy `hq` is not treated as only a renderer-quality toggle. Historical behavior also relaxes the effective Pen size restriction. LRC-3 therefore maps it across two explicit semantic domains:

```text
hq = true
  |_ Presentation.renderQuality = high
  |_ ScratchCompatibility.penSizeLimits = false
```

`miscLimits` continues to map the other explicit Scratch compatibility fields. If Remove Limits is disabled while HQ remains enabled, Pen-size compatibility stays relaxed so the explicit policy still describes the actual Scratch backend behavior.

This is a compatibility projection correction over the existing frozen LRC-2 schema; it does not add a new field or Writer Authority.

## 7. Clone safety

Legacy:

```text
maxClones = Infinity
```

maps to:

```text
CloneBudget.mode = legacy-unbounded-request
CloneBudget.requestedLimit = null
```

The Scratch backend receives a finite value bounded by `hostHardCeiling`. Legacy Infinity remains compatibility intent, never actual unbounded authority.

## 8. Fail-visible behavior

Unknown or unrepresentable Legacy fields are not silently ignored.

Each field produces a migration record with an explicit owner/status. Unknown fields additionally emit error diagnostics, including nested unknown `runtimeOptions` fields.

Examples:

```text
futureLegacyFlag
=> status: unsupported
=> owner: unresolved
=> diagnostic severity: error

runtimeOptions.futureRuntimeFlag
=> status: unsupported
=> owner: unresolved
=> diagnostic severity: error
```

Legacy URL values that cannot be represented by frozen Runtime Policy v1, such as non-positive FPS or clone limits, are rejected visibly by the existing URL validation surface rather than becoming silent no-ops.

## 9. Explicit Legacy export only

Native Runtime Policy mutation does not regenerate `_twconfig_`.

The historical `vm.storeProjectOptions()` call has been removed from first-party active source paths. `_twconfig_` generation now exists only behind:

```text
LegacyRuntimeSettingsCompatibilityService
  .exportLegacyProjectOptionsToProject()
```

and returns:

```text
explicitLegacyExport: true
```

This preserves intentional Scratch/TurboWarp/02 compatibility export while preventing `_twconfig_` from becoming NGVGE's internal project authority.

## 10. Production ingress migration

The following first-party sources now consume `LegacyRuntimeSettingsCompatibilityService` instead of owning direct VM Runtime settings mutation:

```text
src/lib/tw-state-manager-hoc.jsx
src/containers/controls.jsx
src/containers/tw-framerate-changer.jsx
src/containers/turbo-mode.jsx
src/containers/blocks.jsx
src/lib/runtime-policy/legacy-advanced-settings-bridge.js
```

Direct Scratch backend setter use is constrained to compatibility/backend owner implementations.

## 11. LRC-2 frozen-contract compatibility

LRC-3 does not add any of the following to Runtime Policy v1:

```text
opsPerFrame
miscLimits
stageWidth
stageHeight
_twconfig_
Scratch Target
renderer object
backend/private handle
```

LRC-2 command/certification validators were updated only where they previously depended on quarantine code being physically located inside `legacy-advanced-settings-bridge.js`. The strengthened checks now require both:

1. Advanced Settings delegates to compatibility ownership; and
2. the compatibility owner explicitly retains the quarantine/backend projection.

The semantic requirement is unchanged.

## 12. Verification gates

Focused cumulative gate:

```text
npm run test:legacy-containment:lrc3-adapter
```

Full stage gate including real Webpack:

```text
npm run test:legacy-containment:lrc3
```

The focused gate includes the complete LRC-2 certification chain before LRC-3 validation/tests. The full stage gate additionally compiles the real `src/playground/editor.jsx` entry with `webpack.config.js[0]` using the production Babel/resolve/module rules. HTML generation, static copying and unrelated entries are excluded from the smoke so the evidence is scoped to executable Editor source rather than packaging throughput.

## 13. LRC-3 DoD mapping

- `_twconfig_` parser does not directly call Runtime setters: implemented.
- All old configuration fields route to explicit owners: implemented for the frozen LRC-3 inventory.
- Every Legacy field has a migration record: implemented.
- Unsupported/partial behavior produces diagnostics: implemented.
- Native project mutation does not regenerate `_twconfig_`: implemented.
- Legacy export is explicit compatibility-only behavior: implemented.
- Unknown Legacy fields fail visibly: implemented.

## 14. Boundary to LRC-4

LRC-3 answers:

> Where does a Legacy runtime setting belong, which source wins, and how is it migrated?

LRC-4 will answer:

> Given the resulting execution/presentation/compatibility policy and project contents, can the project actually be represented safely and faithfully?

LRC-4 therefore owns Compatibility Analyzer, visual-domain capability diagnostics and representative Scratch compatibility corpus analysis. LRC-3 must not attempt to turn migration diagnostics into project-level visual compatibility claims.
