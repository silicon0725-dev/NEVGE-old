# 0008.9.4.1.5 Module Deferred Authority and Service Lifetime Closure

Status: Implemented / Frozen  
Scene System: `0.8.9.6.1.1`

## Single frozen boundary

This task freezes how Module authority is held after the synchronous lifecycle call stack has ended.

The portable rule is:

```text
Engine Host authority is never a Module value.
Module Client, Service, and consumed Capability authority belongs to one
Module registration generation and can be revoked independently of the
underlying Host object.
```

This task does not attempt to infer the lexical origin of arbitrary JavaScript closures. Code explicitly handed the Host controller returned by `createModuleManager()` is Host code. The supported Runtime loader therefore resolves Module definitions before Host construction, never passes the Host controller to a definition factory or hook, stores the Host controller in a private `WeakMap`, and returns only `manager.client` from installation APIs.

## Host loader and import boundary

The standard Runtime installation sequence is:

```text
resolve built-in Module definitions
→ construct Host Manager
→ register resolved definitions
→ initialize / enable
→ retain Host Manager only in runtime-integration private state
→ publish and return Client facade
```

`runtime.ngvgeFirstPartyModules`, `getFirstPartyModuleClient()`, the compatibility alias `getFirstPartyModuleManager()`, and both first and repeated calls to `installFirstPartyModuleFramework()` expose only Runtime Operator Client authority. That facade supports query, subscription, enable, and disable operations needed by the editor UI, but not registration or raw infrastructure. Module Context clients remain narrower and do not expose disable or subscription.

The Host facade no longer exposes raw:

- Module Registry;
- Capability Registry;
- Module Data Store.

Host operations use private infrastructure references and private Host tokens. Deferred callbacks cannot use `manager.registry`, `manager.capabilities`, or `manager.dataStore`, because those properties do not exist. Raw infrastructure mutation also rejects tokenless calls with `MODULE_HOST_AUTHORITY_REQUIRED`.

## Host enable phase

The Host `enableModule()` facade cannot be invoked from any Module Hook. A captured Host call made synchronously during `initialize`, `enable`, `completeEnable`, `disable`, `dispose`, serialization, or deserialization fails with `MODULE_HOST_AUTHORITY_REQUIRED`.

`completeEnable` retains one supported recursive operation:

```text
context.manager.enableModule(target)
```

That Client operation is identity-bound to the current Module and appends work to the active Completion Queue. A Module-specific Client cannot call `enableModule()` outside its own synchronous `completeEnable` execution. Deferring the same call to a Promise microtask, timer, retained callback, or later event is rejected with `MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN`. External editor operations use the separate Runtime Operator Client.

## Generation-scoped Module Client

Every Module registration receives a private authority token. Client facades are cached by token, not by `moduleId`.

Consequently:

- unregister revokes the old Client;
- same-ID re-registration receives a new token;
- creating a new Context for the same ID cannot reactivate an old Client;
- Manager disposal revokes Host Client and all Module Clients.

Stable failures are:

```text
MODULE_CLIENT_AUTHORITY_REVOKED
MODULE_MANAGER_DISPOSED
```

## Service boundary

`context.runtime` and `context.vm` are removed. Runtime and VM access are permission-bound Services obtained through:

```js
context.getService('runtime');
context.getService('vm');
```

`getService()` checks the current registration token on every call and returns a recursive Module Service Facade rather than the raw Host object.

The Facade covers:

- property reads and writes;
- nested objects and arrays;
- saved methods;
- reflected property descriptors;
- functions and constructors;
- returned objects;
- callbacks passed into the Service;
- Promise-like and iterator method calls.

Every object-like operation revalidates the Module generation. Primitive Service results are treated as copied data and must not be used as bearer-authority tokens. Unregister and Manager disposal therefore revoke already-retained root facades, nested references, methods, constructors, and callbacks.

Arguments crossing from Module code into a Host Service are limited to primitives, portable plain-data records, arrays, callbacks, or object handles returned by the same Service facade. Caller-owned class instances and other opaque objects are rejected before the Host receives them, because their methods and mutable state could otherwise outlive the Module registration generation:

```text
MODULE_SERVICE_ARGUMENT_UNSUPPORTED
```

Permission failure is stable:

```text
MODULE_SERVICE_PERMISSION_DENIED
```

Structural mutations of the facade itself, such as changing its prototype or preventing extensions, are rejected with:

```text
MODULE_SERVICE_FACADE_STRUCTURE_FORBIDDEN
```

## Consumed Capability lifetime

Capability values consumed through Module Client APIs use the same recursive facade mechanism.

A consumed Capability is valid only while both conditions remain true:

```text
consumer registration token is current
AND
Capability Registry record is still the same record
```

Disabling the Provider, revoking the Capability, or replacing the record invalidates retained values and methods with:

```text
MODULE_CAPABILITY_AUTHORITY_REVOKED
```

Host `getCapability()` remains a Host query and returns the raw value.

## Embedded manager authority

A Host Manager or Module Client facade embedded inside a Service or Capability cannot preserve or launder its original identity.

- the current Manager Host or Client is rebound to the consuming Module's own Client facade;
- a foreign Manager Host is rejected with `MODULE_HOST_AUTHORITY_EXPOSURE_FORBIDDEN`;
- a foreign Manager Client is rejected with `MODULE_FOREIGN_CLIENT_AUTHORITY_FORBIDDEN`.

This prevents a Runtime Service property or Provider Capability from turning into a second Host/Provider identity channel.

## Persistent and Runtime-only fields

No persistent format changes are introduced.

All of the following are Runtime-only:

- Host and Module authority tokens;
- Client generation brands;
- Service and Capability facade caches;
- raw-to-facade and facade-to-raw maps;
- callback wrappers;
- Manager ownership brands;
- service descriptors and permissions.

## Native Kernel equivalence

A future Native Kernel must preserve:

- separate Host and Module capability tables;
- no Host pointer in Module Context;
- generation-scoped Client, Service, and consumed Capability handles;
- Provider-record revocation;
- permission checks before Service acquisition;
- identity rebinding for embedded Client handles;
- stable failure semantics.

JavaScript `WeakMap` and `Proxy` are implementation mechanisms. The portable contract is revocable, generation-scoped handles whose operations are checked at use time.

## Deliberate trust boundary

This closure protects code loaded through the supported Module loader and APIs. Arbitrary same-realm code that an Engine Host explicitly gives the Host controller is part of the Host trust domain. Preventing a Host from intentionally handing its own authority to arbitrary code requires a separate Realm, Worker, process, or Native Kernel isolation boundary and is not claimed by this task.

## Exception channel completion

The generation-scoped handle model defined here is completed by `0008.9.4.1.6`. Normal return values use revocable facades; thrown values and Promise rejections use frozen structured boundary errors. No raw exception object crosses the Service or consumed Capability membrane.
