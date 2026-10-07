# WS-10F2B HF1 Verification

Hotfix: **Selection Overlay Zoom / Transform Alignment**

Status: **COMPLETE / VERIFIED**

## Root-cause evidence

The installed `@svgedit/svgcanvas@7.4.2` source was audited directly. HF1 does not infer the transform contract from NGVGE test doubles.

The audited relationship is machine-gated:

- `updateCanvas(width,height)` sizes and centers `svgcontent` from the current SVG-Edit zoom;
- the same centered `x/y` is applied to `selectorParentGroup`;
- `Selector.resize()` expresses selector bbox/transform geometry in the same zoomed canvas coordinate space;
- rubber-band selection and path-point overlays are parented into the SVG-Edit selector presentation chain;
- pointer hit testing derives CTM from `svgcontent` and uses the same SVG-Edit zoom.

Therefore the former NGVGE root-level `svgroot viewBox` fit shim was a second presentation scale applied around already-zoomed SVG-Edit geometry. HF1 removes that independent scale authority.

## Frozen transform contract

```text
SVG-Edit zoom + updateCanvas viewport
        |-- svgcontent
        |-- selectorParentGroup / selectors / path grips
        `-- hit-test CTM source
```

NGVGE may request Fit/manual zoom and presentation pan, but it must not create an independent scale for the selector layer. Host resize remains presentation-only and never calls `setResolution()` or changes authored SVG dimensions.

## Permanent regression evidence

Final focused rerun on the WS-10F2C working tree:

- real SVG-Edit package DOM/transform source gate: **14 / 14 PASS**
- HF1 semantic machine gate: **25 / 25 PASS**
- SVG-Edit vector adapter: **1 suite / 24 tests PASS**
- fixed zoom selector alignment: **25% / 50% / 100% / 200% PASS**
- Fit-after-manual selector alignment: **PASS**
- manual zoom + host resize preserves requested zoom: **PASS**
- Hand/pan keeps `svgcontent` and `selectorParentGroup` on the same translated viewport: **PASS**
- document-resolution mutation during zoom/fit/host resize/pan: **none**
- WS-10F2B machine gate: **27 / 27 PASS**
- focused Native Paint Node/DOM inheritance: **PASS**
- inherited HF3 presentation gate: **12 / 12 PASS**
- inherited HF4 transfer gate: **8 / 8 PASS**

## Cross-cutting evidence

- ARC-C001.1 minimum baseline: **7 / 7 PASS**
- LRC-G1 certification: **9 / 9 PASS**
- LPL-G1 certification: **9 / 9 PASS**
- LEX-G1 certification: **9 / 9 PASS**
- LSC-G1 certification: **7 / 7 PASS**
- COL-0: **4 suites / 12 tests PASS**
- permanent regression runner: **PASS**
- TypeScript scope: **PASS**
- ESLint correctness: **PASS**
- Integration: **4 suites / 5 tests PASS**
- Smoke: **1 / 1 PASS**

A production Webpack Vector entry run on the HF1 source returned **0 errors / 0 warnings**. Later duplicate/WS-10F2C production build attempts exceeded the execution window and are recorded separately as **INCONCLUSIVE**; an execution timeout is not rewritten as PASS or FAIL.

## Freeze result

`WS-10F2B-HF1` is frozen as **COMPLETE / VERIFIED**. Any future SVG-Edit dependency change or viewport implementation change must re-run the package-source transform contract and all five zoom states before the selector transform authority may be considered preserved.
