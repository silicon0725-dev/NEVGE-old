# WS-10F HF1 | SVG-Edit Missing Package Isolation

Status: POST-STAGE HOTFIX / VERIFIED

## Problem

WS-10F introduced the approved `@svgedit/svgcanvas@7.4.2` vector backend dependency. Applying the overlay without subsequently synchronizing `node_modules` caused the Editor Webpack graph to fail module resolution, escalating one optional Paint backend into a full Workspace boot failure.

## Fix

Webpack now resolves `@svgedit/svgcanvas` through an optional Workspace-backend seam:

- when the published package is installed, `require.resolve('@svgedit/svgcanvas')` selects the real package;
- when it is absent or incomplete, the specifier aliases to a local fail-visible stub;
- the stub throws `NGVGE_PAINT_SVG_EDIT_PACKAGE_UNAVAILABLE` only when Vector Paint actually mounts;
- the rest of NGVGE continues to compile and boot.

The exact dependency remains `@svgedit/svgcanvas@7.4.2`. The existing WS-10F package-byte promotion gate is intentionally unchanged and must still reject a shim or missing package.

## Developer recovery

From the NGVGE project root:

```text
bun install --frozen-lockfile
bun run test:workspace-shell:ws10f-package
```

Then restart the dev server.

## Architecture boundary

Missing optional/high-capability Tool backends may make that Tool capability unavailable. They must not become a Workspace bootstrap authority or a reason for the Editor shell to fail to load.
