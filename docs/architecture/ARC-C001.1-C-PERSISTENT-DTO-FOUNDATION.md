# ARC-C001.1-C｜Persistent DTO Foundation

**Status:** Complete / Automated Conformance Passed
**Parent:** ARC-C001 / ARC-0001
**Baseline:** ARC-C001.1-B Stable Identity Foundation
**Completed:** 2026-08-11
**Next:** ARC-C001.1-D Schema Registry Foundation
**0009:** Blocked

## Objective

Promote the existing persistence plain-data semantics into `src/core/persistent` as the repository-level Persistent DTO authority, while preserving compatibility for existing Runtime/Scene consumers and preventing Project Persistence from silently JSON-sanitizing invalid section data.

## Core authority

```text
src/core/persistent/persistent-dto.js
src/core/persistent/index.js
```

Schema: `ngvge-persistent-dto/v1`.

Core provides:

- `validatePersistentDTO()`;
- `assertPersistentDTO()`;
- `clonePersistentDTO()`;
- `PersistentDTOValidationError`;
- immutable structured validation issues.

## Legacy compatibility

`src/lib/persistence/persistent-data.js` remains available for existing callers but now delegates to the Core Persistent DTO contract. Its old exported names and legacy error class/code remain compatibility surface only; it no longer owns persistence semantics.

## Project Source boundary

`src/lib/project-inspector/project-persistence.js` now clones section payloads through `clonePersistentDTO()` rather than `JSON.parse(JSON.stringify(value))`.

Therefore invalid data such as `{kept: true, dropped: undefined}` is rejected at the persistence boundary instead of silently becoming `{kept: true}`.

The existing section isolation policy remains: a failing section does not prevent the whole Scratch project from saving. This phase changes validation authority, not Inspector ownership/error policy.

## Permanent protection

`persistent-dto-boundary` is added to the Permanent Regression layer and protects:

- Core ownership of Persistent DTO semantics;
- legacy persistence facade delegation;
- direct Project Persistence consumption of Core;
- fail-closed invalid DTO behavior;
- prohibition of JSON stringify/parse sanitization at the Project Persistence clone boundary.

## Scope exclusions

Schema-aware validation is intentionally deferred to C001.1-D. C001.1-C does not claim that every persistent record has a registered versioned schema; it establishes the structural DTO substrate that Schema Registry will consume.

## Minimum-baseline effect

```text
Before C001.1-C
Persistent DTO Validator   PARTIAL
Satisfied                  2 / 7

After C001.1-C
Persistent DTO Validator   COVERED / ACTIVE-MANUAL
Satisfied                  3 / 7
```

0009 remains blocked pending Schema Registry, Authority Registry, Protocol DTO foundation and active Scratch Adapter Boundary evidence.
