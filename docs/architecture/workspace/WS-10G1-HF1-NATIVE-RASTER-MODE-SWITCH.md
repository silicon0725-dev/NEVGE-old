# WS-10G1-HF1 | Explicit Paint Mode Switch & Native Raster Routing

Status: **IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING**

Architecture parent: `ARC-0001 | Kernel Independence Contract`

Inherited contracts:

- `WS-10D | 2D Art & Animation Semantic Freeze`
- `WS-10E | PaintBackendContract & OSS Intake`
- `WS-10F2B | Unified Native Paint Shell`
- `WS-10G0 | Shared Paint Platform / Raster Intake Foundation`
- `WS-10G1 | Shared Raster Core / Bitmap POC`

## Trigger

First real browser verification of WS-10G1 showed a PNG costume inside the visually unchanged Scratch bitmap editor. The visible `转换为矢量图` action proved that the current presentation was the Scratch Paint compatibility surface, not the new NGVGE Raster Core.

Two product defects were therefore confirmed:

1. the Native Paint host had no visible backend/editor-mode switch, so a tester could not deliberately enter or compare the native Raster Core;
2. compatibility mode returned the Scratch editor without disclosing which backend owned the current presentation, making a routing failure indistinguishable from the intended compatibility fallback.

WS-10G1 browser certification is therefore not inherited from machine tests. It remains pending until HF1 is verified in a real NGVGE browser.

## Resolution

Native Paint now owns one explicit presentation-level editor selector:

```text
Editor Mode
[Auto] [Vector] [Bitmap] [Pixel] [Scratch]       Active: <backend>
```

The selector changes **presentation/backend policy only**. It does not rewrite Resource content merely to open another editor.

### Auto

`Auto` derives the backend from canonical source semantics:

```text
SVG          -> Vector -> SVG-Edit adapter
PNG/JPG      -> Bitmap -> NGVGE Canvas Raster Core
other format -> Scratch Paint compatibility
```

### Vector

Vector is enabled only for SVG source content. It cannot silently rasterize a PNG or claim a Vector backend for incompatible content.

### Bitmap

Bitmap is enabled only for PNG/JPG source content. Selecting it explicitly guarantees that the Native Paint presentation is the NGVGE Raster Core. The top status must read:

```text
Active: NGVGE Raster Core
```

Scratch Paint must not be mounted in this branch.

### Pixel

Pixel remains visible so the intended shared-Raster architecture is discoverable, but it is disabled. WS-10G1 does not pretend the Pixel policy consumer exists before that stage lands.

### Scratch

Scratch is now an explicit compatibility choice rather than an invisible fallback. Entering it releases the canonical Paint Resource selection and mounts Scratch Paint under the compatibility branch. The status must read:

```text
Active: Scratch Paint compatibility
```

This prevents Scratch Paint and the NGVGE Working Copy from simultaneously presenting themselves as mutation authority.

## Source-format resolution hardening

The previous routing path trusted one `costume.dataFormat` field. HF1 resolves the format from the available Scratch costume representations in deterministic order:

1. `costume.dataFormat`
2. `costume.asset.dataFormat`
3. broken-asset metadata when present
4. `md5` / `md5ext` filename extension fallback

`jpeg` is normalized to `jpg`.

This specifically covers runtime/import shapes where PNG content has a valid `.png` asset identity but `dataFormat` is absent at the UI boundary.

## Dirty Working Copy rule

A dirty canonical Working Copy still blocks changing costume or editor mode. The user must Review/Commit/Discard first. HF1 does not weaken transaction or Resource authority for convenience.

## Authority statement

The editor-mode switch is presentation policy owned by the Native Paint host. It does not move any of the following into SVG-Edit, Canvas Raster, or Scratch Paint:

- Resource identity;
- ArtDocument identity;
- Project persistence;
- transaction/review/commit authority;
- Working Copy authority;
- Layer/Frame/Cel stable identity.

`Scratch` remains compatibility only. `Bitmap` remains behind `PaintBackendContract`.

## Browser acceptance

For PNG/JPG:

1. open the costume/backdrop;
2. confirm the `Editor Mode` bar is visible;
3. choose `Bitmap`;
4. confirm `Active: NGVGE Raster Core`;
5. confirm Scratch's `转换为矢量图` control is absent;
6. exercise Brush / Eraser / Fill / Eyedropper / Undo / Redo / zoom / pan;
7. choose `Scratch` and confirm the legacy Scratch editor appears intentionally;
8. choose `Bitmap` again and confirm Raster Core returns without changing source format.

Do not mark WS-10G1 COMPLETE until this real-browser evidence passes.
