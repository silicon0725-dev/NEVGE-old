# WS-10B｜Verification Record

**Stage:** `WS-10B | Paint Content Read / Working Copy Adapter`  
**Status:** `COMPLETE / VERIFIED`  
**Baseline:** `WS-10A COMPLETE / VERIFIED`

## Stage-specific evidence

```text
Machine content / working-copy gate
20 / 20 PASS

Focused Jest
Node: 6 suites / 38 tests PASS
DOM:  1 suite  /  2 tests PASS
Total: 7 suites / 40 tests PASS

WS-10B production Webpack entries
src/lib/editor-shell/workspace-resource-content-capability.js
src/lib/editor-shell/paint-working-copy.js
src/lib/editor-shell/scratch-paint-working-copy-adapter.js
src/components/workspace-paint/workspace-paint.jsx
src/lib/editor-shell/workspace-capability-providers.js
0 errors / 0 warnings PASS

Full Editor Webpack
src/playground/editor.jsx
0 errors / 0 warnings PASS
```

The normal shell invocation hit the execution window while compiling the large Scratch renderer dependency. The unchanged final source was then run through the same real Editor-entry validator under a longer controlled execution window and completed with `0 errors / 0 warnings`. That completed result is the build evidence.

## Full regression evidence

```text
Full Unit
Node: 142 suites / 775 tests PASS
DOM:    3 suites /  27 tests PASS
Total: 145 suites / 802 tests PASS

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

The focused chain was rerun after introducing `resource-content-read#query` and activating the real Paint backend seam.

```text
WS-8   28 / 28 machine PASS; 6 suites / 22 tests PASS
WS-9A  12 / 12 machine PASS
WS-9B  12 / 12 machine PASS
WS-9C  12 / 12 machine PASS
WS-9D  13 / 13 machine PASS
WS-9E  14 / 14 machine PASS
WS-9F  15 / 15 machine PASS
WS-9G  16 / 16 machine PASS
WS-9H  17 / 17 machine PASS
WS-9I  18 / 18 machine PASS

WS-9 Aggregate Certification
20 / 20 PASS

WS-10A current focused
18 / 18 machine PASS
8 suites / 49 tests PASS

WS-10A historical Certificate
23 / 23 PASS
```

WS-10A's historical certificate remains unchanged; it records the evidence that existed when WS-10A was frozen. The current focused total is larger because WS-10B added working-copy/runtime/UI assertions to the same Paint surfaces.

## Verified authority properties

- `resource-content-read#query` is distinct from Resource metadata read and from Resource mutation.
- Tool-visible image source snapshots are portable, frozen, canonical-ResourceId-addressed and bounded to 32 MiB.
- Scratch storage/asset objects remain inside the provider/Resource authority closure.
- Paint working copies are transient Tool-session state, not Project/Resource source of truth.
- Dirty working copies cannot be silently replaced by Resource or Context switching.
- Resource content changes mark copies stale; metadata-only rename/move does not falsely mark image content stale.
- Scratch Paint edits are converted back into portable local SVG/PNG working-copy edits.
- Workspace backend activation does not grant content mutation authority.
- Paint's drawing callback does not call `vm.updateSvg`, `vm.updateBitmap`, `vm.renameCostume`, renderer mutation or raw Scratch asset mutation.
- No Project image-content replacement command is activated in WS-10B.
- WS-10A reviewed metadata mutation remains intact and separate from local image edits.
- Better Terminal remains planned.

## Result

`WS-10B` satisfies its Definition of Done and is frozen as `COMPLETE / VERIFIED`.
