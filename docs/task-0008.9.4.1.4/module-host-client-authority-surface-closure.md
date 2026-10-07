# 0008.9.4.1.4 Module Host and Client Authority Surface Closure

Status: Implemented / Declared Scope Passed; lifetime and exception authority completed by `0008.9.4.1.6`  
Scene System: `0.8.9.6.1.1`

## Single frozen boundary

This task freezes the authority surface between the Engine Host and a Module Client.

A module hook receives a frozen Client Context. It does not receive the Host Manager, raw Module Registry, raw Capability Registry, or raw Module Data Store. Host infrastructure remains available only to the Engine Host controller returned by `createModuleManager()`. Runtime installation retains that controller privately and returns only a Client facade.

The boundary is:

```text
Engine Host
├── register / unregister / initialize / disable / reset / deserialize / dispose
├── raw Module Registry
├── raw Capability Registry
└── raw Module Data Store

Module Client Context
├── enableModule (phase constrained)
├── getCapability
├── getModuleState / listModules
├── read-only Module Data queries
├── provider-bound context.capabilities
└── owner-bound context.data
```

## Client facade

`context.manager` is a frozen Client facade. It does not expose:

- `registry`
- `capabilities`
- `dataStore`
- `registerModule`
- `unregisterModule`
- `disableModule`
- `resetProject`
- `deserializeProject`
- `dispose`
- direct initialization APIs

`completeEnable` may call `context.manager.enableModule()`. The request appends work to the active Completion Queue. Module hooks before completion may not recursively invoke Client enable; attempts fail with `MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN`.

## Infrastructure enforcement

Removing raw objects from `context.manager` is not the only protection. Module Registry, Capability Registry, and Module Data Store each enforce the shared lifecycle authority domain.

Consequently, raw infrastructure is no longer present on the Host facade, while private infrastructure still enforces the shared Authority domain. The following former bypass surface is absent:

```text
manager.registry.unregister(...)
manager.capabilities.provide(...)
manager.capabilities.revokeByProvider(...)
manager.dataStore.set(...)
manager.dataStore.clear(...)
```

The 1.4 synchronous guards remain valid. Deferred closure escape and generation-scoped Service/Capability handles are completed by 0008.9.4.1.5.

## Provider and data identity

`context.capabilities` is bound to a private, generation-scoped module authority. A module cannot supply a provider ID.

- Provider impersonation fails with `MODULE_CAPABILITY_PROVIDER_IDENTITY_FORBIDDEN`.
- Cross-provider replacement continues to fail with `MODULE_CAPABILITY_PROVIDER_REPLACEMENT_FORBIDDEN`.
- Cross-provider revocation cannot be expressed through the Module Client facade.
- Module Data writes are bound to the context module ID. Impersonation fails with `MODULE_DATA_OWNER_IDENTITY_FORBIDDEN`.

Capability publication is valid only during `initialize`, `enable`, or `completeEnable`. A retained Context cannot mint new capabilities after the publication phase; attempts fail with `MODULE_CAPABILITY_PROVISION_PHASE_FORBIDDEN`.

## Authority lifetime

Module Client authority is scoped to one registration generation.

- Duplicate registration of an existing `moduleId` is rejected with `MODULE_ALREADY_REGISTERED`; replacement requires an explicit unregister/register lifecycle.
- Unregistering a module revokes its Client, Capability, and Data write authority.
- A later same-ID registration receives a new authority generation; retained Contexts from the old registration remain revoked.
- Retained Context calls then fail with `MODULE_CLIENT_AUTHORITY_REVOKED`.
- Disposing the Host Manager revokes all Client and infrastructure mutation authority with `MODULE_MANAGER_DISPOSED`.

Registered Hook tables are copied and frozen. Mutating the caller-held definition after registration cannot rewrite active lifecycle behavior. Duplicate Host registration is rejected before state or Provider mutation, preventing a new Registration record from inheriting stale capabilities.

## Private infrastructure state

Module Registry, Capability Registry, and Module Data Store keep semantic Maps, listeners, mutation guards, and Observer diagnostics in module-private `WeakMap` state.

Instances are sealed, prototypes are frozen, and internal emitters are not instance methods. Legacy surfaces such as `_modules`, `_capabilities`, `_data`, and `_emit` are absent.

The framework rejects custom raw infrastructure injection with `MODULE_HOST_INFRASTRUCTURE_INJECTION_FORBIDDEN`; otherwise an externally created unguarded Registry could bypass the shared authority domain.

## Runtime integration

Runtime integration stores the Host Manager in a module-private `WeakMap`. `runtime.ngvgeFirstPartyModules` contains only `manager.client`, is non-writable and non-configurable, and cannot expose raw Host infrastructure.

`getFirstPartyModuleClient()` returns the Client facade. `getFirstPartyModuleManager()` remains as a compatibility alias but also returns the Client facade. Installation retains the Host Manager privately and returns only the Client facade. Deferred authority and Service lifetime are finalized by 0008.9.4.1.5.

The Core module publishes:

- `ngvge.module-manager`: Client facade
- `ngvge.module-data`: read-only data facade

Neither capability exposes raw infrastructure mutation methods.

## Persistence and atomicity

This task does not change persistent project format or Runtime Node API versions.

Forbidden authority operations fail before Module Registry, Capability Registry, Module Data Store, Completion Queue, lifecycle state, or project data changes. It does not provide rollback for arbitrary external JavaScript, network, or filesystem side effects.

## Native Kernel equivalence

A future Native Kernel must preserve:

- distinct Host and Module Client capability tables;
- unforgeable provider and data-owner identity;
- registration-generation authority revocation;
- phase-constrained capability publication;
- Observer and Completion mutation exclusion;
- stable error semantics;
- no module-visible pointer to raw Host registries.

JavaScript closures, `WeakMap`, and frozen facades are the current Host implementation, not the portable contract itself.
