# NGVGE ARC-C001 Technical Debt Baseline

**Schema:** `ngvge-arc-c001-debt-baseline/v1`
**Baseline phase:** ARC-C001.1-H
**Updated:** 2026-08-11
**Source baseline:** R10 Known Debt Register + C001.0-B Existing Gate Inventory + C001.0-C conformance review

## Classification model

C001 uses four separate classes:

```text
Technical Debt
    does not currently violate frozen ARC semantics

Conformance Governance Debt
    enforcement/coverage is incomplete, but not itself a semantic exception

External Evidence Hold
    missing execution evidence; not a known product defect

Architecture Conformance Debt
    implementation conflicts with frozen ARC semantics
    → must be remediated or, only where legally permitted, explicitly waived
```

These classes MUST NOT be collapsed into a generic “legacy” bucket.

## Accepted technical debt

### TD-0001｜Git working-tree schema completeness

The working-tree exporter still does not preserve several fields it never emitted, including standalone workspace comments, custom extension URLs, monitor state, some target ordering/layer metadata and a true MD5 fallback on unsupported platforms.

**Classification:** Technical Debt
**Architecture waiver:** No
**Blocking C001.1:** No

### TD-0002｜Legacy ESLint maintenance/style debt

R10 baseline:

```text
files scanned:       666
affected files:      217
legacy errors:      5683
correctness errors:    0
```

Largest categories are formatting/style/legacy-policy rules. `import/namespace` remains quarantined because the frozen legacy plugin stack crashes when that rule is enabled.

**Classification:** Technical Debt
**Architecture waiver:** No
**Blocking C001.1:** No, unless a specific diagnostic is promoted into an ARC rule

### TD-0003｜Scoped TypeScript trust boundary

Strict TypeScript coverage remains intentionally limited to `src/addons/addons/02agent`; legacy JS remains unchecked and several runtime integrations use narrow ambient compatibility declarations.

**Classification:** Technical Debt
**Architecture waiver:** No

### TD-0004｜Scene performance profiling

Scene System V2.1 is functionally/browser validated, while very large tree rendering, long-session GC/cache behavior and snapshot capture/restore latency remain profiling targets.

**Classification:** Performance Debt
**Architecture waiver:** No

### TD-0005｜Build-toolchain modernization

Production build infrastructure remains on webpack 4 / legacy Terser-era tooling.

**Classification:** Toolchain Debt
**Architecture waiver:** No

## Conformance governance debt

### GOV-DEBT-0001｜Architecture validators are not aggregate/CI authority

C001.0-B found 12 architecture entrypoints / 27 unique active validators, but zero `test:architecture:*` entrypoints are called by aggregate `test` or the current CI workflow.

**Classification:** Governance / enforcement debt
**Required resolution:** ARC-C001.6 Blocking CI activation
**Architecture waiver:** No

### GOV-DEBT-0002｜Scratch Adapter boundary semantics are historical, not active

**Current status:** RESOLVED by ARC-C001.1-G (2026-08-11)

`0008.7.3` remains valuable historical behavior corpus, but C001.1-G now owns an independent active/manual Scratch Adapter Boundary Gate, a self-test and a permanent regression. Scratch-specific runtime identity is machine-enforced as compatibility-only state.

**Classification:** Resolved Conformance Activation Debt
**Resolution:** ARC-C001.1-G Scratch Adapter Boundary Gate
**Architecture waiver:** No

## Architecture conformance debt

### ARC-DEBT-0001｜Persistent target-backed Project Node identity derives from Scratch target.id

**Current status:** RESOLVED by ARC-C001.1-B (2026-08-11)

See `LEGACY-WAIVERS.md` for the original finding and resolution evidence.

```text
Scratch target.id
→ target-backed Project NodeId seed
→ persistent ngvge-node-tree node.id
```

The affected field belongs to Project Model persistence, so it is **non-waivable** under the current ARC-0001 waiver rules.

**Classification:** Resolved Architecture Conformance Debt / was non-waivable
**Resolution:** ARC-C001.1-B Stable Identity Foundation
**Blocks 0009 unlock:** No (other C001.1 minimum requirements still block 0009)

## External evidence holds

### EVIDENCE-HOLD-0001｜Clean Bun install / Node matrix

R10 could not execute a fresh `bun install --frozen-lockfile` with the required Node matrix because the sandbox lacked Bun and outbound registry/DNS access.

**Known defect:** No
**Architecture impact:** None
**Release reproducibility impact:** Pending external CI evidence

### EVIDENCE-HOLD-0002｜Full production webpack completion

R10 observed active webpack compilation without a compiler error, but the sandbox execution window ended before natural completion.

**Known defect:** No
**Architecture impact:** None
**Release reproducibility impact:** Pending external CI evidence

## Classification rule

A debt item becomes an Architecture Waiver candidate only when it is an actual ARC violation and all waiver constraints are satisfied. A debt item must not be reclassified as a waiver solely to prevent a gate from failing.

Machine-readable authority: `TECHNICAL-DEBT-BASELINE.json`.

## C001.1-B resolution update — 2026-08-11

`ARC-DEBT-0001` is **RESOLVED**.

Current Project Node creation uses NGVGE-owned canonical NodeIds. Historical `target-node:*` records are migration-only input; one alias map is applied across the NGVGE project sections before section deserialization. `targetId` remains runtime-only and is removed before Node Tree persistence.

This closes the non-waivable NodeId derivation finding. `GOV-DEBT-0002` was subsequently closed by C001.1-G when explicit Scratch Adapter/BindingId conformance became an active/manual gate.


## C001.1-G resolution update — 2026-08-11

`GOV-DEBT-0002` is **RESOLVED**.

`tools/conformance/check-scratch-adapter-boundary.js` is now the durable ARC-C001 authority for the Scratch Adapter boundary. It independently validates stable BindingId/NodeId persistence, runtime-only target identity, semantic-owner projection and sensitive-zone isolation. The old 0008.7.3 validator remains supporting behavior corpus rather than the sole gate.
