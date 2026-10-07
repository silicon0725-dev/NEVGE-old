# WS-10C｜Verification Record

**Stage:** `WS-10C | Reviewed Resource Content Replace Transaction`  
**Status:** `COMPLETE / VERIFIED`  
**Baseline:** `WS-10B COMPLETE / VERIFIED`

## Stage-specific evidence

```text
Machine reviewed-content transaction gate
23 / 23 PASS

Focused Jest
Node: 6 suites / 47 tests PASS
DOM:  1 suite  /  2 tests PASS
Total: 7 suites / 49 tests PASS

WS-10C production Webpack entries
src/lib/project-assets/image-content-payload.js
src/lib/project-assets/global-asset-database.js
src/lib/editor-shell/project-command-host.js
src/lib/editor-shell/project-transaction-review.js
src/lib/editor-shell/paint-tool-runtime.js
src/components/workspace-paint/workspace-paint.jsx
0 errors / 0 warnings PASS

Full Editor Webpack
src/playground/editor.jsx
0 errors / 0 warnings PASS
```

## Full regression evidence

```text
Full Unit
Node: 143 suites / 783 tests PASS
DOM:    3 suites /  27 tests PASS
Total: 146 suites / 810 tests PASS

Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

TypeScript
PASS

ESLint correctness
PASS

Permanent Regression
19 / 19 PASS
```

## Frozen architecture / containment evidence

```text
ARC-C001.1 baseline
7 / 7 PASS

LSC-G1 machine certification
19 / 19 PASS

LRC-G1 machine certification
15 / 15 PASS

LPL-G1 machine certification
17 / 17 PASS

LEX-G1 machine certification
19 / 19 PASS

COL-0 machine DoD
15 / 15 PASS
```

## Workspace cumulative evidence

The WS-9 reviewed-mutation foundation and both preceding Paint stages were rechecked after adding Resource content mutation.

```text
WS-9 Aggregate Certification
20 / 20 PASS

WS-9H current focused
17 / 17 machine PASS
5 suites / 46 tests PASS

WS-9I current focused
18 / 18 machine PASS
6 suites / 55 tests PASS

WS-10A current focused
18 / 18 machine PASS
8 suites / 51 tests PASS

WS-10A historical Certificate
23 / 23 PASS

WS-10B current focused
20 / 20 machine PASS
7 suites / 42 tests PASS

WS-10B historical Certificate
27 / 27 PASS
```

Historical certificates are not rewritten when later stages add new commands/tests. Their validators were adjusted only where a temporary roadmap/source-text assumption had incorrectly become a permanent assertion. Permanent authority and admission rules remain enforced.

## Verified content-transaction properties

- `resource.content.replace` is a versioned Project command, not a direct Resource Tool mutation.
- The command requires canonical `ngvge:resource:*` identity and a bounded portable SVG/data-URI payload.
- Project Command and Resource Authority independently validate image geometry; geometry is not accidentally sourced from the payload-only normalizer.
- Each image Resource has a runtime content revision used as an optimistic source precondition.
- Rename/move metadata does not advance the content revision and therefore does not falsely stale a Paint Working Copy.
- External content replacement advances content revision and produces a blocking stale Review diagnostic for old Working Copies.
- `contentRevision` remains runtime-only and is not added to the persisted Global Asset Database v3 record schema.
- SVG bytes are sanitized at the Resource commit boundary before Scratch compatibility storage/renderer loading.
- Scratch storage asset creation and renderer-compatible costume loading remain inside Global Asset Resource Authority.
- Project Command Host coordinates transaction semantics but does not receive VM/renderer/storage handles.
- Review distinguishes `resource.content` from `resource.metadata`, exposes summaries only, and does not copy raw image bytes into the Review DTO.
- Content replacement remains subject to fresh one-shot WS-9I Review Evidence.
- Direct `resource-command#mutate` remains denied to Better Paint.
- Successful commit and reviewed rollback both reload Paint from authoritative Resource content.
- Paint UI/runtime contains no direct `vm.updateSvg` or `vm.updateBitmap` mutation shortcut.

## Result

`WS-10C` satisfies its Definition of Done and is frozen as `COMPLETE / VERIFIED`.
