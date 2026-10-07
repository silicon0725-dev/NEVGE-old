# LRC-G1 | Runtime Policy Containment Certification

Status: PASS / CERTIFIED  
Architecture Parent: ARC-0001 | Kernel Independence Contract  
Certified: 2026-08-13

Depends on:
- LRC-2 | Execution / Presentation / Safety Profile Foundation — COMPLETE / CERTIFIED / ARCHITECTURE FROZEN
- LRC-3 | Legacy Runtime Settings Compatibility Adapter — COMPLETE / VERIFIED
- LRC-4 | Compatibility Analyzer & Presentation Capability Diagnostics — COMPLETE / VERIFIED

## 1. Gate statement

LRC-G1 certifies the containment statement frozen by the Legacy Runtime master plan:

```text
Scratch compatibility execution rate is independent from presentation refresh;
Pen/renderer limitations are detected, not hidden.
```

This is an end-to-end certification across Runtime Policy ownership, Legacy migration/precedence, Scratch backend projection and compatibility diagnostics. It is not a new Runtime feature stage.

## 2. Certified production path

```text
Settings / Legacy ingress / Future Tool
        |
        +--> Runtime Policy Command
        |       |
        |       v
        |    Host Writer Authority
        |       |
        |       v
        |    RuntimePolicyResolver
        |       |
        |       v
        |    ScratchRuntimePolicyAdapter
        |
        +--> LegacyRuntimeSettingsCompatibilityService
        |       |
        |       +--> per-key precedence
        |       +--> migration records / diagnostics
        |       +--> scheduler/safety/viewport quarantine owners
        |
        +--> RuntimeCompatibilityService (query only)
                |
                +--> Project semantic scan
                +--> Presenter capability registry
                +--> Backend capability scan
                +--> Legacy precedence snapshot
                |
                v
           CompatibilityReport
```

Scratch remains a Compatibility Backend. None of these paths transfer NGVGE semantic ownership to Scratch VM, Scratch Renderer, `_twconfig_`, a UI component or a backend-private object.

## 3. Certified invariants

### 3.1 Simulation and Presentation are independent

The production command/adapter path was exercised in both directions:

```text
Patch Presentation
→ setInterpolation(...)
→ no setFramerate(...)

Patch Execution
→ setFramerate(...)
→ no setInterpolation(...)
```

The high-refresh profile remains representable as:

```text
Simulation:   30 Hz
Presentation: display refresh
```

A Legacy project `framerate` claim maps only to Execution. It cannot silently replace an existing Presentation policy.

### 3.2 Legacy precedence is contained per semantic key

Certified behavior:

```text
Session FPS = 120
Project FPS = 60
→ effective = 60

Session intent changes to 144 while project is active
→ effective remains 60
→ session 144 is retained

Project claim clears
→ session 144 resumes
```

This eliminates the old mixed last-writer-wins behavior for migrated Runtime settings.

### 3.3 `_twconfig_` is compatibility transport only

Certified behavior:

```text
Legacy import
_twconfig_ → explicit migration/owner routing

Native Runtime Policy mutation
→ does not create _twconfig_

Explicit Legacy export
→ may create _twconfig_
```

The historical Scratch Runtime parser/exporter is therefore not a Native NGVGE authority.

### 3.4 Presentation limitations are fail-visible

Built-in presentation domains remain explicit:

```text
scratch.sprite.transform
  interpolation supported

scratch.pen
  exact-tick required

scratch.stamp
  exact-tick required
```

Under display-refresh/high-refresh presentation, a Pen/Stamp project is reported as `partial`, with explicit exact-tick diagnostics. Transform interpolation does not imply project-wide interpolation.

Unknown/custom renderer domains with no PresenterCapability are reported as `unknown` with `compat.presentation.capability-missing` rather than assumed compatible.

### 3.5 Backend capability does not redefine semantic compatibility

Certified example:

```text
Transform Presenter semantically supports interpolation
Scratch backend lacks setInterpolation()

Presentation semantic result: compatible
Backend capability result: incompatible
```

