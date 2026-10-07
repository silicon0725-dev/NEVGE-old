# ARC-C001.1-A｜Semantic Ownership Zone / Import Boundary

**Status:** Browser Validated / Complete
**Parent:** ARC-C001 / ARC-0001
**Baseline:** ARC-C001.0-D
**Next:** ARC-C001.1-B Stable Identity Foundation
**0009:** Blocked

## Objective

Create the first implementation boundary required by ARC-C001.1 without migrating legacy Runtime/Editor/Compatibility implementations into Core.

C001.1-A establishes:

1. `src/core` as the NGVGE Semantic Ownership Zone;
2. a fail-closed import/ambient-dependency policy;
3. an executable Conformance Gate and destructive self-test;
4. explicit staged ownership directories for later C001.1 foundations.

It does **not** implement Stable Identity, Persistent DTO, Schema Registry, Authority Registry, Protocol DTOs, Scratch Adapter remediation, or Blocking CI.

## Repository additions

```text
src/core/
├── README.md
├── identity/README.md
├── persistent/README.md
├── schema/README.md
├── authority/README.md
├── protocol/README.md
├── lifecycle/README.md
└── capabilities/README.md

tools/conformance/
├── import-boundary-policy.json
├── check-import-boundaries.js
└── check-import-boundaries.self-test.js

docs/architecture/conformance/
└── import-boundaries.md
```

## Gate model

`src/core` is dependency-closed by default:

```text
src/core/** → src/core/**      allowed
src/core/** → ../anything     rejected
src/core/** → bare package    rejected unless explicitly allowlisted
src/core/** → ambient backend/editor global rejected when configured
```

The C001.1-A bare-package allowlist is empty.

Parsed dependency forms include ES imports, re-exports, CommonJS require, require.resolve, dynamic imports, and TypeScript import types. Non-literal runtime module resolution is rejected because the dependency graph cannot be certified statically.

## Self-test corpus

The destructive self-test proves 13 cases, including:

- local Core import succeeds;
- import-looking comments/strings do not create false dependencies;
- `react` bare import fails;
- Core → outside repository zone fails;
- `scratch-vm` require fails;
- dynamic import escape fails;
- non-literal dynamic import fails;
- non-literal require fails;
- explicit pure-package allowlist works;
- unbound DOM global fails;
- a locally shadowed identifier does not count as an ambient dependency.

## Enforcement status

```text
Gate exists:                 YES
Gate self-test:              YES
Manual executable authority: YES
Aggregate test wiring:       NO
Blocking CI wiring:          NO
```

This distinction is intentional. C001.1-A creates a correct Gate; it does not pre-empt ARC-C001.6 Blocking CI governance.

## Minimum-baseline effect

Before C001.1-A:

```text
Import Boundary Gate: MISSING
C001.1 requirements satisfied: 0 / 7
```

After C001.1-A:

```text
Import Boundary Gate: COVERED / ACTIVE-MANUAL
C001.1 requirements satisfied: 1 / 7
```

No other requirement is promoted merely because its directory now exists.

## Compatibility with ARC-0001

The implementation strengthens, but does not alter, ARC-0001 No Backend Leakage and Editor-as-Client semantics. Core cannot depend on Scratch/Editor/Backend implementation zones, and ambient backend/editor globals cannot be used to bypass imports.

## Exit decision

```text
ARC-C001.1-A: BROWSER VALIDATED / COMPLETE
ARC-C001.1-B: UNBLOCKED
ARC-C001.1:   ACTIVE
0009:         BLOCKED
```


## Acceptance hotfix note

Browser validation after this implementation exposed a pre-existing lifecycle flaw in the shared Module Service Facade: subscription teardown functions were wrapped as revocable capability function facades. After Scene System disabled and revoked its provider capabilities, React passive-effect cleanup could not even access the teardown function's `.apply` property.

C001.1-A.1 repairs the authority model by treating a `subscribe()` return function as a consumer-owned teardown lease. It can only execute the previously-issued disposer; it does not restore access to the provider capability, and non-primitive teardown return values are not transported across the revoked boundary.

Browser revalidation passed on 2026-08-11; C001.1-A is complete and C001.1-B is unblocked.


## Browser revalidation result

**Date:** 2026-08-11  
**Result:** PASS

The real Scene Module disable/re-enable acceptance path passed without ErrorBoundary or lifecycle-mutation crashes. This closes the C001.1-A.1 acceptance hold.
