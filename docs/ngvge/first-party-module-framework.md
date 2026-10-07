# NGVGE First-party Module Framework

Task lineage: `0008.3` → `0008.9.6.1.1`

The framework keeps the Scratch-compatible project core intact while allowing official NGVGE systems to register isolated project data, capabilities, dependencies and SB3 degradation metadata.

## Runtime Client access

Runtime consumers receive a Client facade, never the Host Manager:

```js
const modules = vm.runtime.ngvgeFirstPartyModules;
modules.listModules();
modules.getModuleState('ngvge.scene-system');
modules.enableModule('ngvge.scene-system');
modules.disableModule('ngvge.scene-system');
modules.subscribe(change => console.log(change));
```

The Runtime Operator Client exposes query, subscription, enable, and disable operations required by the editor UI. It does not expose registration, unregister, raw Registry, raw Capability Registry, or raw Module Data Store operations. Module Context clients are narrower and do not expose disable or subscription.

## Host registration

Only Engine Host code receives the controller returned by `createModuleManager()` and may register definitions:

```js
const host = createModuleManager({services});
host.registerModule({
    manifest: {
        id: 'ngvge.example',
        name: 'Example Module',
        version: '1.0.0',
        apiVersion: '1',
        dependencies: ['ngvge.core'],
        permissions: ['editor', 'serialization'],
        capabilities: ['example.service'],
        compatibility: {
            sb3: {
                level: 'partial',
                strategy: 'bake-to-costume'
            }
        }
    },
    hooks: {
        initialize (context) {},
        enable (context) {},
        completeEnable (context) {},
        disable (context) {},
        deserializeProject (context, data) {}
    }
});
```

Module definitions are resolved before Host construction in the supported Runtime loader. Hooks receive only a frozen Module Context.

## Module Context

The Context exposes:

- `context.manager`: generation-bound Client facade;
- `context.capabilities`: current-provider facade;
- `context.data`: current-owner data facade;
- `context.getService(id)`: permission-bound, revocable Service facade;
- immutable manifest, module ID and permission queries.

Raw `runtime` and `vm` fields are not present. Modules request them as Services:

```js
const runtime = context.getService('runtime');
const vm = context.getService('vm');
```

Client, Service, and consumed Capability handles are revoked after unregister, same-ID generation replacement, Provider revocation, or Manager disposal as applicable.

Service calls may receive primitive values, portable plain-data records, arrays, callbacks, and handles returned by that Service facade. Passing caller-owned class instances or other opaque mutable objects is rejected so Module-owned state cannot escape generation revocation.

Exceptional completion is also a membrane output. Service/Capability methods, accessors, constructors, reflection traps, iterators and Promise rejection never propagate the original thrown value. Module callbacks are isolated in the reverse direction. Callers receive frozen local `ModuleBoundaryError` instances with stable codes and bounded portable diagnostics; raw `cause`, Host objects and Module objects are never retained. Their normative public fields are projected with `toRuntimeErrorPublicRecord()`. A JavaScript engine may provide a local `stack`, but it is not part of the portable error record.

```text
MODULE_SERVICE_HOST_OPERATION_FAILED
MODULE_CAPABILITY_PROVIDER_OPERATION_FAILED
MODULE_SERVICE_CALLBACK_FAILED
MODULE_CAPABILITY_CALLBACK_FAILED
```

## Project data

Module data is stored in the existing NGVGE project metadata section under `ngvge.projectSections.ngvge-first-party-modules`. Unknown module data is preserved, and normal SB3 runtime structures remain unchanged.

## Built-in manifests

- `ngvge.core` — available and required
- `ngvge.scene-system` — experimental and selectable from the Extension Center
- `ngvge.entity-component` — planned
- `ngvge.camera2d` — planned
- `ngvge.physics2d` — planned
- `ngvge.ui-system` — planned
- `ngvge.gpu-canvas` — planned

The Extension Center creates official module cards from Client queries. Available and experimental modules can be enabled without exposing Host registration or raw infrastructure. Planned modules remain hidden until implementation.

Module enablement is project data. Disabling a module unloads its capabilities and editor UI but preserves its module data, so re-enabling restores the previous state. The required `ngvge.core` module is never exposed as a user toggle.
