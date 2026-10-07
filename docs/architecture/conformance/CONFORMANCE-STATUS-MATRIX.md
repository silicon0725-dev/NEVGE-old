# ARC-C001 Conformance Status Matrix

**Phase:** ARC-C001.1-H
**Updated:** 2026-08-11
**0009 Transform System:** READY / UNLOCKED FOR ENTRY

## Domain status

| Domain | Coverage | Generic foundation | Enforcement | 0009 blocker / gap | Next work |
|---|---|---|---|---|---|
| Identity | Partial | Stable Identity active | active/manual | No minimum blocker; Identity Registry remains future work | later registry enforcement |
| Schema | Partial | Schema Registry active | active/manual | Migration graph + record validation deferred | C001.2 / C001.4 |
| Authority | Partial | Authority Registry active | active/manual | Projection loop / Mutation Context / switch deferred | C001.3 / ARC-0003 |
| Protocol | Partial | Protocol DTO active | active/manual + legacy evidence | Full Editor mutation mapping / negotiation / transactions deferred | C001.3 / ARC-0002 |
| Lifecycle | Partial | Partial | manual + regression evidence | Full generic lifecycle harness deferred | later C001 |
| Serialization | Partial | Persistent DTO + Schema metadata active | active/manual | Schema-aware record validation deferred | C001.2 |
| Compatibility | Partial | Scratch Adapter Boundary active | active/manual | No C001.1 implementation blocker; semantic trace/native comparison deferred | later C001 / ARC-0008 |

No domain is declared fully `Covered` merely because one C001.1 foundation exists.

## C001.1 minimum readiness

| Requirement | Status | Evidence / target |
|---|---|---|
| Import Boundary Gate | **COVERED** | C001.1-A / `test:conformance:import-boundary` |
| Stable Identity Types | **COVERED** | C001.1-B / `test:conformance:stable-identity` |
| Persistent DTO Validator | **COVERED** | C001.1-C / `test:conformance:persistent-dto` |
| Schema Registry foundation | COVERED | C001.1-D |
| Authority Registry | **COVERED** | C001.1-E / `test:conformance:authority-registry` |
| Protocol Command foundation | **COVERED** | C001.1-F / `test:conformance:protocol-dto` |
| Scratch Adapter Boundary Test | **COVERED** | C001.1-G / `test:conformance:scratch-adapter-boundary` |

```text
Satisfied / Covered:          7 / 7
Partial or historical:        0 / 7
Missing:                      0 / 7
Blocked by non-waivable debt: 0 / 7

ARC-C001.1: COMPLETE / MINIMUM BASELINE CERTIFIED
Certification: PASS
0009: READY / UNLOCKED FOR ENTRY
```

## C001.1-A acceptance closure

The Scene Module Disable/Enable browser path was revalidated successfully on 2026-08-11. `module-capability-teardown-lease` remains a permanent regression and C001.1-A is Browser Validated / Complete.

## C001.1-B delta

C001.1-B establishes:

- `ngvge-stable-identity/v1` canonical identity semantics in `src/core/identity`;
- Host-injected opaque identity creation outside Core;
- canonical NGVGE NodeIds for new Project Nodes;
- `ngvge-node-tree` persistence v4;
- legacy `target-node:*` recognition only in migration code;
- one migration alias map applied across NGVGE project sections before deserialization;
- permanent `project-node-stable-identity` regression;
- active/manual Stable Identity Conformance Gate.

`ARC-DEBT-0001` is resolved by C001.1-B. Scratch Adapter BindingId/runtime-target boundary activation is completed by C001.1-G; whole Compatibility-domain completion is not claimed.


## C001.1-C delta

C001.1-C establishes:

- `ngvge-persistent-dto/v1` in `src/core/persistent`;
- immutable structured DTO validation issues;
- fail-closed validation for non-plain/runtime/lossy values;
- legacy `src/lib/persistence` as a compatibility facade over Core;
- direct Project Persistence use of `clonePersistentDTO()` before section data enters Project Source;
- permanent `persistent-dto-boundary` regression;
- active/manual Persistent DTO Conformance Gate.

