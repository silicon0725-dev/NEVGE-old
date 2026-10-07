# WS-10F Verification｜Vector Backend Integration

**Stage status:** `IMPLEMENTED / CONDITIONAL VERIFIED`  
**Verification date:** `2026-08-15`

## Executed evidence

### Focused adapter / Better Paint

```text
6 suites / 45 tests PASS
```

Covered:

- exact SVG-Edit adapter/package identity;
- canonical SVG Working Copy → Vector transfer;
- deterministic ArtDocumentId;
- `SvgCanvas` load / changed / export flow;
- stable ResourceId / ArtDocumentId after backend export;
- NGVGE vector-tool mapping;
- undo / redo / history projection;
- presentation-only resize;
- SVG Better Paint production branch;
- raster scratch-paint compatibility branch;
- Tool session backend diagnostics.

The focused adapter tests use an injected API-compatible `SvgCanvas` verification double. This verifies NGVGE behavior without pretending those bytes are the published OSS package.

### Machine boundary gate

```text
34 / 34 PASS
```

### Full Unit

```text
Node: 150 suites / 842 tests PASS
DOM:    3 suites /  27 tests PASS
Total: 153 suites / 869 tests PASS
```

### Integration / Smoke / Regression

```text
Integration: 4 suites / 5 tests PASS
Smoke:       1 suite / 1 test PASS
Regression:  19 / 19 PASS
```

### TypeScript

```text
PASS
```

### ESLint correctness

```text
PASS
```

### WS-10F production entry compile against local verification resolution

```text
0 errors / 0 warnings PASS
```

This compile proves the NGVGE adapter/component graph is Webpack-valid, but because the locally resolved SVG-Edit module is the verification double it is **not** accepted as published-package runtime evidence.

## Dependency resolution evidence

`package.json` pins:

```text
@svgedit/svgcanvas = 7.4.2
```

`bun.lock` pins:

```text
@svgedit/svgcanvas@7.4.2
sha512-18PixrbaGstEsZfijYeF+y69LDOfP/c68aVKR+Hh8S/YckbhxT4VpKJFf5Ang/Zd/Vvy63jPuf9O4pEDc4Gv+A==
```

## Pending external package-byte gate

The current harness shell cannot fetch the npm package. A tiny local verification double was used solely to let NGVGE production module resolution exercise the adapter graph while developing; it is **not** included in the delivered Overlay and is **not** accepted as real SVG-Edit runtime evidence.

The repeatable gate is:

```text
npm run test:workspace-shell:ws10f-package
```

It requires the actual installed package to expose the published TypeScript declaration file and production bundle. After a normal dependency install, this gate plus the WS-10F production/full Editor Webpack gates must be executed before promoting the stage to `COMPLETE / VERIFIED`.

## Result

```text
NGVGE source integration        PASS
Machine boundary gate           34/34 PASS
NGVGE focused behavior          6 suites / 45 tests PASS
Full Unit                       153 suites / 869 tests PASS
Integration / Smoke / Regression PASS
TypeScript                      PASS
ESLint correctness              PASS
Adapter graph Webpack           0 errors / 0 warnings PASS (verification resolution)
Published package byte gate     PENDING (harness network limitation)

Overall
IMPLEMENTED / CONDITIONAL VERIFIED
```
