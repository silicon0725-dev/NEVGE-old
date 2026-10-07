# NGVGE Semantic Ownership Zone

`src/core` is the implementation ownership zone for backend-independent NGVGE semantics defined by ARC-0001.

Code in this directory must remain independently meaningful when Scratch, React, DOM integrations, execution storage, and concrete backend implementations are removed.

## Dependency rule

Core source files may depend only on other files inside `src/core` unless a bare package is explicitly approved in `tools/conformance/import-boundary-policy.json`.

The default package allowlist is empty.

This is intentionally stricter than ordinary application code: dependencies needed only by an Editor, Compatibility Adapter, Runtime execution store, or Backend belong outside this zone and must connect through contracts defined here.

## Reserved foundations

The subdirectories are staged ownership boundaries. C001.1-A creates the directories but does not pre-implement later phases:

- `identity/` — C001.1-B
- `persistent/` — C001.1-C
- `schema/` — C001.1-D
- `authority/` — C001.1-E
- `protocol/` — C001.1-F
- `transform2d/` — 0009-A Transform2D semantic contract foundation
- `functional-node/` — WS-10N0 Functional 2D Node archetype/compatibility foundation
- `lifecycle/` — lifecycle vocabulary/contracts; expanded later by C001.4
- `capabilities/` — capability contracts; expanded later by C001.4

Do not move legacy implementations into `src/core` merely to satisfy directory structure. A type or service belongs here only after its semantics are owned by NGVGE rather than a current backend.
