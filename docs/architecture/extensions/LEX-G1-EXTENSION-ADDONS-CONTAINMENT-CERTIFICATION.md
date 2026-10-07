# LEX-G1 | Extension / Addons Containment Certification

**Gate Status:** PASS / CERTIFIED
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Certified Implementation:** LEX-1 | COMPLETE / VERIFIED
**Certified Baseline:** LPL-G1 | PASS / CERTIFIED + COL-0 | COMPLETE / VERIFIED

## 1. Certification statement

LEX-G1 certifies the following invariant:

> NGVGE Modules, Scratch Extensions and Legacy Addons remain distinct runtime hosts behind one NGVGE-owned
> containment/trust boundary. Normal product UI and collaboration code cannot acquire Scratch ExtensionManager
> private mutation authority. Legacy raw VM access is not a Native NGVGE capability: it is an explicit,
> trust-gated compatibility quarantine. Production does not publish `window.vm` or `window.addonAPI` as an
> extension contract, and legacy capabilities are deny-by-default and narrowly projected through host facades.

LEX-G1 certifies the LEX-1 containment model. It does not unify the three runtime hosts, does not implement the
future WS-6 Extension Manager UI, and does not promote Scratch/02 extension internals into NGVGE stable identity.

## 2. Certified stable identities

```text
Containment Host    ngvge.extension-containment-host@1
Containment Client  ngvge.extension-containment-client@1
Authority Domain    ngvge.extension.containment
Writer Authority    authority:ngvge.extension-containment-host

Runtime Hosts
├── ngvge.extension-host.ngvge-module@1
├── ngvge.extension-host.scratch-extension@1
└── ngvge.extension-host.legacy-addon@1
```

The three runtime hosts remain intentionally separate. A future Extension Manager may unify discovery,
classification and trust presentation, but not runtime authority.

## 3. Scratch ExtensionManager containment

Scratch backend-private extension operations remain localized in `ScratchExtensionHost`, including:

```text
_loadedExtensions
loadExtensionURL
loadExtensionIdSync
reorderExtension
securityManager
```

Normal GUI containers/components are certified free of direct private/load/security ExtensionManager authority.
COL-0 also consumes `ScratchExtensionHost` instead of reopening ExtensionManager mutation or monkey-patching it.

The containment runtime client remains query-only. It exposes immutable descriptors, host summaries and
diagnostics, not VM/Renderer/ExtensionManager handles and not writer methods.

## 4. Legacy Addon capability certification

### 4.1 Raw VM quarantine

Bundled Legacy Addons may continue to request the explicit compatibility capability:

```text
legacy-addon.raw-vm-quarantine
```

This capability is not Native NGVGE authority. Acquisition is recorded with an explicit diagnostic. Custom or
untrusted addons are denied with `LEX_LEGACY_RAW_VM_DENIED`.

### 4.2 LEX-D002 closure

The bundled `load-extensions` Legacy Addon no longer requests raw VM/ExtensionManager access. It declares:

```text
legacy-addon.scratch-extension.load-built-in
```

and receives a narrow immutable facade:

```text
isLoaded(extensionId)
loadBuiltIn(extensionId)
whenProjectReady(callback)
```

The facade contains no `vm` and no `extensionManager`. The capability is deny-by-default:

- undeclared capability request -> `LEX_LEGACY_CAPABILITY_UNDECLARED`;
- custom/untrusted addon -> denied even if it supplies the capability string;
- URL/path-like extension load -> `LEX_LEGACY_EXTENSION_BUILTIN_ONLY`.

Actual built-in loading is delegated to `ScratchExtensionHost`.

## 5. Global and developer quarantine certification

`window.addonAPI` is fully retired from production source.

`window.vm` remains a development/browser diagnostics seam only. Production code removes/does not publish it as
an extension authority.

LEX-D006 is also closed as a production dependency: `extension-debug` is no longer statically imported by the
GUI. It is dynamically loaded only outside production and remains Developer Tools quarantine rather than normal
project/extension authority.

## 6. Accepted explicit quarantine at LEX-G1

LEX-G1 does not hide compatibility debt. The following exceptions remain explicit and bounded:

- **LEX-D001 — Legacy 02Agent:** direct ExtensionManager usage remains Legacy/LSC quarantine. It may not become
  NGVGE Module authority.
