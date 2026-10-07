# NGVGE TASK 0008.9.4.1.5 Validation

Status: Implemented / Module Deferred Authority and Service Lifetime Frozen

Scene System: `0.8.9.4.1.5`

## Declared closure scope

- The supported Runtime loader resolves Module definitions before Host Manager construction and never passes Host authority to Module factories or hooks.
- Runtime installation, Runtime properties, compatibility accessors, and repeated installation return only Runtime Operator Client authority.
- Raw Module Registry, Capability Registry, and Module Data Store are not properties of the Host facade.
- Host infrastructure mutation requires private Host or generation-bound Module authority; tokenless deferred calls are rejected.
- Host `enableModule()` is forbidden from every Module Hook.
- A Module Client may invoke `enableModule()` only during that Module's own synchronous `completeEnable` phase.
- `context.runtime` and `context.vm` are removed; Runtime and VM access use permission-bound Services.
- Module Client, Service, consumed Capability, nested object, saved method, constructor, and callback authority is registration-generation scoped and revocable.
- Consumed Capability authority also depends on the exact live Provider record.
- Embedded current-manager Host/Client values are rebound to the consumer's Module Client; foreign manager authorities are rejected.
- Caller-owned non-portable objects cannot cross into Host Services as unrevoked bearer state.

## Required destructive scenarios

- Observer schedules `Promise.then()` and attempts raw Registry unregister: raw Registry is absent; Module and Capability remain live.
- Hook schedules `setTimeout()` and attempts raw Capability impersonation: raw Capability Registry is absent; original Provider remains unchanged.
- `initialize` invokes a captured Host `enableModule()`: rejected with `MODULE_HOST_AUTHORITY_REQUIRED`.
- `initialize` retains its Module Client and defers `enableModule()` to a microtask: rejected with `MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN`.
- Unregister followed by retained `getService()`: rejected with `MODULE_CLIENT_AUTHORITY_REVOKED`.
- Unregister followed by retained Service root, nested reference, reflected descriptor value, saved method, or callback use: rejected before Host mutation.
- Manager disposal followed by retained Service or method use: rejected with `MODULE_MANAGER_DISPOSED`.
- Provider disable/revoke followed by retained Capability root, nested reference, or saved method use: rejected with `MODULE_CAPABILITY_AUTHORITY_REVOKED`.
- Same-ID re-registration does not revive old Module Client, Service, or consumed Capability authority.

## Additional self-audit scenarios

- First and repeated Runtime installation return Client, never Host.
- Runtime Operator Client preserves editor-required query, subscribe, enable, and disable operations without registration authority.
- A Runtime Service embedding `ngvgeFirstPartyModules` is rebound to the consuming Module's own Client identity.
- A Capability publishing another Module's Client is rebound to the consumer's own identity.
- Foreign Host Manager and foreign Client facade crossing a Service/Capability boundary are rejected.
- Service callbacks stored by Host Services are generation-checked when invoked later.
- Callbacks nested inside plain argument records are wrapped and revoked.
- Promise-like Service results and reflected object access remain generation checked.
- Non-portable caller-owned class instances are rejected with `MODULE_SERVICE_ARGUMENT_UNSUPPORTED` before entering Host code.
- Registered definitions are resolved before Host construction in the supported loader.
- No raw `runtime` or `vm` field remains on Module Context.

## Stable errors covered

- `MODULE_HOST_AUTHORITY_REQUIRED`
- `MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN`
- `MODULE_CLIENT_AUTHORITY_REVOKED`
- `MODULE_MANAGER_DISPOSED`
- `MODULE_SERVICE_PERMISSION_DENIED`
- `MODULE_SERVICE_ARGUMENT_UNSUPPORTED`
- `MODULE_SERVICE_FACADE_STRUCTURE_FORBIDDEN`
- `MODULE_CAPABILITY_AUTHORITY_REVOKED`
- `MODULE_HOST_AUTHORITY_EXPOSURE_FORBIDDEN`
- `MODULE_FOREIGN_CLIENT_AUTHORITY_FORBIDDEN`

## Explicit trust boundary

This closure does not claim to infer the lexical origin of arbitrary same-realm JavaScript closures. Code explicitly given the Host controller returned by `createModuleManager()` is in the Host trust domain. Preventing a Host from intentionally delegating its own controller requires a Realm, Worker, process, or Native Kernel isolation boundary. The supported NGVGE Runtime loader does not perform that delegation.

## Regression chain

Validated:

- Runtime Node first-party alias gate
- 0008.7.3 Scratch Adapter
- 0008.8 Persistence
- 0008.9.1 API Freeze
- 0008.9.1.1 Public Boundary Cleanup
- 0008.9.2 Lifecycle Conformance
- 0008.9.2.1 Reentrancy / Generation
- 0008.9.2.2 Observation Boundary
- 0008.9.2.2.1 Dispose Preflight
- 0008.9.3 Component Boundary
- 0008.9.3.1 Identity / Persistence Closure
- 0008.9.3.1.1 Cardinality Authority Transition
- 0008.9.3.1.2 Registry Binding Ownership
- 0008.9.4 Schema / Migration Authority
- 0008.9.4.1 Bootstrap / API Isolation
- 0008.9.4.1.1 Live-State / Batch Recovery
- 0008.9.4.1.2 Completion / Observer Closure
- 0008.9.4.1.3 Lifecycle Mutation Authority
- 0008.9.4.1.4 Host / Client Authority Surface
- 0008.9.4.1.5 Deferred Authority / Service Lifetime
- Foundation Extensions
- `npm run test:architecture:runtime-component-boundary`

## Static and environment validation

- Changed/new JavaScript `node --check`: `23 / 23 PASS`
- `package.json` parse: `PASS`
- Root `node_modules`: `ABSENT`

The archive has no root `node_modules` directory. Full Jest, ESLint, Webpack, and browser integration tests were not executed. Dedicated Jest regression coverage is included in the source tree.
