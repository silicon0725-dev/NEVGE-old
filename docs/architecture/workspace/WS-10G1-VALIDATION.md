# WS-10G1 Validation Record

**Status:** `MACHINE VERIFIED / BROWSER EVIDENCE PENDING`

## Stage-specific

- WS-10G1 machine gate: `30/30 PASS`
- Focused Node: `4 suites / 14 tests PASS`
- Native Host DOM: `1 suite / 3 tests PASS`
- Production Webpack Raster entries: `PASS — 0 errors / 0 warnings`

## Inherited Paint gates

- WS-10G0 machine: `28/28 PASS`
- WS-10G0 focused Node: `4 suites / 14 tests PASS`
- WS-10G0 Native Shell DOM: `3/3 PASS`
- WS-10F2C-HF2: `22/22 PASS`
- WS-10F2C-HF1: `17/17 PASS`
- WS-10F2B-HF1 real SVG-Edit DOM: `14/14 PASS`
- WS-10F2B-HF1 selection alignment: `25/25 PASS`
- WS-10F2C SVG-Edit professional core: `28/28 PASS`
- WS-10F2C machine: `40/40 PASS`
- Vector adapter: `30/30 PASS`

## Global

- Permanent Regression: `19/19 PASS`
- Full Unit / Node: `162 suites / 899 tests PASS`
- Full Unit / DOM harness: `3 suites / 27 tests PASS`
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1/1 PASS`
- TypeScript scope: `PASS`
- ESLint correctness: `PASS`
- ARC-C001.1: `7/7 PASS`
- LRC-G1: `15/15 PASS`
- LPL-G1: `17/17 PASS`
- LEX-G1: `19/19 PASS`
- LSC-G1: `19/19 PASS`
- COL-0: `15/15 PASS`

Known pre-existing Scratch VM provider-replacement and sanitizer warnings remain visible and are not converted into failures or hidden.

## Browser evidence

`PENDING` — the machine cannot substitute for a real interactive NGVGE browser check of painting, erasing, fill, eyedropper, zoom/pan, save/reload and costume switching. Do not mark WS-10G1 COMPLETE until this is supplied.

## HF1 correction — explicit editor/backend identity

The first real browser attempt did **not** validate the Raster Core. A PNG was visibly rendered by Scratch Paint compatibility (`转换为矢量图` was present), and no explicit backend selector existed. That observation invalidates any interpretation of the earlier machine evidence as browser evidence.

WS-10G1-HF1 adds `Auto / Vector / Bitmap / Pixel / Scratch` presentation selection and an always-visible active-backend label. PNG/JPG `Auto` and explicit `Bitmap` route to `NGVGE Raster Core`; explicit `Scratch` routes to compatibility. Pixel remains disabled/pending.

HF1 browser status: `PENDING`.

### HF1 machine verification

- WS-10G1-HF1 explicit mode-switch gate: `22/22 PASS`
- WS-10G1 inherited machine gate: `30/30 PASS`
- HF1 focused Node: `4 suites / 18 tests PASS`
- HF1 Native Host DOM: `1 suite / 4 tests PASS`
- WS-10G0 focused: `PASS` (`28/28` machine, `14/14` Node, `3/3` DOM)
- WS-10F2C-HF2 inherited focused chain: `PASS`
- TypeScript scope: `PASS`
- ESLint correctness: `PASS`
- WS-10G1 production Raster-entry Webpack: `PASS — 0 errors / 0 warnings`
- Permanent regression: `19/19 PASS`
- Integration: `PASS`
- Smoke: `PASS`

A full unit rerun was also started after HF1, but the repository-wide runner exceeded the execution window before printing its final aggregate summary. It is therefore **not** counted as new HF1 full-suite evidence. The stage remains browser-pending regardless.
