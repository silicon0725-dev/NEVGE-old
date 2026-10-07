# LSC-G1 | Credentials & Unsafe Agent Containment Certification

**Status:** `PASS / CERTIFIED`
**Date:** 2026-08-13
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`
**Prerequisite implementation:** `LSC-0 | COMPLETE`

## Certification statement

LSC-G1 certifies that the known Legacy credential surfaces and the Legacy 02Agent are contained strongly enough to stop acting as uncontrolled security or mutation authorities while the final NGVGE Credential Service and native Agent ChangeSet/Review/Authority system remain deferred.

The gate certifies containment, not completion of the future Agent architecture.

## Credential invariant

Known Legacy credentials have the following durability model:

```text
Agent provider API key
Bridge bearer token
Git remote token
        ↓
ngvge.legacy-credential-vault@1
        ↓
page/process memory only
```

Durable browser metadata may retain non-secret preferences such as provider metadata, bridge enabled/port, Git username, and CORS policy. It must not retain credential values.

Startup migration scrubs known historical plaintext stores before the optional Legacy UI needs to open.

`LegacyCredentialVault.getStatus()` exposes counts only and cannot reveal namespaces, keys, or secret values.

## Bridge token hardening added during G1

LSC-G1 removed the previous `Date.now() + Math.random()` fallback for 02Agent bridge tokens.

The production rule is now:

```text
crypto.getRandomValues available
→ generate 128-bit ephemeral bearer token

crypto.getRandomValues unavailable
→ NGVGE_LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE
→ fail closed
```

An insecure pseudo-random bearer token is no longer a valid compatibility fallback.

## Unsafe Agent mutation invariant

Legacy 02Agent remains:

```text
enabledByDefault = false
legacy + danger classification
mutationMode = read-only
```

Mutation containment has two independent layers:

```text
Provider / Bridge tool manifest
→ mutating schemas withheld

callAITool runtime boundary
→ every classified mutating tool rejected
→ NGVGE_LEGACY_AGENT_MUTATION_BLOCKED
→ implementation is never invoked
```

The E2E certification attempts every currently classified mutating Legacy Agent tool and verifies zero implementation invocations.

This includes project/script/sprite/costume/extension mutation families such as `applyPatch`, sprite/costume creation/deletion/reordering, extension installation, and UCF replacement/generation paths.

## Project Lifecycle boundary

Legacy per-message project snapshots and message rollback controls remain retired. Chat history cannot call `vm.loadProject` or become an alternate undo/project-lifecycle authority.

Future native Agent mutation must use:

```text
Agent
→ ChangeSet
→ Review
→ Engine Command / Transaction
→ Authority
→ Commit / Rollback
```

That future path is not implemented by LSC-G1. Legacy 02Agent stays read-only until it exists.

## Raw VM boundary

The bundled Legacy 02Agent still receives raw VM through the explicit Legacy Addon quarantine certified by LEX-G1. LSC-G1 does not reclassify that raw VM as a native Agent capability.

The safety argument is therefore defense in depth:

1. addon is disabled by default;
2. raw VM access is Legacy-only quarantine, not general/custom addon capability;
3. model/bridge mutation schemas are withheld;
4. runtime mutation dispatch rejects all classified mutating tools;
5. project-history rollback mutation is removed.

The raw VM quarantine itself remains technical debt to be retired by the future Agent/Workspace migration.

## Credential export and diagnostics

Agent configuration export explicitly records `credentialsIncluded: false` and strips API keys.

Bridge manifest declares:

```text
readOnly = true
apiKeysExposed = false
requiresToken = true
dangerousOperationsMayMutateProject = false
```

Git durable auth metadata contains username/policy metadata only; Git token values are recovered from the page-memory credential vault.

## Machine certification

`npm run test:legacy-containment:lsc-g1-certification`

- Machine invariant scan: `19 / 19 PASS`
- Runtime E2E: `1 suite / 7 tests PASS`

`npm run test:legacy-containment:lsc-g1-webpack`

- real production entry: `src/addons/addons/02agent/hooks/useBridgeClient.ts`
- `webpack.config.js[0]`
- exit code `0`
- errors `0`
- warnings `0`

## Cumulative evidence

- LSC-0: PASS
- LRC-G1: `15/15 + 9/9 PASS`
- LPL-G1: `17/17 + 9/9 PASS`
- LEX-G1: `19/19 + 9/9 PASS`
- COL-0: `15/15 + 12/12 PASS`
- 0009-E: `12/12 PASS`
- Permanent Regression: `19/19 PASS`
- Unit Node: `100 suites / 537 tests PASS`
- Unit DOM: `3 suites / 26 tests PASS`
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 suite / 1 test PASS`
- TypeScript: PASS
- ESLint correctness: PASS

## Explicitly deferred / non-blocking debt

LSC-G1 does **not** claim that the current in-memory vault is a final secure credential service. System keychain/OS-backed credential storage remains deferred.

LSC-G1 does **not** claim that Legacy 02Agent is a native Workspace Tool. Its standalone DOM/z-index host remains compatibility debt and must be replaced by WS-7 Tool Registry / Window Manager integration.

LSC-G1 does **not** permit the Legacy Agent to mutate through its raw VM. The raw VM is quarantined for compatibility; AI mutation remains forbidden until the native ChangeSet/Review/Authority path exists.

## Gate conclusion

`LSC-G1 = PASS / CERTIFIED`

The LSC-G1 contribution to the WS-3 prerequisite set is satisfied.
