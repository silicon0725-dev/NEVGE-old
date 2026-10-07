# NGVGE 0008.9.7 Preflight — Module Capability Publication Authority Fix

Baseline: `0008.9.7 preflight bootstrap recovery fix`

This hotfix addresses browser bootstrap failure:

`Module lifecycle mutation "capability:provide" is forbidden in the current execution phase.`

## Root cause closed

Module capability publication previously combined lifecycle-hook phase and a lazily-created module authority token. The publication decision could therefore depend on a token inferred at call time rather than a registration-committed generation identity.

## Changes

- Module generation authority is created immediately after successful `registerModule()` commit.
- Hook execution captures that exact generation authority in a private synchronous Hook Frame.
- `context.capabilities.provide()` carries the current Hook Frame to the capability registry.
- Module-owned capability publication requires all of:
  - current synchronous Hook Frame;
  - current registration generation authority;
  - providerModuleId equal to the active module;
  - publication phase `initialize`, `enable`, or `completeEnable`.
- Retained contexts cannot publish after a hook returns.
- Re-registering the same module id creates a fresh authority generation and does not revive old contexts.
- Added exact built-in Core publication validation for `ngvge.module-manager` and `ngvge.module-data`.

## Validation

- Module Bootstrap Integrity — PASS
- Module Bootstrap Recovery Authority — PASS
- Module Capability Publication Authority — PASS
- 0008.9.4.1.4 Host/Client Authority — PASS
- 0008.9.4.1.5 Deferred Authority — PASS
- 0008.9.4.1.6 Exception Authority — PASS
- 0008.9.6.1.1 Provider Isolation — PASS
- Foundation Extensions — PASS
- touched JavaScript `node --check` — PASS
- package.json parse — PASS
- clean baseline reconstruction — PASS

The archive has no root `node_modules`; full Jest/ESLint/Webpack/browser integration tests were not executed in this environment.
