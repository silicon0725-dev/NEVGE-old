# NGVGE LRC-2B Change Manifest

**Stage:** LRC-2B | Production Runtime Policy Authority / Command Path  
**Date:** 2026-08-13  
**Base:** LRC-2A Runtime Policy Foundation  
**Delivery type:** Incremental overlay over LRC-2A

## Status

`IMPLEMENTED / SEMANTIC + CUMULATIVE CONFORMANCE PASS / FULL WEBPACK EXIT EVIDENCE PENDING`

LRC-2B moves Runtime Policy mutation out of direct Editor-owned VM/Renderer setters and into a Host-owned command/executor path. It intentionally does **not** certify the whole LRC-2 stage as COMPLETE/FROZEN yet because the repository-wide real Webpack build did not return a final exit code within the available execution windows.

## Production mutation path

```text
Legacy Advanced Settings / future Tool
        ↓
LegacyAdvancedSettingsBridge
        ↓
RuntimePolicy Editor Client
        ↓
Engine Protocol Command
        ↓
RuntimePolicyCommandExecutor
        ↓
Host resolves Writer Authority
        ↓
RuntimePolicyResolver
        ↓
ScratchRuntimePolicyAdapter.applyDomain()
        ↓
Scratch VM / Renderer Compatibility Backend
```

The Editor command DTO does not receive or supply `authorityId`.

## Modified existing files

- `package.json`
  - adds cumulative `test:legacy-containment:lrc2-command-path` gate.
- `scripts/validate-lrc2-runtime-policy-foundation.js`
  - keeps LRC-2A semantic checks valid after the planned production bridge is connected.
- `src/containers/tw-settings-modal.jsx`
  - routes Runtime Policy-owned controls through `LegacyAdvancedSettingsBridge` instead of direct VM/Renderer setters.
  - clone checkbox reflects Policy compatibility intent rather than requiring backend `Infinity`.
- `src/lib/vm-listener-hoc.jsx`
  - installs Runtime Policy service during VM host bootstrap.
- `src/lib/runtime-policy/README.md`
  - documents the LRC-2B production path and quarantine boundary.
- `src/lib/runtime-policy/constants.js`
  - adds command capability/runtime client identities and compatibility tokens.
- `src/lib/runtime-policy/index.js`
  - exports the LRC-2B command/runtime integration surface.
- `src/lib/runtime-policy/scratch-runtime-policy-adapter.js`
  - adds domain-local backend application and explicit compatibility projection.

## New source files

- `src/lib/runtime-policy/runtime-policy-command-capability.js`
  - public Engine Protocol command contract/client; Editor cannot supply Writer Authority.
- `src/lib/runtime-policy/runtime-policy-command-executor.js`
  - Host-owned executor; resolves unique Writer Authority internally; backend failure prevents Policy commit.
- `src/lib/runtime-policy/runtime-policy-runtime-integration.js`
  - per-runtime service installation/bootstrap and stable client facade.
- `src/lib/runtime-policy/legacy-advanced-settings-bridge.js`
  - migrates policy-owned Legacy Advanced Settings writers to Runtime Policy; keeps unresolved legacy controls quarantined.

## New verification/test files

- `scripts/validate-lrc2-runtime-policy-command-path.js`
- `test/unit/lib/runtime-policy/runtime-policy-command-path.test.js`
- `test/unit/lib/runtime-policy/legacy-advanced-settings-bridge.test.js`
- `docs/architecture/legacy-runtime/LRC-2-B-PRODUCTION-COMMAND-PATH.md`
- `docs/architecture/legacy-runtime/LRC-2-B-VERIFICATION.md`

## Runtime Policy-owned settings migrated

- Simulation framerate -> `ExecutionProfile`
- Scratch transform interpolation -> `PresentationProfile` / Presenter capability
- High-quality rendering intent -> `PresentationProfile`
- Clone limit intent -> `RuntimeSafetyPolicy` with finite Host hard ceiling
- Fencing -> `ScratchCompatibilityProfile`
- Legacy remove-limits intent -> explicit compatibility fields, with `miscLimits` only as backend projection
- Compiler/interpreter override -> runtime-only `ExecutionBackendPolicy`
- Offscreen drawable culling -> runtime-only `BackendHintSet`

## Explicit quarantine retained

These controls are **not** promoted into Native Runtime Policy:

- `OpsPerFrame`
- Warp Timer
- Stage Width / Height
- Legacy project option persistence transport

They remain behind the Legacy Advanced Settings quarantine bridge until their proper owner/migration stage takes over.

## Clone containment rule

Legacy “Infinite Clones” now means a compatibility request, not unbounded backend authority. The Scratch backend receives a finite value bounded by `hostHardCeiling`; the UI reflects the Policy request intent.

## Verification summary

- LRC-2A + LRC-2B Runtime Policy tests: **PASS — 4 suites / 21 tests**
- LRC-2B focused tests: **PASS — 2 suites / 10 tests**
- ARC-C001.1 baseline: **PASS — 7/7**
- 0009-E Transform DoD: **PASS — 12/12**
- RE-3 → RE-5 cumulative gates: **PASS**
- WS-0 → WS-2 cumulative gates: **PASS**
- LSC-0 cumulative gate: **PASS**
- Smoke: **PASS**
- ESLint correctness gate: **PASS**
- TypeScript scope: **PASS**
- `tw-settings-modal.jsx`: same 15 pre-existing legacy lint findings before/after; **no new lint debt introduced by LRC-2B**
- Full Webpack: **INCONCLUSIVE / EXIT EVIDENCE PENDING** — compilation started normally but exceeded execution windows before returning final exit code.

## Freeze decision

LRC-2B's semantic implementation is ready. Do **not** label all of LRC-2 `COMPLETE / FROZEN` until a local or CI real Webpack build returns exit code `0` under the existing UI verification gate.

After that certification, the planned next architectural stage is **LRC-3 | Legacy Runtime Settings Compatibility Adapter**, not WS-3.
