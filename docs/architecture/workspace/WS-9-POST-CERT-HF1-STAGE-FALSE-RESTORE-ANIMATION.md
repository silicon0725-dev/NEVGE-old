# WS-9 Post-Cert Hotfix 1 | Stage False Dock Restore Animation

Status: `VERIFIED HOTFIX`
Base: `WS-9 COMPLETE / CERTIFIED (through WS-9I)`

## Symptom

Moving or resizing the Stage window could replay the presentation that visually restores the Stage from its Dock icon even though the Stage had never been minimized.

## Root cause

`WindowManager.restore()` always emitted `window:restored`, including when the target window was already `visible: true` and `minimized: false`.

`DockTransitionModel` intentionally treats `window:restored` as the semantic trigger for Dock-to-window presentation. An idempotent restore call could therefore be misrepresented as a real minimize/restore state transition during unrelated window geometry work.

## Fix

`WindowManager.restore()` now distinguishes three cases:

1. `minimized: true` -> publish `window:restored` and clear minimized state;
2. `visible: false`, `minimized: false` -> publish `window:opened`;
3. already visible and non-minimized -> semantic no-op (activation is still honored when requested).

The Dock animation itself is not disabled. Real `minimized: true -> false` transitions continue to emit `window:restored` and animate normally.

## Regression evidence

- WindowManager + DockTransitionModel focused: `2 suites / 16 tests PASS`
- Additional WS-3F related focused tests: `3 suites / 18 tests PASS`
- WS-3F machine gate: `26 / 26 PASS`
- WS-9I machine gate: `18 / 18 PASS`
- WS-9 aggregate certification: `20 / 20 PASS`
- Full Unit: `140 suites / 781 tests PASS`
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 / 1 PASS`
- Permanent Regression: `19 / 19 PASS`
- TypeScript: `PASS`
- ESLint correctness: `PASS`
- WS-3F transition production Webpack entry: `0 errors / 0 warnings PASS`
- Full Editor Webpack hotfix rerun: execution-environment timeout before completion; no new PASS claimed. The previously certified WS-9I Full Editor Webpack PASS remains the certification baseline.

## Architecture impact

None. WindowManager remains the semantic window authority, DockTransitionModel remains presentation-only, and geometry mutation continues to use `window:moved` / `window:resized` without transition authority.