This preserves backend replaceability under ARC-0001.

### 3.6 Analyzer is query-only

`previewPolicy()` was certified to leave both Runtime Policy state and VM/Renderer mutation call history unchanged.

Compatibility Analyzer therefore owns no Runtime Policy, Project, VM, Renderer or Backend mutation authority.

### 3.7 Legacy unbounded requests remain bounded

Legacy `maxClones = Infinity` is certified as:

```text
legacy-unbounded-request
!=
actual unbounded backend authority
```

The Scratch backend receives the Host hard ceiling, not `Infinity`.

## 4. Machine certification

Focused machine gate:

```text
npm run test:legacy-containment:lrc-g1-certification
```

Results:

```text
LRC-2 Certification      12 / 12 PASS
LRC-3 Certification      10 / 10 PASS
LRC-4 Machine DoD        10 / 10 PASS
LRC-G1 Machine DoD       15 / 15 PASS
LRC-G1 E2E Jest           9 / 9 PASS
```

## 5. Cumulative regression evidence

Final certification tree:

```text
ARC-C001.1                7 / 7 PASS
0009-E Transform DoD     12 / 12 PASS
Permanent Regression     19 / 19 PASS

Unit / Node              90 suites / 495 tests PASS
Unit / DOM                3 suites / 26 tests PASS
Unit total               93 suites / 521 tests PASS

Integration               3 suites / 4 tests PASS
Smoke                     1 suite / 1 test PASS

RE-3 -> RE-5             PASS
WS-0 -> WS-2             PASS
LSC-0                     PASS
TypeScript                PASS
ESLint correctness        PASS
```

## 6. Real Webpack evidence

The real Editor entry was compiled using `webpack.config.js[0]` and the production Babel/module-resolution rules:

```text
entry:    src/playground/editor.jsx
exit:     0
errors:   0
warnings: 0
status:   PASS
```

The Babel large-file deoptimization notice for Scratch Render and the Tapable deprecation notice are pre-existing tooling notices, not compile errors or warnings in the certification result.

## 7. Aggregate command execution note

The cumulative gate is registered as:

```text
npm run test:legacy-containment:lrc-g1
```

In the certification environment, repeated aggregate invocations containing another full real Webpack compile exceeded the outer 15-minute execution window. Before that window was hit, the deterministic constituent gates completed successfully; the real Webpack editor-entry gate was also run independently on the same certification code tree and returned explicit exit code 0.

Therefore this certificate does **not** claim an aggregate-process exit code that was not observed. Certification is based on the explicit PASS results of every constituent gate plus the standalone real Webpack PASS.

## 8. Governance result

LRC-G1 is certified.

From this point forward, changes to LRC-2/LRC-3/LRC-4 areas must preserve the following containment properties:

1. Simulation Tick Rate and Presentation Refresh remain separate semantic dimensions.
2. Runtime Policy domains retain one Host-resolved Writer Authority each.
3. Editor/UI cannot acquire direct Runtime Policy backend mutation authority.
4. `_twconfig_`, URL/session settings and old controls remain compatibility ingress, not Native authority.
5. `OpsPerFrame`, `miscLimits` and Stage Size remain outside Native Runtime Policy v1.
6. Legacy unbounded resource requests remain Host-bounded.
7. Presentation capability is declared per visual domain.
8. Pen/Stamp/custom renderer limitations remain fail-visible.
9. Backend capability and semantic compatibility remain separately reported.
10. Compatibility Analyzer remains query-only.

A future change that weakens these properties must not be treated as a routine implementation change; it requires an explicit architecture/versioning decision consistent with ARC-0001.

## 9. Next engineering stage

Per the frozen master-plan ordering, the next primary stage is:

```text
LPL-1 | Project Lifecycle Consolidation
```

The following containment seams remain after LRC-G1:

```text
LPL-1  Project lifecycle / vm.loadProject / serialization host pipeline
LEX-1  Extension/Addons trust + capability + host separation
COL-0  Stable semantic collaboration boundary
```

WS-3 remains paused until its required Legacy containment gates are satisfied.
