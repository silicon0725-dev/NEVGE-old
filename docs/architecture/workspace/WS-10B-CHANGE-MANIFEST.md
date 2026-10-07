# WS-10B｜Change Manifest

**Stage:** `WS-10B | Paint Content Read / Working Copy Adapter`  
**Baseline:** `WS-10A COMPLETE / VERIFIED`

## New production files

```text
src/lib/editor-shell/workspace-resource-content-capability.js
src/lib/editor-shell/paint-working-copy.js
src/lib/editor-shell/scratch-paint-working-copy-adapter.js
```

## Modified production files

```text
src/lib/editor-shell/tool-capability.js
src/lib/editor-shell/tool-capability-descriptors.js
src/lib/editor-shell/workspace-capability-providers.js
src/lib/editor-shell/paint-tool-runtime.js
src/lib/tw-scratch-paint.js
src/components/gui/gui.jsx
src/components/workspace-paint/workspace-paint.jsx
src/components/workspace-paint/workspace-paint.css
```

## New tests / gates

```text
test/unit/lib/editor-shell/workspace-resource-content-capability.test.js
test/unit/lib/editor-shell/paint-working-copy.test.js
test/unit/lib/editor-shell/scratch-paint-working-copy-adapter.test.js
scripts/validate-ws10b-paint-working-copy.js
scripts/validate-ws10b-webpack-paint-content-entry.js
scripts/validate-ws10b-certification.js
```

## Evolved tests / cumulative gates

```text
test/unit/lib/editor-shell/paint-tool-runtime.test.js
test/unit/components/workspace-paint.test.jsx
scripts/validate-ws10a-paint-tool-admission.js
scripts/validate-ws10a-certification.js
package.json
```

The WS-10A validators were relaxed only where they encoded exact old UI/source layout rather than the permanent WS-10A authority contract. WS-10A historical certification data is not rewritten.

## New architecture / verification files

```text
docs/architecture/workspace/WS-10B-PAINT-CONTENT-READ-WORKING-COPY-ADAPTER.md
docs/architecture/workspace/WS-10B-VERIFICATION.md
docs/architecture/workspace/WS-10B-CERTIFICATE.json
docs/architecture/workspace/WS-10B-CHANGE-MANIFEST.md
docs/architecture/workspace/WS-10B-content-working-copy-matrix.csv
```

## Production behavior introduced

- Paint can read canonical image Resource content through a dedicated scoped capability.
- Image source content is converted to a portable immutable snapshot with a source-authority revision.
- A transient Paint working copy is created inside the Tool session.
- Scratch Paint may edit the working copy through an explicit adapter seam.
- Vector edits remain SVG text; bitmap edits become local PNG data URIs.
- Dirty copies block silent Resource/context switching.
- Source content changes mark working copies stale rather than overwriting them.
- Discard/reload are explicit.
- Minimizing/remounting the view does not transfer working-copy ownership to Window state.

## Explicitly unchanged

- No SVG/bitmap content replacement Project command exists yet.
- No Better Paint drawing callback calls VM/renderer/Target mutation APIs.
- Metadata mutation still uses the WS-10A reviewed Project transaction path.
- `resource-command#mutate` remains unavailable to Paint.
- Scratch Paint remains a replaceable backend, not NGVGE semantic authority.
- Better Terminal remains planned.
