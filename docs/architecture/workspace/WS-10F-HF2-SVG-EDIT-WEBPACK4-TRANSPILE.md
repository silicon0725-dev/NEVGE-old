# WS-10F HF2 | SVG-Edit Webpack 4 Transpile Boundary

Status: HOTFIX / VERIFIED
Baseline: WS-10F + HF1

## Symptom

After the real `@svgedit/svgcanvas@7.4.2` package is installed, the Editor can fail during Webpack 4 parsing with a message similar to:

`Module parse failed: Unexpected token ... node_modules/@svgedit/svgcanvas/dist/svgcanvas.js`

The package is present; this is not the HF1 missing-package condition.

## Root cause

SVG-Edit 7.x is published for modern browsers and its JavaScript may contain modern syntax such as optional chaining. NGVGE currently uses Webpack 4. The base JavaScript Babel rule historically transpiled project source and a small allowlist of dependencies, but did not include `@svgedit/svgcanvas`.

Webpack 4 therefore attempted to parse the published SVG-Edit bundle before Babel had transformed its modern syntax.

## Fix

`@svgedit/svgcanvas` is now an explicit Babel transpilation allowlist entry:

`/node_modules[\\/]@svgedit[\\/]svgcanvas[\\/]/`

This remains deliberately narrow. NGVGE does not transpile all of `node_modules`.

## Permanent boundary

High-capability OSS backends must satisfy both host boundaries:

1. missing dependency -> fail-visible Tool/backend unavailability, never Workspace startup failure (HF1)
2. installed modern dependency -> host build pipeline must transpile syntax that the current Webpack parser cannot consume (HF2)

Neither rule grants the backend Project, Resource, Transaction, Persistence, Timeline, or Window authority.

## Regression evidence

`npm run test:workspace-shell:ws10f-hf2`

The HF2 validator compiles a synthetic `node_modules/@svgedit/svgcanvas/dist/svgcanvas.js` fixture containing optional chaining and nullish coalescing through the real NGVGE Webpack 4 configuration. The gate fails if the package leaves the Babel allowlist.