- **LEX-D007 — `window.vm`:** development diagnostics quarantine only; forbidden as production extension contract.
- **LEX-D008 — `addon.tab.traps.vm`:** bundled Legacy Addon raw-VM lease only; custom/untrusted addons denied.
- **Runtime compatibility scanner:** backend-private ExtensionManager reads used by compatibility analysis remain
  backend/compatibility implementation detail, not extension Host authority.
- **Developer extension debug:** dynamically loaded only outside production.

COL-0 has closed LEX-D003 through LEX-D005. LEX-D002 and LEX-D006 are closed by the LEX-G1 prerequisite fixes
certified here.

## 7. Trust and host separation

NGVGE Module declarations remain Module Manager permissions/capabilities under the NGVGE Module Host. They do not
borrow Scratch ExtensionManager authority.

Scratch extensions remain backend-managed and may carry explicit compatibility/quarantine metadata when
unsandboxed. That backend execution classification does not grant NGVGE semantic ownership to Scratch.

Legacy Addon trust is distinct from NGVGE Module trust. A Legacy Addon cannot manufacture a capability merely by
putting a string in its manifest; the Legacy Addon Host applies source/trust policy before issuing a lease.

## 8. Machine certification

```text
node scripts/validate-lex-g1-extension-addons-containment-certification.js
```

Final result:

```text
19 / 19 PASS
```

Focused E2E:

```text
LEX-G1 certification: 1 suite / 9 tests PASS
LEX-1 focused:        4 suites / 11 tests PASS
```

The LEX-G1 E2E suite certifies single writer authority, separated host identity, query-only runtime surfaces,
raw-VM quarantine, declared-capability denial rules, unsandboxed Scratch classification, NGVGE Module separation,
observer isolation and immutable snapshots.

## 9. Production-module Webpack evidence

```text
command: npm run test:extension-containment:lex-g1-webpack
entry:   src/lib/extension-containment/index.js
config:  webpack.config.js[0]
exit:    0
errors:  0
warnings: 0
result:  PASS
```

This is a real production-module Webpack dependency-graph check using the project Webpack/Babel resolution rules.

## 10. Cumulative evidence

- LPL-G1 — 17/17 Machine + 9/9 E2E PASS;
- LRC-G1 — 15/15 Machine + 9/9 E2E PASS;
- LEX-1 — 14/14 Machine + 4 suites / 11 tests PASS;
- LEX-G1 — 19/19 Machine + 1 suite / 9 tests PASS;
- COL-0 — 15/15 Machine + 4 suites / 12 tests PASS;
- ARC-C001.1 — 7/7 PASS;
- 0009-E — 12/12 PASS;
- Permanent Regression — 19/19 PASS;
- Unit / Node — 100 suites / 537 tests PASS;
- Unit / DOM — 3 suites / 26 tests PASS;
- Unit total — 103 suites / 563 tests PASS;
- Integration — 4 suites / 5 tests PASS;
- Smoke — 1 suite / 1 test PASS;
- RE-3 through RE-5 — PASS;
- WS-0 through WS-2 — PASS;
- LSC-0 — 2 suites / 5 tests PASS;
- TypeScript — PASS;
- ESLint correctness — PASS.

The final aggregate command is:

```text
npm run test:extension-containment:lex-g1
```

The final aggregate reached its final correctness-lint stage before the outer execution window terminated the wrapper, so no wrapper `exit 0` is claimed. Correctness lint was then rerun independently and passed both source/tooling and tests. The signed aggregate status is `CONSTITUENT GATES PASS`; details are recorded in `LEX-G1-VERIFICATION.md`.

## 11. Governance result

```text
LEX-1
COMPLETE / VERIFIED
        ↓
LEX-G1
PASS / CERTIFIED
```

LEX-G1 does not declare a new Architecture Frozen schema. It certifies the trust/capability/host containment
invariant. Any future change which gives normal GUI/Collaboration direct ExtensionManager private authority,
publishes raw VM as a Native capability, lets untrusted Legacy Addons manufacture capability leases, collapses the
three runtime hosts into one backend-owned authority, or restores production global `window.vm/window.addonAPI`
must fail this gate or be accompanied by an explicit architecture/version decision.
