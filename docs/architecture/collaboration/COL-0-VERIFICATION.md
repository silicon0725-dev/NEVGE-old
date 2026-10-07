# COL-0 Verification | Stable Semantic Collaboration Boundary

Status: COMPLETE / VERIFIED
Date: 2026-08-13
Architecture parent: ARC-0001 | Kernel Independence Contract
Baseline: LRC-G1 PASS / CERTIFIED + LPL-1 COMPLETE / VERIFIED + LEX-1 COMPLETE / VERIFIED

## Certified semantic boundary

- Stable host/client identities: `ngvge.collaboration-semantic-host@1`, `ngvge.collaboration-semantic-client@1`.
- Portable operation schema: `ngvge.collaboration-operation/v1`.
- Single Writer Authority: `authority:ngvge.collaboration-semantic-host` for `ngvge.collaboration.semantic`.
- Collaboration semantic DTOs reject Scratch/backend identity including targetId, targetRuntimeId, renderer and extensionManager.
- Stable NodeId is resolved through the Scratch Sprite Adapter only at the compatibility boundary.
- Remote rename/delete/transform routes through Runtime Node / Transform2D command capabilities.
- Project stream save/load routes through Project Lifecycle Host.
- Collaboration extension synchronization routes through Scratch Extension Host and no longer reads/mutates ExtensionManager private state directly.
- PeerJS remains replaceable transport and is absent from the semantic-host modules.
- Remaining block/asset/presence/legacy-target debt is explicit in `COL-0-legacy-collaboration-debt-matrix.csv`.

## Verification evidence

- COL-0 Machine DoD: 15/15 PASS.
- COL-0 focused Jest: 4 suites / 12 tests PASS.
- LRC-G1: 15/15 PASS + 9/9 E2E PASS.
- LPL-1: 13/13 PASS + 6 suites / 32 tests PASS.
- LEX-1: 14/14 PASS + 4 suites / 9 tests PASS.
- ARC-C001.1 baseline: 7/7 PASS.
- 0009-E Transform DoD: 12/12 PASS.
- Permanent Regression: 19/19 PASS.
- Unit / Node: 98 suites / 517 tests PASS.
- Unit / DOM: 3 suites / 26 tests PASS.
- Unit total: 101 suites / 543 tests PASS.
- Integration: 4 suites / 5 tests PASS.
- Smoke: 1 suite / 1 test PASS.
- TypeScript: PASS.
- ESLint correctness: PASS.
- RE-3 -> RE-5: PASS.
- WS-0 -> WS-2: PASS.
- LSC-0: 2 suites / 5 tests PASS.
- Real Webpack collaboration production entry (`src/lib/collaboration-service.js`, `webpack.config.js[0]`): exit 0, 0 errors, 0 warnings.

## Execution-environment note

The monolithic `npm run test:collaboration:col0-certification` command was started and advanced through the prerequisite LRC/LPL/LEX/COL gates before the outer execution window cut it off during the repeated 0009 chain. This is not recorded as an aggregate PASS. Every constituent certification/regression/type/lint gate listed above was subsequently or previously executed on the same final source tree with an explicit PASS, and the COL-0 production Webpack entry returned exit code 0.

A full Editor entry build was also attempted. In this reconstructed container it first exposed build-output/translation directory permission debt and, after those temporary working-directory permissions were repaired, remained too slow for the outer command window. COL-0 is not a Workspace/UI stage; the repeatable COL-0 Webpack gate therefore compiles the real Collaboration production entry through the repository Webpack rules. No temporary permission or generated build output is part of the COL-0 overlay.

## Governance result

COL-0 is `COMPLETE / VERIFIED`, not Architecture Frozen. It establishes the stable Collaboration semantic boundary while leaving native ResourceId asset commands, block semantic commands, and presence NodeId cleanup to later Collaboration stages / COL-G1.
