# ARC-C001.1-A.1｜Capability Teardown Lease Acceptance Hotfix

**Parent:** ARC-C001.1-A Semantic Ownership Zone / Import Boundary
**Status:** Browser Validated / Complete
**Discovered by:** real browser Scene Module disable acceptance test
**Scope:** Module Service/Capability Facade lifecycle teardown semantics
**0009:** remains blocked

## Symptom

Disabling Scene System crashed the React tree while `ProjectExplorer` and `ProjectInspector` passive-effect cleanup ran. Representative failures were:

```text
Module lifecycle mutation "service:capability:ngvge.runtime-node-model:call" is forbidden in the current execution phase.
Module lifecycle mutation "service:capability:ngvge.scratch-sprite-node-adapter:get:apply" is forbidden in the current execution phase.
```

The React Intl missing-message warnings observed in the same console trace are independent localization warnings and are not part of this crash.

## Root cause

`createServiceFacadeFactory()` wrapped every function returned by a capability method as another revocable function facade. Consequently:

```text
capability.subscribe(listener)
        ↓
raw unsubscribe function
        ↓
revocable Function Proxy    ← incorrect ownership
```

Scene System disable correctly disposes its services and revokes provider capabilities. React then executes the already-registered effect cleanup. React 16 may inspect/call `destroy.apply`; because the cleanup was still a capability facade, the `.apply` lookup itself required live provider authority and failed after revocation.

## Correct authority model

```text
Capability business methods
Provider-owned / generation-revocable
        ↓ provider revoke
UNAVAILABLE

subscribe() teardown lease
Consumer-owned cleanup authority
        ↓ provider revoke
STILL CALLABLE FOR CLEANUP ONLY
```

A teardown lease does not reopen business capability authority. It may invoke only the disposer that was issued while the capability was active. It is idempotent and does not transport object/function return values after provider revocation.

## Implementation

`src/lib/first-party-modules/service-facade.js` now recognizes disposer functions returned by `subscribe()` and converts them to frozen local teardown leases rather than normal capability function facades.

All normal capability access still checks the original generation/record authority. The existing `MODULE_CAPABILITY_AUTHORITY_REVOKED` behavior therefore remains unchanged for business methods, nested objects, methods and callbacks.

## Regression coverage

1. Unit: `module-deferred-authority-service-lifetime.test.js`
   - provider revoke still kills business capability calls;
   - teardown `.apply` remains readable/callable;
   - observer is actually released;
   - second teardown call is idempotent.
2. Permanent Regression: `module-capability-teardown-lease`
   - protects the authority distinction permanently.
3. Real Scene lifecycle integration:
   - subscribe to Runtime Node Model and Scratch Sprite Adapter;
   - disable Scene System;
   - assert old business capabilities revoked;
   - execute both teardown leases using React-style `.apply`;
   - re-enable Scene System and continue scene operations.

## Automated verification

```text
Permanent Regression                7 / 7 PASS
Unit / Node                        62 suites / 292 tests PASS
Unit / DOM                          3 suites / 21 tests PASS
Unit total                         65 suites / 313 tests PASS
Smoke                               1 / 1 PASS
Integration                         3 suites / 4 tests PASS
Scene lifecycle --detectOpenHandles 2 / 2 PASS
ARC-C001 Import Boundary self-test 13 / 13 PASS
Existing Architecture validators    PASS
ESLint correctness                  PASS
TypeScript 5.8.3 strict             PASS
```

## Acceptance state

Automated evidence is green. Because the defect was discovered only through the real browser UI path, C001.1-A is not promoted back to Browser Validated until the same manual path is repeated successfully.

Required browser acceptance:

```text
Enable Scene System
→ open/use Project Explorer + Inspector
→ Disable Scene System
→ no ErrorBoundary / no lifecycle mutation exception
→ Re-enable Scene System
→ Project Explorer / Inspector recover
→ scene switching remains usable
```


## Browser revalidation result

**Date:** 2026-08-11  
**Result:** PASS

The real Scene Module disable/re-enable acceptance path passed without ErrorBoundary or lifecycle-mutation crashes. This closes the C001.1-A.1 acceptance hold.
