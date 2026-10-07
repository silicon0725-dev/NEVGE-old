# WS-6 | Change Manifest

**Stage:** `WS-6 | Extension Manager Workspace Tool`
**Status:** `COMPLETE / VERIFIED`
**Patch baseline:** `WS-5 COMPLETE / VERIFIED`, local commit `878b2b6`

## Product / architecture changes

- registers `ngvge.tool.extension-manager` as a first-party singleton Workspace Tool;
- registers the `extension-manager` WindowModel and routes launch/focus/restore through existing Workspace authority;
- adds a three-pane Extension Manager Workspace UI with Navigation, compact list and Detail Inspector;
- introduces `ngvge.workspace-extension-manager-model@1` as a projection/router only;
- introduces a runtime factory that composes, but does not merge, Module Manager client, ScratchExtensionHost, LegacyAddon adapter and LEX containment query client;
- projects existing extension library + live Extension Hub registry as Scratch discovery sources;
- adds live ExtensionRegistry lifecycle events for dynamic discovery refresh;
- projects bundled Legacy Addons through an adapter and registers their LEX descriptors via LegacyAddonHost;
- keeps complete addon settings in the Detail `Settings` tab rather than inline in the list;
- renders LEX trust/capability/permission state and explicitly marks discovery-only Scratch trust as not evaluated;
- adds SVG-only Extension Manager Dock/Launchpad presentation;
- adds WS-6 Machine Gate, focused tests and two real production Webpack gates.

## Authority invariants preserved

- no universal extension runtime host was introduced;
- NGVGE Module mutation remains delegated to Module Manager client;
- Scratch Extension load/unload remains delegated to ScratchExtensionHost;
- Legacy Addon enable/settings remain delegated to the Legacy adapter / SettingsStore;
- Legacy raw VM quarantine remains inside LegacyAddonHost;
- effective trust/capability/permission remains sourced from LEX ExtensionDescriptor;
- Workspace Manager sources do not read Scratch `_loadedExtensions` or `window.vm`;
- WS-6 creates no new localStorage / Workspace persistence domain;
- WS-7 Agent mutation scope is not introduced.

## Verification summary

```text
WS-6 Machine Gate                 27/27 PASS
WS-6 Focused                      5 suites / 23 tests PASS
WS-0 -> WS-6                      PASS
LSC-G1                            PASS
LRC-G1                            PASS
LPL-G1                            PASS
LEX-G1                            PASS
COL-0                             PASS
0009-E                            12/12 PASS
Permanent Regression             19/19 PASS
Unit / Node                       118 suites / 636 tests PASS
Unit / DOM                        3 suites / 26 tests PASS
Unit Total                        121 suites / 662 tests PASS
Integration                       4 suites / 5 tests PASS
Smoke                             1 suite / 1 test PASS
TypeScript                        PASS
ESLint correctness                PASS
Extension Manager Webpack         exit 0 / 0 errors / 0 warnings
Full Editor Webpack               exit 0 / 0 errors / 0 warnings
Aggregate ws6-certification       constituent gates pass / final redundant Editor build timed out externally
```

## Delivery policy

The overlay contains only files changed by WS-6 plus `APPLY-WS-6.txt`. It excludes `node_modules`, Webpack output, coverage, translation extraction, caches and temporary logs.

The unified patch is generated against baseline commit `878b2b6` and must pass `git apply --check` on a clean WS-5 baseline before delivery.
