# WS-10N4 | Camera2D Verification

Status: `FROZEN / MACHINE VERIFIED / BROWSER VERIFIED`

## Scope verified by code/machine gates

- stable `ngvge.camera2d@1` component semantics;
- Transform2D remains position/rotation authority;
- Camera2D archetype is native-only and provisions Transform2D + Camera2D;
- provider-aware Functional Node admission prevents fake Camera nodes in headless/unavailable renderer contexts;
- active-camera priority/tie rule;
- single Camera runtime viewport state;
- persistent Inspector command path;
- runtime-only Scratch block mutation path;
- Scratch renderer projection adapter with native baseline restore;
- offscreen culling disabled only while explicit Camera2D is active;
- reversible world/screen coordinate conversion;
- raw-VM Scratch internal-extension registration stays outside the portable module service boundary;
- `.ne` native / `.sb3` native-only compatibility rule.

## Permanent commands

```text
npm run test:node-plan:ws10n4:machine
npm run test:node-plan:ws10n4:focused
npm run test:node-plan:ws10n4:webpack
```

The focused gate inherits WS-10N3-HF1 and adds Camera core/runtime/renderer/command/blocks, Functional Node provider admission, Inspector and real module/VM integration tests.


## Machine evidence (2026-08-16)

```text
WS-10N0 inherited machine     13/13 PASS
WS-10N1 inherited machine     17/17 PASS
WS-10N2 inherited machine     20/20 PASS
WS-10N2-HF1 inherited machine 11/11 PASS
WS-10N3 inherited machine     21/21 PASS
WS-10N3-HF1 inherited machine  8/8 PASS
WS-10N4 machine               22/22 PASS

WS-10N4 focused              11 suites / 58 tests PASS
Permanent regression         25/25 PASS
Full Unit / Node             177 suites / 980 tests PASS
Full Unit / DOM                3 suites / 32 tests PASS
Integration                    7 suites / 8 tests PASS
Smoke                          1 suite / 1 test PASS
TypeScript                     PASS
ESLint correctness             PASS

ARC-C001.1                     7/7 PASS, 0 waivers, 0 blockers
0009 A/B/C/D/E                 PASS
0009-E DoD                    12/12 PASS
LRC-G1                        15/15 PASS
LPL-G1                        17/17 PASS
LEX-G1                        19/19 PASS
LSC-G1                        19/19 PASS
COL-0                         15/15 PASS

WS-5 Node Explorer production Webpack
errors                         0
warnings                       0
status                          PASS

Full Editor Webpack            INCONCLUSIVE
reason                          execution timed out before final stats; no PASS is claimed
```

The permanent functional-node creation regression was updated monotonically for N4: `Node2D` and `Sprite2D` remain required, still-planned archetypes remain hidden, and `Camera2D` is now required to provision `Transform2D + Camera2D` without backend identity.

## Browser acceptance

1. Open Node Explorer and confirm `Camera2D` now appears beside `Node2D` / `Sprite2D` only when the real editor renderer is available.
2. Create `Camera2D`. Native node count must increase by one; Legacy Sprites target count must not change.
3. Select the Camera node. Inspector must expose normal Transform2D plus Camera2D `Enabled`, `Zoom X/Y`, `Offset X/Y`, `Priority`; it must identify the camera as `Active` when selected by runtime priority.
4. Place at least one visible Sprite in the world. Change Camera Transform X/Y. The viewport must pan while the Sprite's authored Scratch world position remains unchanged.
5. Set Camera rotation and verify the viewport rotates. Set `Zoom X = 2`, `Zoom Y = 2` and verify magnification. Also test unequal X/Y zoom.
6. Disable the active Camera. Viewport must return to exact Scratch-compatible baseline. Re-enable it and confirm the authored camera returns.
7. Create a second Camera with higher priority; it must become active. Disable/delete it; the lower-priority Camera must resume, or baseline must resume if no Camera remains.
8. Use the `NGVGE Camera2D` Scratch blocks to change position/rotation/zoom during runtime. Stop the project; authored Inspector values must be restored rather than runtime block values being persisted.
9. Verify `mouse world x/y` under translated and zoomed Camera2D against a known world point.
10. Explicitly test native Scratch sprite click/drag/picking under translated, zoomed and rotated Camera2D. If the renderer's native picking remains stage-space and becomes incorrect, mark N4 browser acceptance `FAIL` and open an input-projection hotfix before WS-10N5.

## Evidence policy

Machine, Jest, integration and Webpack success do not substitute for the browser viewport/picking evidence above. Browser acceptance was reported PASS by the project owner on 2026-08-16. WS-10N4 is therefore frozen and WS-10N5 is admitted.
