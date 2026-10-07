# WS-10F2B HF1 | Selection Overlay Zoom / Transform Alignment

Status: **COMPLETE / VERIFIED**

## Problem

After WS-10F2B moved the SVG-Edit canvas into the native Paint Shell, authored SVG content could be fitted into the host while SVG-Edit's selection overlay was rendered in a different presentation coordinate system. The visible symptom was an oversized or displaced blue selector/rubber-band region while the authored object remained at the expected location.

## Root cause — audited against real @svgedit/svgcanvas@7.4.2 source

The installed SVG-Edit package does **not** treat content, selection and hit testing as three independent overlays.

`core/selected-elem.js:updateCanvas(width, height)`:

1. reads `SvgCanvas.getZoom()`;
2. computes centered `x/y` from `contentW * zoom` / `contentH * zoom`;
3. gives `svgcontent` presentation width/height equal to document dimensions multiplied by zoom;
4. keeps `svgcontent`'s own document-space `viewBox`;
5. applies the same centered `translate(x,y)` to `selectorParentGroup`.

`core/select.js:Selector.resize()` independently expresses selector bbox geometry in the same zoomed canvas coordinate space by multiplying bbox coordinates/dimensions and transform translations by `zoom`. `selectorParentGroup` is attached directly under `svgroot`, and the rubber-band selector also lives inside that group.

`core/event.js` hit testing derives its root CTM from `svgcontent`'s first child group and multiplies transformed pointer coordinates by the same SVG-Edit zoom.

Therefore an NGVGE-owned outer `svgroot viewBox` is a **second scale** applied on top of coordinates that SVG-Edit already zoomed. That was the source of the oversized/misaligned blue selection visualization.

## Frozen hotfix rule

For the SVG-Edit vector backend:

1. `SvgCanvas.setZoom()` owns SVG-Edit presentation zoom state.
2. `SvgCanvas.updateCanvas()` owns presentation width/height/centering for SVG content and selector layers.
3. Canvas content transform, selection overlay transform and hit-test transform MUST derive from that shared SVG-Edit viewport transform.
4. The host MUST NOT independently scale `selectorParentGroup`, selector rectangles, grips, path-node overlays, or rubber-band selection.
5. The host MUST NOT use an outer `svgroot` `viewBox` / `preserveAspectRatio` as a substitute for SVG-Edit canvas geometry.
6. Workspace/native-host resize MUST remain presentation-only and MUST NOT call `setResolution()` / `setCurrentZoom()` or mutate authored SVG dimensions.
7. Existing selectors are refreshed through `Selector.resize()` and path-node overlays through `pathActions.zoomChange()` after every zoom/fit/host-resize presentation update.
8. `getSvgString()` / NGVGE Working Copy remains the authoring boundary; host presentation geometry is not project content.
9. The installed SVG-Edit source relationship above is guarded by a package-source machine gate pinned to `@svgedit/svgcanvas@7.4.2`; changing the dependency must force a transform-contract re-audit.

## Zoom model frozen by HF1

HF1 separates presentation zoom into two host-facing modes without creating a second transform authority:

```text
Fit mode
  host measures viewport
  -> compute fit zoom with VECTOR_FIT_PADDING
  -> SvgCanvas.setZoom(fitZoom)
  -> SvgCanvas.updateCanvas(width, height)

Manual mode
  25% / 50% / 100% / 200% (and future valid positive zoom)
  -> SvgCanvas.setZoom(manualZoom)
  -> SvgCanvas.updateCanvas(width, height)
```

A host/window resize while in Manual mode preserves the manual zoom and only recomputes SVG-Edit centering. A host/window resize while in Fit mode recomputes Fit. Neither path changes document resolution.

## Permanent regression matrix

The adapter regression must permanently cover:

- 25%
- 50%
- 100%
- 200%
- Fit to View
- manual zoom + host resize

For every fixed zoom, the selected object's viewport geometry and selector viewport geometry must be equal under the shared SVG-Edit transform model. Fit must restore that same equality after arbitrary manual zooms.

## Runtime flow

```text
Native Paint canvas viewport
        |
        v
measure width / height
        |
        +--------------------------+
        |                          |
        v                          v
   Fit mode                   Manual mode
compute fit zoom              keep manual zoom
        |                          |
        +------------+-------------+
                     v
             SvgCanvas.setZoom(zoom)
                     |
                     v
        SvgCanvas.updateCanvas(width, height)
             |                  |
             |                  +--> selectorParentGroup translate(x,y)
             +--> svgcontent width/height/x/y + own document viewBox
                     |
                     v
          Selector.resize() / pathActions.zoomChange()
                     |
                     v
          content = selection = hit-test coordinate authority
```


## Verification freeze

HF1 is frozen only after direct audit of `@svgedit/svgcanvas@7.4.2`, permanent 25% / 50% / 100% / 200% / Fit selector-alignment regressions, host-resize semantic-resize separation, inherited Paint gates, cross-cutting certification gates, and production Webpack evidence. WS-10F2C Hand/Pan continues to reuse this same viewport authority rather than introducing a second transform chain.
