# WS-10A｜Change Manifest

**Stage:** `WS-10A | Better Paint Tool Admission & Resource Editing Session Foundation`  
**Baseline:** `WS-9 COMPLETE / CERTIFIED` + `WS9-POST-CERT-HF1`  

## New architecture / verification files

```text
docs/architecture/workspace/ADR-WS10A-SCRATCH-PAINT-INTAKE.md
docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md
docs/architecture/workspace/WS-10A-BETTER-PAINT-TOOL-ADMISSION-RESOURCE-EDITING-SESSION.md
docs/architecture/workspace/WS-10A-VERIFICATION.md
docs/architecture/workspace/WS-10A-CERTIFICATE.json
docs/architecture/workspace/WS-10A-CHANGE-MANIFEST.md
docs/architecture/workspace/WS-10A-capability-admission-matrix.csv
```

## New production files

```text
src/lib/editor-shell/paint-tool-runtime.js
src/components/workspace-paint/index.js
src/components/workspace-paint/workspace-paint.jsx
src/components/workspace-paint/workspace-paint.css
```

## Modified production files

```text
src/lib/editor-shell/tool-registry.js
src/lib/editor-shell/tool-ecosystem-manifests.js
src/lib/editor-shell/tool-capability-descriptors.js
src/components/gui/gui.jsx
src/components/workspace-dock/workspace-dock.jsx
src/components/workspace-launchpad/workspace-launchpad.jsx
package.json
```

## New tests / gates

```text
test/unit/lib/editor-shell/paint-tool-runtime.test.js
test/unit/components/workspace-paint.test.jsx
scripts/validate-ws10a-paint-tool-admission.js
scripts/validate-ws10a-webpack-paint-entry.js
scripts/validate-ws10a-certification.js
```

## Evolved cumulative gates / tests

The following files remove stage-local assumptions that would incorrectly forbid a later approved Paint activation or retain the retired Agent Context callback as a permanent requirement. They preserve the architectural invariants instead.

```text
scripts/validate-ws7-agent-workspace-integration.js
scripts/validate-ws8-post-mvp-tool-ecosystem.js
scripts/validate-ws9a-tool-capability-admission.js
scripts/validate-ws9d-context-consumer-agent-migration.js

test/unit/lib/editor-shell/tool-registry.test.js
test/unit/lib/editor-shell/tool-ecosystem.test.js
test/unit/lib/editor-shell/tool-capability.test.js
```

## Production behavior introduced

- Better Paint is discoverable through ToolRegistry / Dock / Launchpad.
- Opening Paint creates a managed Workspace window and uses one admitted Paint session.
- Current canonical image Resource Context is consumed when available; users can select another image Resource from the portable resource list.
- Resource name edits are drafts until reviewed and committed through the WS-9 Project transaction path.
- The last committed Paint metadata transaction can be reviewed and rolled back when WS-9G rollback preconditions remain valid.

## Explicitly unchanged

- Legacy Scratch costume-tab paint integration remains compatibility code.
- New Workspace Paint does not call `vm.updateSvg`, `vm.updateBitmap`, or `vm.renameCostume`.
- No image binary/SVG content replacement semantics are added in WS-10A.
- No filesystem/process/network/credential capability is added.
- Better Terminal remains planned.
- WS-9 stable IDs and certified Authority contracts are unchanged.
