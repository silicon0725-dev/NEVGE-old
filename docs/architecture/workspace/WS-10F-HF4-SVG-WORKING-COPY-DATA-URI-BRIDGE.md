# WS-10F HF4 | SVG Working-Copy Data-URI Bridge

Status: `HOTFIX / VERIFIED`

## Root cause

`WorkspaceResourceContentReadFacade` intentionally exposes image content as a portable `data-uri` record. SVG Resources therefore enter `WorkspacePaintWorkingCopyModel` as:

```text
dataFormat = svg
content.kind = data-uri
```

WS-10F's SVG-Edit transfer adapter incorrectly required `content.kind = svg-text`. The Vector backend could mount and render its toolbar, but transfer creation failed before `SvgCanvas.setSvgString(...)` received the authored document. The visible result was an initialized blank Vector canvas.

## Fix

The SVG-Edit transfer boundary now accepts either portable SVG representation:

```text
svg-text
or
image/svg+xml data-uri
```

SVG data URIs are decoded at the Vector transfer boundary and normalized to canonical `svg-text` before entering SVG-Edit.

This does not mutate the Project Resource or Working Copy source representation. It is a backend transfer normalization only.

## Boundary

- Resource Content Provider remains `data-uri` based.
- Paint Working Copy remains backend-independent.
- SVG-Edit receives canonical SVG text.
- non-SVG data URIs are rejected fail-closed.
- the Vector transfer does not depend on the scratch-paint compatibility adapter.
