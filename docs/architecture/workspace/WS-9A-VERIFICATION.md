# WS-9A Verification

Stage: `WS-9A | Capability Schema & Admission Foundation`  
Status: `COMPLETE / VERIFIED`  
Baseline: `WS-8 COMPLETE / VERIFIED`

## Focused evidence

- WS-9A machine gate: `12 / 12 PASS`
- WS-9A + WS-8 contract Jest: `2 suites / 11 tests PASS`
- Capability production entry Webpack: `PASS`, `0 errors`, `0 warnings`
- Changed source/tooling ESLint: `PASS`

## Cumulative Workspace evidence

The monolithic `npm run test:workspace-shell:ws9a` run was interrupted by the execution environment's single-command timeout after WS-3A. Every completed constituent gate before the timeout passed. The remaining focused gates were then run explicitly rather than treating the timeout as a pass.

Explicit PASS evidence obtained in this worktree:

- RE-3 / RE-4 / RE-5: PASS
- WS-0 / WS-1 / WS-2: PASS
- WS-3A / WS-3B / WS-3C / WS-3D / WS-3E / WS-3F: PASS
- WS-4: PASS
- WS-5: PASS
- WS-6: PASS
- WS-7: PASS
- WS-8: PASS
- WS-9A: PASS

## General regression evidence

- Unit Node: `127 suites / 672 tests PASS`
- Unit DOM: `3 suites / 26 tests PASS`
- Total Unit: `130 suites / 698 tests PASS`
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 suite / 1 test PASS`
- TypeScript scope / 02Agent strict typecheck: `PASS`
- ESLint correctness source/tooling: `PASS`
- ESLint correctness tests: `PASS`

## Webpack evidence

### WS-9A capability entry

`src/lib/editor-shell/tool-capability-descriptors.js`

Result:

- exit: `0`
- errors: `0`
- warnings: `0`

### Full Editor entry

A current full Editor production-entry rebuild was attempted through the existing WS-8 validator. The build entered Babel/webpack processing but exceeded the execution environment's 120-second command limit before returning final stats.

This result is recorded as `TIMEOUT / NO FAILURE EVIDENCE`, not PASS and not compile failure.

WS-9A intentionally makes no production Editor behavior switch and does not import the new Capability Host from `gui.jsx` or another Editor entry module. The last frozen WS-8 certificate already contains a successful full Editor production Webpack result for the unchanged production entry graph. Therefore WS-9A certification relies on:

1. the preserved WS-8 Editor-entry baseline;
2. explicit verification that WS-9A introduces no production import/integration switch;
3. the successful real Webpack build of the new capability module graph itself.

A later substage that wires Capability Host into the production Workspace runtime must obtain a fresh completed Full Editor Webpack PASS and may not rely on this baseline-preservation rule.

## Security / authority evidence

Verified by machine gate and Jest:

- PLANNED tools cannot be admitted.
- Active ToolRegistry identity is required.
- Missing descriptors fail closed.
- Unknown capability identities fail closed.
- Unsupported access verbs fail closed.
- Ecosystem authority mismatch fails closed.
- Undeclared lease checks fail closed.
- Per-lease revocation invalidates stale references.
- Per-ToolId revocation invalidates all leases for that ToolId.
- Capability schema/Host imports no Scratch VM or renderer backend.
- Todo has only Workspace-state mutation admission.
- Terminal/Paint receive no WS-9A descriptor.

## Freeze conclusion

WS-9A is accepted as the schema/admission foundation only.

It does not certify provider binding, context propagation, automatic lifecycle revocation, host execution permission, Resource mutation implementation, Better Terminal, or Better Paint.
