# OSS Intake ADR Template

Status: TEMPLATE
Authority: ARC-0001 / Tool Ecosystem Contract

Use this ADR before activating any `oss-wrapped` NGVGE Tool or replacing one of its backends.
The OSS project is an implementation dependency. It never owns NGVGE ToolId, WindowId, NodeId,
ResourceId, Schema, Authority, Protocol, Project Lifecycle, or Compatibility semantics.

## Identity

- ADR ID: `OSS-INTAKE-XXXX`
- NGVGE ToolId:
- Candidate project/library:
- Upstream URL:
- Version/commit evaluated:
- Intake owner:
- Decision: Proposed / Approved / Rejected / Retired

## Semantic responsibility

Describe exactly what NGVGE semantic responsibility remains in NGVGE and what implementation work may be delegated to the library.

## License

- SPDX/license:
- Redistribution obligations:
- Attribution/notice requirements:
- Source disclosure implications:
- Asset/font/license exceptions:

## Maintenance

- Upstream activity:
- Bus factor / maintainer concentration:
- Security/update process:
- Fork burden if upstream stops:

## Bundle / runtime footprint

- Installed size:
- Browser bundle impact:
- Lazy-load viability:
- Worker/WASM/native dependencies:
- Runtime memory/CPU characteristics:

## Browser / desktop support

- Browser support:
- Desktop shell support:
- Mobile considerations:
- Accessibility constraints:

## Backend seam

Define the adapter boundary. The external project must sit behind this seam and must not export its internal identity as NGVGE identity.

## Persistence and authority

- NGVGE persistence scope(s):
- Project/Resource authority consumed:
- Forbidden direct mutation paths:
- Secret handling:

## Migration / escape plan

Describe how NGVGE can replace or remove this dependency without changing ToolId, serialized semantic identity, or project compatibility.

## Verification

- License check:
- Build smoke:
- Compatibility test:
- Authority boundary test:
- Uninstall/replace rehearsal:
