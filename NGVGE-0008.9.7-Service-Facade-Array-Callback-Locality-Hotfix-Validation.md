# NGVGE 0008.9.7 Runtime Integration Hotfix Validation

## Scope

This hotfix addresses the browser failure:

`MODULE_CAPABILITY_CALLBACK_FAILED` / `callback:return` on `capability:ngvge.scene-manager`

observed when `SceneSelector` renders a Scene list returned through a consumed Capability facade.

## Root cause

`sceneManager.listScenes()` correctly returned an Array from Host code, and the existing 0008.9.4.1.5 contract correctly kept returned object-like values as recursive revocable facades.

However, reading `scenes.map` from that Array facade returned the Host `Array.prototype.map` method through the normal Service method membrane. The JSX callback therefore executed as a Module-to-Host callback. A React element returned by the callback is Module-local opaque state and is intentionally rejected by the reverse membrane, producing `MODULE_CAPABILITY_CALLBACK_FAILED` with operation `callback:return`.

The failure was therefore not an exception-sanitization bug. It was an Array intrinsic dispatch-locality bug.

## Fix

Standard callback-taking Array intrinsic methods are projected locally when the raw Array uses the unmodified matching `Array.prototype` method:

- every
- filter
- find
- findIndex
- forEach
- map
- reduce
- reduceRight
- some
- findLast / findLastIndex when supported by the runtime

The local projection executes the native Array intrinsic against the revocable Array facade itself. Element reads and mutation still pass through facade traps and generation checks, but callback invocation and callback return values stay entirely on the consumer side.

The Host Array remains a revocable facade; it is not silently converted into detached data and the 0008.9.4.1.5 recursive lifetime contract is preserved.

Saved local Array callback methods revalidate provider/consumer generation on every call.

## Scene System read-only degradation

A separate pre-existing test failure was found while running the full Scene System suite: future Scene Data schema versions were correctly marked read-only by `SceneDataModelService`, but `completeEnable` still created Runtime/Scene services that immediately called `readProject()` and rejected the future schema.

The Scene System now degrades cleanly when Scene Data is newer than the current schema:

- `ngvge.scene-data-model` remains available in read-only mode;
- raw future data is preserved;
- Runtime Node restore and mutable Scene Runtime/Manager services are not started;
- the module can complete enable without rewriting future data.

Persistent format and Scene schema version are unchanged.

## Validation

### Architecture gates

- Runtime Node Public Boundary: PASS
- Runtime Node Lifecycle chain: PASS
- Component / Schema / Migration chain through 0008.9.7: PASS
- Cross-Boundary Exception Authority: PASS
- Service Facade Array Callback Locality gate: PASS
- Bootstrap Recovery: PASS
- Capability Publication: PASS

### Focused real Jest

`test/unit/lib/first-party-modules`
`test/unit/lib/runtime-errors`
`test/unit/lib/runtime-nodes`
`test/unit/lib/scene-system`
`test/unit/components/scene-selector.test.jsx`

Result:

- 41 suites PASS
- 188 tests PASS
- 0 failed

The SceneSelector test now includes a real `ModuleManager.client -> Capability facade -> listScenes() -> React render` path, so its Scene card `.map()` callback returns real React elements through the same call shape that previously failed in the browser.

### Webpack development compiler

Webpack Dev Server rebuilt the changed Service Facade and Scene System modules successfully.

A standalone `npm run build:dev` was also attempted. It did not emit a compiler error before the execution environment terminated it at 240 seconds, so production/static build completion is NOT claimed.

### Full repository unit suite

The entire `test/unit` tree is still not green due unrelated legacy/UI test-environment and API-drift failures outside this hotfix, including ProjectExplorer `document is not defined` under the repository's Node Jest environment and ProjectInspector/editor-command test drift. These are not counted as passes and are not hidden by this report.

### Browser automation limitation

The container's Chromium is governed by an organization URL policy that blocks local/private development URLs, so a reliable CDP click-through against `localhost:8601` cannot be executed in this environment. The exact failing membrane call shape is instead covered by the real React + Capability facade Jest regression above. User-side browser verification remains authoritative for the final UI confirmation.

## Status

- 0008.9.7 Mutation Commit Contract: unchanged; remains Freeze Candidate.
- Service/Capability Array callback locality hotfix: implemented and regression-covered.
- Scene future-schema read-only degradation: implemented and regression-covered.
