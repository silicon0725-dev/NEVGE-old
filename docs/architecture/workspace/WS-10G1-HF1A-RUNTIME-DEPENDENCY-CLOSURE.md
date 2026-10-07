# WS-10G1-HF1a | Native Raster Runtime Dependency Closure

Status: **HOTFIX / MACHINE VERIFIED / BROWSER RETEST REQUIRED**

## Trigger

First browser compilation after WS-10G1-HF1 reported:

`Cannot find module '../components/workspace-paint/workspace-raster-editor.jsx'`

The Native Paint host had already been updated to import the NGVGE Raster editor, but the user's applied tree did not contain the G1 Raster runtime dependency closure. This invalidates browser evidence for G1/HF1 until repaired.

## Repair boundary

HF1a does not change ARC-0001, WS-10D semantics, WS-10E PaintBackendContract, resource authority, or the Raster document model. It only makes the G1/HF1 runtime dependency closure self-contained and verifiable.

The repair payload carries the production runtime files needed by the Native Paint Bitmap path:

- `workspace-raster-editor.jsx`
- `canvas-raster-backend.js`
- `canvas-raster-transfer.js`
- `mini-paint-derived-raster-ops.js`
- the current G1/HF1 Native Paint host/model/styles and shared Raster presentation/runtime files

## Permanent regression

`test:workspace-shell:ws10g1-hf1a:imports` recursively resolves relative imports starting at `native-paint-editor-host.jsx`. A missing source module now fails before browser compilation.

The overlay apply script also performs this import-closure check after copying the payload, so a partially applied G1 tree cannot be reported as successfully repaired.

## Browser acceptance

After applying HF1a, the editor must compile. For a PNG/JPG costume:

- `Auto` or `Bitmap` must show `Active: NGVGE Raster Core`.
- Scratch Paint must only appear after explicitly selecting `Scratch`.
- `Pixel` remains unavailable until its Raster policy consumer is implemented.
