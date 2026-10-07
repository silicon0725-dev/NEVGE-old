# LEX-1 | Extension / Addons Containment

**Status:** COMPLETE / VERIFIED  
**Architecture Parent:** ARC-0001 | Kernel Independence Contract  
**Prerequisites:** LRC-G1 PASS / CERTIFIED; LPL-1 COMPLETE / VERIFIED

## Purpose

LEX-1 establishes a stable NGVGE containment boundary around the three extension ecosystems that already exist in the codebase without pretending they are one runtime:

- NGVGE Modules;
- Scratch Extensions;
- Legacy Addons.

Discovery may later be unified in Workspace UI, but runtime authority remains separated by host kind.

## Stable identities

```text
ngvge.extension-containment-host@1
ngvge.extension-containment-client@1
ngvge.extension.containment
authority:ngvge.extension-containment-host

ngvge.extension-host.ngvge-module@1
ngvge.extension-host.scratch-extension@1
ngvge.extension-host.legacy-addon@1
```

## Trust and capability model

Extension descriptors carry explicit host kind, trust, requested/effective execution mode, permissions, capabilities, source and compatibility metadata. The containment client published on Runtime is query-only; mutation remains inside the Host controller.

Legacy Addon raw VM access is not treated as a normal capability. Bundled legacy addons may receive `legacy-addon.raw-vm-quarantine` through an explicit lease and diagnostic. Custom/untrusted addon manifests are denied raw VM access.

Scratch Extension backend-private state (`_loadedExtensions`, security manager hooks, load/unload and block refresh) is localized in the Scratch Extension Host rather than normal GUI containers.

NGVGE Modules retain Module Manager as their runtime host. Their existing declared permissions/capabilities are projected into containment descriptors; LEX-1 does not merge Module Manager with Scratch ExtensionManager or Legacy Addon execution.

## Global authority retirement

`window.addonAPI` is removed. Legacy DOM remount support is module-local.

`window.vm` is retained only as a development/browser-diagnostics quarantine seam and is explicitly absent from production mode. It is not an NGVGE extension contract.

## Deferred debt

LEX-1 intentionally does not grant new authority to fix legacy callers. Direct ExtensionManager access that belongs to 02Agent/Legacy Addons, Collaboration or Developer tools is recorded in `LEX-1-legacy-extension-debt-matrix.csv` with an owner and target gate.

## Non-goals

LEX-1 does not implement WS-6 Extension Manager UI, does not unify the three runtime hosts, does not make third-party code trusted, and does not certify LEX-G1. It establishes the containment foundation on which those later migrations can be judged.
