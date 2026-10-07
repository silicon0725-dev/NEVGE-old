# WS-10F2A Verification｜Native Paint Host Migration

**Stage:** `WS-10F2A`  
**Result:** `COMPLETE / VERIFIED`  
**Date:** `2026-08-15`

## Scope verified

WS-10F2A changes Paint presentation ownership only. The native Costume / Backdrop `AssetPanel` becomes the primary Better Paint host. Vector content enters the existing canonical Resource / PaintSession / Working Copy / SVG-Edit path. Raster remains on the existing Scratch Paint compatibility surface until WS-10G.

## Focused evidence

```text
WS-10F HF4 cumulative SVG bridge
8 / 8 machine PASS
1 suite / 13 tests PASS
Vector production Webpack: 0 errors / 0 warnings

WS-10F2A machine gate
20 / 20 PASS

WS-10F2A focused Node
2 suites / 15 tests PASS

WS-10F2A focused DOM
1 suite / 2 tests PASS

WS-10F2A native production entries
0 errors / 0 warnings PASS
```

The native Resource adoption regression explicitly proves that two byte-identical unbound native costumes receive distinct canonical `ngvge:resource:*` identities rather than being silently content-deduplicated.

## Engineering regression

```text
Full Unit Node
153 suites / 856 tests PASS

Full Unit DOM
3 suites / 27 tests PASS

Combined Full Unit
156 suites / 883 tests PASS

Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

Permanent Regression
19 / 19 PASS

TypeScript
PASS

ESLint Correctness
PASS
```

## Frozen boundary evidence

```text
ARC-C001.1 Minimum Baseline    7 / 7 PASS
LRC-G1                        15 / 15 PASS
LPL-G1                        17 / 17 PASS
LEX-G1                        19 / 19 PASS
LSC-G1                        19 / 19 PASS
COL-0                         15 / 15 PASS
WS-9 Aggregate                20 / 20 PASS
WS-10E Certification          24 / 24 PASS
```

WS-9 aggregate continues to deny direct Resource Tool mutation and keeps reviewed Project mutation under the certified policy path. WS-10F2A does not grant `CostumeTab`, `NativePaintHost`, SVG-Edit or the legacy raster presenter new Project/Resource authority.

## Full Editor Webpack

A full `src/playground/editor.jsx` production build was attempted from the final WS-10F2A worktree. The command exceeded the current execution window while Babel was processing the large `scratch-render` graph and emitted no compile error before termination.

```text
Full Editor Webpack
INCONCLUSIVE

!= PASS
!= FAIL
```

This result is not promoted to PASS. The production entries directly changed by WS-10F2A (`native-paint-editor-host.jsx` and `costume-tab.jsx`) compile with `0 errors / 0 warnings` through the real project Webpack configuration.

## External SVG-Edit package status

WS-10F remains `IMPLEMENTED / CONDITIONAL VERIFIED` because the assistant verification worktree does not contain the real published package bytes needed by the existing package-byte promotion gate. The user has separately supplied browser evidence that real `@svgedit/svgcanvas@7.4.2` loads and renders SVG after HF1-HF4. WS-10F2A does not alter or weaken that gate.

## Result

WS-10F2A is verified as a host migration. It does not certify professional Vector tooling or final Paint UX. The next stage is `WS-10F2B | Unified Paint Shell`.
