# LRC-4 | Compatibility Analyzer & Presentation Capability Diagnostics

Status: COMPLETE / VERIFIED  
Parent: ARC-0001 | Kernel Independence Contract  
Depends on:
- LRC-2 | Runtime Policy Foundation — COMPLETE / CERTIFIED / ARCHITECTURE FROZEN
- LRC-3 | Legacy Runtime Settings Compatibility Adapter — COMPLETE / VERIFIED

## 1. Purpose

LRC-4 replaces trial-and-error Runtime/Profile switching with a query-only compatibility analysis layer.

The Analyzer does not answer only `Compatible / Incompatible`. It separates five result surfaces:

```text
Execution compatibility
Presentation compatibility
Resource risk
Backend capability
Legacy override / migration state
```

This prevents a backend limitation from being misreported as a semantic incompatibility and prevents one supported visual domain from implying project-wide interpolation support.

## 2. Stable identities

```text
ngvge.compatibility-project-scan@1
ngvge.compatibility-project-snapshot/v1
ngvge.compatibility-backend-scan@1
ngvge.compatibility-backend-snapshot/v1
ngvge.presenter-capability-registry@1
ngvge.compatibility-analyzer@1
ngvge.compatibility-report/v1
ngvge.runtime-compatibility-service@1
```

These identities are query/diagnostic contracts. They do not become Runtime Policy writers.

## 3. Query-only production path

```text
Runtime / Settings / Future Profile UI
        |
        v
RuntimeCompatibilityService
        |
        +--> RuntimePolicy snapshot
        +--> Scratch project semantic scan
        +--> PresenterCapabilityRegistry
        +--> Scratch backend capability scan
        +--> LRC-3 migration/precedence snapshot
        |
        v
CompatibilityAnalyzer
        |
        v
CompatibilityReport
```

`analyzeCurrent()` evaluates the current Runtime Policy.

`previewPolicy(candidatePolicy)` evaluates a candidate profile without applying it. Neither path may call VM/Renderer mutation setters.

## 4. Project semantic scan

The Scratch project scanner records static evidence rather than claiming runtime certainty.

Current evidence includes:

```text
Pen usage
Stamp usage
Sprite transform usage
Clone creation sites
Wait/timer-sensitive logic
Broadcast/event density
Custom stage geometry
Custom extensions
Renderer-private extension declarations
High project/render load heuristic
```

Static clone and render counts are diagnostic signals. They are not interpreted as exact runtime clone pressure or performance measurements.

## 5. Presentation domains

Built-in Presenter capabilities are explicit:

```text
scratch.sprite.transform
  interpolation: supported
  resampling: unsupported
  exact-tick required: false

scratch.pen
  interpolation: unsupported
  resampling: unsupported
  exact-tick required: true

scratch.stamp
  interpolation: unsupported
  resampling: unsupported
  exact-tick required: true
```

Therefore:

```text
High-refresh + pure sprite transform
=> compatible when transform interpolation is available

High-refresh + Pen/Stamp
=> partial presentation compatibility
=> transform may be smoothed
=> Pen/Stamp remain tick-bound
```

The Analyzer never promotes `scratch.sprite.transform` capability to project-wide interpolation support.

## 6. Unknown/custom visual domains

Custom extensions are conservative by default.

If an extension uses an explicitly declared visual domain but no PresenterCapability exists:

```text
Presentation status: unknown
Diagnostic: compat.presentation.capability-missing
```

If an extension has no visual-domain declaration at all, the project scan reports an unknown extension capability rather than assuming it is non-visual or compatible.

Future LEX/Extension Host work may supply explicit extension compatibility descriptors without changing the Analyzer authority model.

## 7. Execution diagnostics

Timer/wait-sensitive Scratch projects are reported as partial when simulation tick differs from the Scratch-compatible 30 Hz baseline.

Examples of static timing evidence:

```text
control_wait
control_wait_until
sensing_timer
sensing_resettimer
event_broadcastandwait
```

This is intentionally separate from Presentation refresh.

## 8. Resource risk

Resource reporting is not an Authority and does not change budgets.

It reports:

```text
clone usage
clone-heavy static signal
legacy-unbounded clone intent
Host hard ceiling
high render/project load heuristic
```

`legacy-unbounded-request` remains a compatibility request bounded by the LRC-2 Host hard ceiling.

## 9. Backend capability separation

Backend capability is reported independently from semantic compatibility.

Examples:

```text
Transform Presenter semantically supports interpolation
Scratch backend lacks setInterpolation()
=> Presentation: compatible
=> Backend: incompatible

Custom stage geometry exists
Backend lacks stage geometry capability
=> Backend: incompatible
```

This separation prevents backend replacement from redefining NGVGE semantic compatibility.

## 10. Legacy diagnostics

The Analyzer consumes LRC-3 read-only state:

```text
migration records
compatibility diagnostics
precedence snapshot
```

Backend-automatic baseline values are not treated as user Legacy overrides.

Active project/session Legacy claims are reported separately. Unsupported migration records or error diagnostics produce an incompatible Legacy result without contaminating the other compatibility surfaces.

## 11. Representative Scratch Compatibility Corpus

LRC-4 establishes C01-C17:

```text
C01 Pure Scratch sprite motion
C02 Broadcast/event-heavy
C03 Wait/timer-sensitive
C04 Pen-heavy
C05 Stamp-heavy
C06 Clone-heavy
C07 Turbo candidate
C08 custom FPS legacy
C09 legacy interpolation
C10 OpsPerFrame legacy project
C11 custom stage size
C12 fencing-sensitive offstage movement
C13 sound limits
C14 pen limits / HQ render
C15 custom Scratch extension
C16 renderer-heavy
C17 3D/custom renderer extension
```

The corpus currently acts as deterministic semantic fixtures for the project scanner and Analyzer. It does not claim to replace later browser-level visual golden projects.

## 12. LRC-4 DoD

The executable gate certifies:

1. five compatibility result surfaces remain separated;
2. Pen/Stamp are not misclassified as transform-interpolated;
3. pure transform high-refresh behavior is represented correctly;
4. unsupported/unknown visual domains fail visibly;
5. backend capability is separated from semantic compatibility;
6. profile impact preview is query-only;
7. C01-C17 corpus exists;
8. corpus covers the required risk classes;
9. production Host installs the query service and Analyzer owns no Runtime setters;
10. focused and cumulative verification gates exist.

## 13. Verification commands

Focused:

```text
npm run test:legacy-containment:lrc4-analyzer
```

Cumulative:

```text
npm run test:legacy-containment:lrc4
```

The cumulative gate preserves LRC-3/LRC-2 conformance and runs the real Webpack editor-entry smoke after LRC-4 installation wiring.
