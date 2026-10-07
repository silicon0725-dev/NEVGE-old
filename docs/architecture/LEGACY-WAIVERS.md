# NGVGE Legacy Architecture Waiver Registry

**Schema:** `ngvge-arc-waiver-registry/v1`
**Baseline phase:** ARC-C001.0-C
**Updated:** 2026-08-10
**Parent authority:** ARC-0001｜Kernel Independence Contract

## Baseline result

```text
Active Architecture Waivers: 0
Expired Architecture Waivers: 0
Rejected / Non-waivable findings: 1
```

C001.0-C intentionally starts with **zero active waivers**. Existing technical debt, external build evidence holds and legitimate Scratch compatibility implementation are not converted into architecture exceptions merely because they are old or inconvenient.

## What counts as an Architecture Waiver

An Architecture Waiver exists only when all of the following are true:

1. an active implementation is known to violate an already-effective ARC-0001 conformance rule;
2. the violating code has finite file/module scope;
3. the exception is temporary;
4. removal can be assigned to a concrete task and owner;
5. the exception does not attempt to redefine ARC-0001 semantics.

Every future waiver record must contain at least:

```yaml
waiverId: ARC-0001-WAIVER-XXXX
rule: <conformance-rule-id>
scope:
  - <finite repository path>
reason: <why the temporary exception exists>
owner: <responsible owner>
createdAt: YYYY-MM-DD
expiresAt: YYYY-MM-DD
removalTask: <task-id>
status: active | expired | removed
```

## Forbidden waiver zones

A waiver MUST NOT be used to authorize a violation in:

- Project Model;
- Persistent DTO;
- public protocol.

A permanent exception to ARC-0001 requires a formal Superseding ARC. Waivers cannot be used as a substitute for architecture change.

## Active waivers

None.

```json
[]
```

This is intentional. C001.0-C found no currently justified finite-scope ARC violation that is both temporary **and** legally waivable under the frozen contract.

## Non-waivable conformance finding

### ARC-DEBT-0001｜Target-backed Project Node identity derives from Scratch target.id

**Status:** Resolved / C001.1-B
**Waivable:** No
**Primary domains:** Identity, Serialization, Compatibility
**Scope:** `src/lib/project-nodes/node-database.js`

Current target-backed Project Node creation uses:

```text
Scratch target.id
→ getTargetNodeId(target.id)
→ persistent Project Node `id`
→ ngvge-node-tree project section
```

The implementation removes the runtime-only `targetId` field before serialization, and it can preserve the derived node ID across a later target-runtime-id change. However, the stable semantic identity is still initially constructed from a backend execution identity, and the persisted `targetBindings` array uses target order as the compatibility rebinding mechanism.

That conflicts with ARC-0001 Stable Identity / No Backend Leakage intent. Because the affected identity is persisted into the Project Model, the finding **cannot be covered by a waiver**.

Required disposition:

```text
ARC-C001.1 Stable Identity Foundation
+ Scratch Adapter Boundary Foundation
→ introduce backend-independent stable NodeId / BindingId separation
→ migrate/rebind legacy target-backed project-node records
→ preserve existing project identities through migration
```

This finding did not modify ARC-0001. It was an implementation conformance debt discovered during enforcement construction and is resolved by C001.1-B. `0009 Transform System` remains blocked by other incomplete C001.1 minimum gates.

## Legacy compatibility surfaces that are NOT waivers

The following backend-specific implementation is currently classified as legitimate compatibility/host containment rather than an ARC exception:

| Surface | Why it is not a waiver | Constraint |
|---|---|---|
| `src/lib/scratch-sprite-adapter/**` | Scratch target/runtime identity belongs inside the Compatibility Adapter | runtime-only target identity must not enter persistent binding DTOs |
| `src/lib/first-party-modules/vm-project-io-service.js` | Scratch VM/JSZip/binary handling is Host-owned boundary implementation | Module/Public protocol receives portable string data, not VM binary objects |
| `src/lib/scene-system/legacy-scene-snapshot-migrator.js` | read-only compatibility migration for V1 Scene snapshots | legacy backend representation must terminate at migration boundary |
| `src/lib/project-explorer/entity-provider.js` | transient Editor-side Scratch entity projection | not a persistent semantic identity and must not become Project Model authority |

If any of these representations cross into Project Model, Persistent DTO or public protocol, the classification must be revisited as a conformance finding rather than silently extending the compatibility zone.

## Lifecycle of the registry

C001.0-C establishes the baseline registry. ARC-C001.6 will make it executable by adding expiry validation and Blocking CI behavior.

Machine-readable authority: `LEGACY-WAIVERS.json`.

## C001.1-B resolution update — 2026-08-11

`ARC-DEBT-0001` has moved from **Open / remediation required** to **Resolved**. It was not waived.

Resolution evidence:

```text
src/core/identity/stable-identity.js
src/lib/project-nodes/node-database.js
src/lib/project-nodes/legacy-node-identity-migration.js
src/lib/project-inspector/project-persistence.js
tools/conformance/check-stable-identities.js
test/regression/contracts/project-node-stable-identity.js
```

Active Architecture Waivers remain **0**.
