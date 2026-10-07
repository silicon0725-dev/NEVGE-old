# ARC-C001.1-B｜Stable Identity Foundation

**Status:** Complete / Automated Conformance Passed  
**Parent:** ARC-C001 / ARC-0001  
**Baseline:** ARC-C001.1-A.1 Browser Validated  
**Completed:** 2026-08-11  
**Next:** ARC-C001.1-C Persistent DTO Foundation  
**0009:** Blocked

## Acceptance prerequisite

The user revalidated the C001.1-A.1 Scene Module Disable browser path successfully on 2026-08-11. Therefore C001.1-A is restored to `Browser Validated / Complete` and C001.1-B is no longer held.

## Objective

Establish NGVGE-owned Stable Identity semantics without weakening the frozen R9 TypeScript boundary, and remediate `ARC-DEBT-0001` so persistent target-backed Project Node identity is no longer derived from Scratch `target.id`.

## Implementation

### Core semantic ownership

```text
src/core/identity/stable-identity.js
src/core/identity/index.js
```

Core owns stable identity schema/kinds/format/parse/assertion. Entropy is injected rather than read from ambient Host APIs.

### Host identity creation

```text
src/lib/identity/host-stable-id-factory.js
```

The Host adapter supplies opaque identity tokens and exposes NodeId/BindingId creation helpers. Backend entropy never becomes identity semantics.

### Project Node persistence v4

`src/lib/project-nodes/node-database.js` now:

- uses canonical Stable NodeIds for target-backed and custom nodes;
- does not derive NodeId from `target.id`;
- retains `targetId` only as transient binding state;
- deletes `targetId` before serialization;
- persists Node Tree format version 4;
- migrates historical target-derived records on load.

### Transactional legacy alias migration

```text
src/lib/project-nodes/legacy-node-identity-migration.js
src/lib/project-inspector/project-persistence.js
```

The migration creates one alias map and applies it across all NGVGE project sections before section restore. This prevents a half-migrated project where Node Tree uses a new ID while another section still references the legacy ID.

## ARC-DEBT-0001 disposition

```text
ARC-DEBT-0001
Persistent target-backed Project Node identity derives from Scratch target.id

OPEN / NON-WAIVABLE
        ↓ C001.1-B
RESOLVED
```

The resolved finding does **not** imply Scratch Adapter conformance is complete. Explicit BindingId/Adapter boundary activation remains C001.1-G and `GOV-DEBT-0002` remains open.

## TypeScript governance

An initial `.d.ts` approach was rejected during implementation because it would expand the R9 TypeScript trust boundary. C001.1-B instead keeps Core identity in JS/JSDoc with runtime validators. `scripts/validate-typescript-scope.js` remains unchanged and still reports exactly 42 strict TypeScript files under `src/addons/addons/02agent`.

## Minimum-baseline effect

Before C001.1-B:

```text
Import Boundary Gate     COVERED
Stable Identity Types    BLOCKED
Satisfied                1 / 7
```

After C001.1-B:

```text
Import Boundary Gate     COVERED
Stable Identity Types    COVERED / ACTIVE-MANUAL
Satisfied                2 / 7
ARC-DEBT-0001            RESOLVED
```

0009 remains blocked because Persistent DTO, Schema, Authority, Protocol and active Scratch Adapter minimum requirements are not all satisfied.
