NGVGE WS-9E | Capability Provider Binding & Diagnostics
Status: COMPLETE / VERIFIED
Baseline required: WS-9D COMPLETE / VERIFIED

This package is an incremental overlay. Apply it only after the WS-9D overlay (or to a source tree already containing WS-9D).

What WS-9E adds
----------------
1. ngvge.workspace-capability-provider-registry@1
2. Versioned Provider descriptor + Provider binding contracts
3. One Provider per CapabilityId + Access surface
4. Explicit provider-missing / provider-unavailable / ready diagnostics
5. Revocable provider bindings tied to Tool admission leases and Provider lifecycle
6. Dynamic Provider availability checks on retained facade calls
7. Core Context read Provider and ToolId-scoped Workspace-state Providers
8. Agent Context consumer migration from raw Context Service construction to Provider Registry binding

Authority boundary
------------------
Provider Registry is NOT Project Authority, Resource Authority, Context writer authority, VM authority, or a backend service locator.

WS-9E intentionally does NOT fabricate Project/Resource Providers. Those surfaces remain provider-missing diagnostics until stable semantic facades exist.

Apply
-----
Merge the NGVGE/ directory from this overlay over the existing NGVGE project directory, preserving relative paths.

Recommended verification
------------------------
npm run test:workspace-shell:ws9e:focused
npm run test:workspace-shell:ws9e-webpack
npm run test:lint:correctness
npm run test:typecheck
npm run test:unit
npm run test:integration
npm run test:smoke
npm run test:regression

Recorded final evidence
-----------------------
WS-9E machine gate: 14/14 PASS
Focused Jest: 6 suites / 36 tests PASS
WS-9E production-entry Webpack: 0 errors / 0 warnings
Full Unit: 135 suites / 734 tests PASS
Integration: 4 suites / 5 tests PASS
Smoke: 1/1 PASS
ESLint correctness: PASS
TypeScript: PASS
Permanent Regression: 19/19 PASS
LRC-G1 / LPL-G1 / LEX-G1 / LSC-G1 / COL-0 / ARC-C001.1 baseline: PASS

Full Editor Webpack
-------------------
The complete Editor Webpack gate was invoked but exceeded the execution environment's 120-second command window without emitting a compile error. It is recorded as INCONCLUSIVE, not PASS and not FAIL. WS-9E stage-specific production entries are independently verified at 0 errors / 0 warnings.

Next recommended stage
----------------------
WS-9F | Project / Resource Capability Provider Foundation