Schema-aware persistent-record validation remains deferred to C001.2; migration graph execution remains deferred to C001.4.


## C001.1-D delta

C001.1-D establishes:

- `ngvge-schema-descriptor/v1` in `src/core/schema`;
- generic versioned Schema Registry independent of Runtime Component implementation;
- property metadata for type/default/nullability/range/unit/resource/persistence/portable validation rules;
- Core Persistent DTO authority over schema/default/validation metadata;
- append-only `(typeId, version)` registration;
- atomic batch registration and immutable query snapshots;
- permanent `schema-registry-boundary` regression;
- active/manual Schema Registry Conformance Gate.

Full migration graph execution and schema-aware arbitrary-record validation remain deferred.

## C001.1-E delta

C001.1-E establishes:

- `ngvge-authority-registration/v1` in `src/core/authority`;
- generic State Domain Authority Registry independent of Module Capability ownership;
- explicit `writer | projection | observer` roles;
- explicit projection direction vocabulary;
- fail-closed single active writer enforcement per State Domain;
- atomic batch registration on duplicate/writer conflicts;
- immutable deterministic registration/query snapshots;
- permanent `authority-registry-boundary` regression;
- active/manual Authority Registry Conformance Gate.

Projection Loop Prevention, Mutation Context and transactional Authority Switch remain deferred to C001.3 / ARC-0003.

## Enforcement status

```text
Import Boundary Gate       ACTIVE / MANUAL
Stable Identity Gate       ACTIVE / MANUAL
Persistent DTO Gate        ACTIVE / MANUAL
Schema Registry Gate       ACTIVE / MANUAL
Authority Registry Gate    ACTIVE / MANUAL
Protocol DTO Gate          ACTIVE / MANUAL
Scratch Adapter Gate       ACTIVE / MANUAL
Aggregate architecture CI  NOT YET ACTIVE
Blocking Merge Policy      NOT YET ACTIVE
```

Machine-readable authority: `CONFORMANCE-STATUS-MATRIX.json`.


## C001.1-F delta

C001.1-F establishes:

- `ngvge.engine-protocol` protocol version `1` in `src/core/protocol`;
- generic Command / Query / Event / ProtocolError DTO constructors;
- fail-closed portable protocol value validation for runtime/native object representations;
- detached, deeply frozen Query snapshots;
- permanent `protocol-dto-boundary` regression;
- active/manual Protocol DTO Conformance Gate.

Repository-wide Editor mutation→Command mapping, transactions, pagination and protocol negotiation remain deferred.


## C001.1-G delta

C001.1-G establishes:

- an independent active/manual Scratch Adapter Boundary Gate;
- sensitive-zone scanning over Core, Runtime Node semantic code and generic persistence;
- fail-closed detection of direct Scratch adapter dependency and volatile `targetRuntimeId` leakage;
- persistent Scratch binding enforcement where stable `BindingId` / `NodeId` survive but volatile Target identity does not;
- immutable Target-object-free adapter views and semantic-owner tree projection checks;
- retained 0008.7.3 scene-scope/deletion/lifecycle behavior corpus;
- permanent `scratch-adapter-boundary` regression;
- resolution of `GOV-DEBT-0002`.

All seven C001.1 minimum implementation requirements are covered. C001.1-H has certified their combined execution/governance state and unlocked 0009 for entry.


## C001.1-H certification result

```text
Minimum requirements covered    7 / 7
Active Architecture Waivers     0
Unresolved C001.1/0009 blockers 0
Certification                   PASS
0009 Transform System           READY / UNLOCKED FOR ENTRY
Blocking Merge Policy           NOT YET ACTIVE
```

The certification is enforced by `test:conformance:c001.1-h` and `ARC-C001.1-H-MINIMUM-BASELINE-CERTIFICATE.json`. No whole conformance domain is promoted from Partial merely by this entry certification.
