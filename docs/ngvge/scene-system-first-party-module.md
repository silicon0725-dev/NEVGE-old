# Scene System as a selectable first-party module

Current Scene System version: `0.8.9.7`

The Scene System is exposed in the Extension Center under **NGVGE Official**. It can be enabled and disabled through the ordinary first-party module UI.

Module activation is complete only after `completeEnable` succeeds. During Registration, `enabled` remains false and `enableCompletion` is `pending`; successful Restore changes it to `completed`. A failed completion revokes capabilities and leaves a retryable `failed` state rather than an externally Enabled half-state.

## User flow

1. Open the Extension Center.
2. Select **NGVGE Official**.
3. Choose **Scene System** and press **Enable module**.
4. The Scene Selector and Runtime Node integrations attach immediately.
5. Press **Disable module** to unload the Scene System.

Disabling the module does not erase Scene System project data. Its project section remains preserved and is restored when the module is enabled again.

## Runtime behavior

The Extension Center reads module cards from:

```js
vm.runtime.ngvgeFirstPartyModules.listModules();
```

The card action calls the real module manager:

```js
manager.enableModule('ngvge.scene-system');
manager.disableModule('ngvge.scene-system');
```

Module-manager events update the card state and attach or detach editor subscriptions.

## Persistence

Enabled state is serialized in:

```text
ngvge.projectSections.ngvge-first-party-modules
```

Scene and Runtime Node data are stored in Scene System-owned project extension data. Scratch VM objects, Target references and backend handles are not persisted.

Standard SB3 compatibility remains partial because one selected scene must be flattened to a plain SB3 project.

## Discovery rules

- required modules such as `ngvge.core` are not shown as toggles;
- available and experimental first-party modules are shown automatically;
- planned modules remain hidden until their availability changes;
- future first-party modules do not require one-off Extension Center loading code.

## Runtime Node capabilities

Enabling Scene System `0.8.9.7` publishes:

```text
ngvge.runtime-node-model@1.3.1
ngvge.runtime-node-snapshot@1
ngvge.runtime-node-type-registration@1.2
```

`ngvge.runtime-node-model@1.3.1` is the portable query and mutation boundary. It exposes deeply frozen plain-data snapshots and structured mutation results. As of `0008.9.7`, each portable mutation is a single-command atomic commit: Project Source persistence succeeds before provider lifecycle hooks and observer events are published; persistence failure restores the original live semantic state in place and returns `applied: false, persisted: false`.


`ngvge.runtime-node-snapshot@1` is the atomic read boundary. It returns canonical deeply frozen envelopes carrying `ngvge.runtime-node-revision@1` tokens and does not enlarge the frozen Model API surface.

`ngvge.runtime-node-type-registration@1.2` is a restricted host capability for portable type descriptors, local provider bindings and owner-bound Component migration providers. JavaScript factories and migration callbacks are local-only implementations and are not part of the Engine Protocol.

Capability publication is phased during module startup:

```text
Scene System enable
→ publish Type Registration capability
→ dependent module enable hooks register Descriptors and migrations
→ module-batch completeEnable phase
→ restore persisted Runtime Node state
→ publish Runtime Node Model and remaining Scene services
```

The Runtime Node Model is deliberately unavailable to dependent modules during Registration. Project module deserializers run only after pending enable completions, so they observe restored Runtime state.

Scene System internally owns, but does not publish as an ordinary capability:

```text
ngvge.runtime-node-persistence-controller@1
ngvge.runtime-node-local-host@1
```

The persistence controller performs Runtime Node import, project writes and Scene synchronization. The local host owns callback traversal and disposal.

The Scratch Sprite Adapter receives these controllers through direct Scene System host injection. Ordinary Editor and module consumers receive only the capabilities appropriate to their authority.

See `docs/ngvge/runtime-node-model.md` and `docs/TASK-0008.9.1.1-RUNTIME-NODE-PUBLIC-BOUNDARY-CLEANUP.md` for the complete contract.
