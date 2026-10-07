# ARC-C001 Waiver / Debt Classification Baseline

**Phase:** ARC-C001.0-C
**Status:** Complete
**Normative parent:** ARC-0001

## Decision table

| Condition | Classification | Waiver? |
|---|---|---|
| Style/performance/toolchain limitation without ARC semantic violation | Technical Debt | No |
| Missing CI/conformance execution authority | Governance Debt | No |
| Backend-specific object remains inside declared Compatibility/Host boundary | Legitimate Compatibility | No |
| Actual temporary ARC violation in finite non-forbidden scope | Architecture Waiver candidate | Only with explicit registry entry |
| ARC violation affects Project Model, Persistent DTO or public protocol | Non-waivable Architecture Conformance Debt | No |
| Permanent desire to change ARC-0001 semantics | New/Superseding ARC | Never via waiver |

## Baseline result

```text
Active Architecture Waivers        0
Non-waivable Conformance Findings  1
Accepted Technical Debt            5
Conformance Governance Debt        2
External Evidence Holds            2
```

The authoritative registries are:

- `../LEGACY-WAIVERS.md` / `.json`
- `../TECHNICAL-DEBT-BASELINE.md` / `.json`

## Enforcement state

C001.0-C records and classifies these items only. It does not add waiver-expiry automation or Blocking CI. That enforcement belongs to ARC-C001.6.
