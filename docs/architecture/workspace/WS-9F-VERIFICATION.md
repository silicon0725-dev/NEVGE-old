# WS-9F Verification

Status: COMPLETE / VERIFIED

## Focused evidence

Final WS-9F focused verification:

- machine gate: `15/15 PASS`
- Node focused Jest: `6 suites / 51 tests PASS`
- Asset Manager DOM focused Jest: `1 suite / 3 tests PASS`
- combined focused: `7 suites / 54 tests PASS`
- real Webpack Project/Resource entries: `0 errors / 0 warnings`

Focused tests verify:

- Project read coverage becomes READY when ProjectLifecycleHost exists;
- Project read returns only portable Project Context/lifecycle state;
- Project command Provider surfaces are registered but bind fails closed with `NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY`;
- Resource read resolves canonical `ngvge:resource:*` and strips internal/backend fields;
- non-canonical `asset:*` identifiers are rejected at the capability boundary;
- Resource proposal accepts only the bounded `rename / move / delete` schema;
- Resource mutation resolves canonical ResourceId internally and executes through the database history seam;
- moves to a nonexistent folder fail before mutation;
- an already-bound Resource facade fails closed if the Resource authority later disappears;
- Resource Provider diagnostics become provider-unavailable when the canonical authority is unavailable;
- Global Asset ResourceId is created, serialized, migrated and preserved;
- Asset Manager projects canonical ResourceId into Workspace Context.

## Identity evidence

Global Asset persistence is now v3. Records separate:

```text
asset:*                  internal database compatibility identity
ngvge:resource:*         canonical NGVGE Resource identity
```

Legacy v2 serialized records missing canonical identity remain readable, are normalized during project deserialization, and subsequently persist their ResourceId as v3.

Workspace Context Resource projection rejects arbitrary/non-canonical strings.

## Project authority evidence

`project-read#query` is backed by ProjectLifecycleHost + WorkspaceContextService and exposes no Scratch project payload, VM or load/serialize function.

`project-command#propose|mutate` are real registered Provider surfaces but intentionally report:

```text
provider-unavailable
NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY
```

No Scratch `loadProject`/serialization seam is promoted to native Project command authority.

## Resource authority evidence

Resource query returns a portable descriptor only.

Resource mutation is intentionally limited to metadata operations:

```text
rename
move
delete
```

The Tool addresses a canonical ResourceId. The trusted Provider resolves the Global Asset internal ID and calls the existing Resource database/history seam. Binary replacement and raw backend objects remain unavailable.

## Cross-domain evidence

Collected before final documentation freeze and rerun:

- TypeScript: PASS
- correctness ESLint: PASS
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 suite / 1 test PASS`
- Permanent Regression: `19/19 PASS`
- ARC-C001.1 minimum baseline: PASS
- LSC-G1: PASS
- LRC-G1: PASS
- LPL-G1: PASS
- LEX-G1: PASS
- COL-0: PASS

## Cumulative Workspace evidence

Historical gate evolution was handled deliberately:

- WS-9C no longer freezes the obsolete implementation detail that Asset Context is projected from internal `selectedAssetId`; its permanent invariant is now canonical ResourceId projection.
- WS-9E no longer freezes the stage-local non-goal that Project/Resource Providers must be absent; its permanent invariant is that later Provider evolution must remain behind Provider Registry and must not expose raw backend authority.

After those permanent-invariant corrections, WS-9A through WS-9E focused gates continue to PASS.

## Final cumulative Workspace focused evidence

- WS-8: `27/27 machine PASS`, `6 suites / 22 tests PASS`
- WS-9A: `12/12 machine PASS`, `2 suites / 15 tests PASS`
- WS-9B: `12/12 machine PASS`, `3 suites / 24 tests PASS`
- WS-9C: `12/12 machine PASS`, runtime `3 suites / 21 tests PASS`, DOM `2 suites / 24 tests PASS`
- WS-9D: `13/13 machine PASS`, `7 suites / 35 tests PASS`
- WS-9E: `14/14 machine PASS`, `6 suites / 36 tests PASS`
- WS-9F: `15/15 machine PASS`, Node `6 suites / 51 tests PASS`, DOM `1 suite / 3 tests PASS`

## Full Unit evidence

Final full Unit rerun after lifecycle hardening:

- Node environment: `133 suites / 717 tests PASS`
- DOM harness: `3 suites / 27 tests PASS`
- Total: `136 suites / 744 tests PASS`

## Full Editor Webpack note

The stage-specific Project/Resource production entries are compiled independently by `test:workspace-shell:ws9f-webpack`.

The full Editor Webpack command was also attempted for cumulative evidence. The large production graph again exceeded the execution environment's 120-second command window while Babel/Webpack was processing production dependencies. No compile error was emitted before timeout. The timed-out process was terminated and no Webpack process remained afterward.

The result is recorded as **INCONCLUSIVE**, never as PASS and never as FAIL.
