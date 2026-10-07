# WS-10G0 Validation Record

**Stage:** `WS-10G0｜Shared Paint Platform / Raster Intake Foundation`  
**Status:** `FOUNDATION VERIFIED`  
**Date:** `2026-08-15`

This record covers the accumulated `WS-10F2C-HF2 + WS-10G0` tree. A timeout is never rewritten as PASS or FAIL. The G0-specific production Webpack entry completed and therefore has explicit PASS evidence.

## Stage-specific / Focused

```text
WS-10G0 machine gate
  28 / 28 PASS

Focused Node
  4 suites / 14 tests PASS

Focused DOM
  native-paint-shell
  1 suite / 3 tests PASS
```

The focused tests cover the shared Paint tool vocabulary, Bitmap/Pixel Raster authoring policies, OSS intake/authority rejection, existing Paint backend candidates, and one backend-neutral Native Paint Shell presenting Bitmap tools without a Bitmap App Shell.

## Inherited Vector / Viewport Gates

```text
WS-10F2C-HF2 Scratch-style viewport contract  22 / 22 PASS
WS-10F2C-HF1 infinite workspace              17 / 17 PASS
WS-10F2B-HF1 real SVG DOM transform          14 / 14 PASS
WS-10F2B-HF1 selection alignment             25 / 25 PASS
WS-10F2C SVG-Edit professional core          28 / 28 PASS
WS-10F2C machine                              40 / 40 PASS
Vector backend adapter                       1 suite / 30 tests PASS
Relevant Vector DOM                          2 suites / 3 tests PASS
```

This proves the backend-neutral extraction did not regress the browser-verified Vector base, selection alignment, zoom/fit/pan, or Scratch-style viewport model.

## Production Webpack

Command:

```text
npm run test:workspace-shell:ws10g0:webpack
```

Result:

```text
PASS
errors:   0
warnings: 0
```

The production entry bundles the changed G0 surfaces directly:

```text
Native Paint Shell
Paint Tool Profiles
Raster Authoring Policy
Raster Backend Intake
```

It intentionally does not import the heavy SVG-Edit WorkspaceVectorEditor entry because that is not a G0 change. The inherited Vector production path remains governed by its existing Vector/F2C gates.

## Cross-cutting Gates

```text
TypeScript scope        PASS
ESLint correctness      PASS
Permanent Regression    19 / 19 PASS
Integration             4 suites / 5 tests PASS
Smoke                   1 suite / 1 test PASS

Full Unit (Node)        159 suites / 888 tests PASS
Full Unit (DOM)         3 suites / 27 tests PASS

ARC-C001.1 baseline     PASS
LRC-G1                  PASS
LPL-G1                  PASS
LEX-G1                  PASS
LSC-G1                  PASS
COL-0                   PASS
```

The existing Scratch VM service-provider replacement warnings and existing sanitizer warning were visible during inherited test runs but did not fail their suites; they are not hidden or promoted into G0 failures.

## Authority / OSS Intake Result

G0 does not add miniPaint or Piskel as runtime dependencies. Their verified source surfaces are recorded only as controlled-extraction candidates. App Shell, File/Save, persistence, History, Timeline, FrameId, LayerId, CelId, Resource, Transaction and Project authority remain rejected.

Reviewed upstream pins:

```text
miniPaint     master  a79733eb803fc97084ef0ee4faa96b031e69e1c0  MIT
Piskel        master  a6b9c02daefceb10093f71e92d52d16920ccb16e  Apache-2.0
Scratch Paint develop f8966f09df9a994c207db10b4ab52f530a1172d8 AGPL-3.0 / reference-only
```

The Scratch Paint license metadata was corrected from the older `GPL-3.0` label to the reviewed upstream AGPL-3.0 license. No Scratch Paint implementation is copied by G0.

## Verdict

```text
WS-10G0
Shared Paint Platform / Raster Intake Foundation
IMPLEMENTED / FOUNDATION VERIFIED
```

This verdict does **not** certify Bitmap or Pixel editing. The next stage is `WS-10G1｜Shared Raster Core / Bitmap Surface POC`.
