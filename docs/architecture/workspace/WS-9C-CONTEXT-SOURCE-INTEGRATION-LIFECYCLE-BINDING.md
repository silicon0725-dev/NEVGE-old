# WS-9C | Context Source Integration & Lifecycle Binding

Status: COMPLETE / VERIFIED  
Authority: ARC-0001  
Baseline: WS-9B COMPLETE / VERIFIED

## Purpose

WS-9C moves Workspace Context from a foundation-only service into production source integration without making Context a new semantic authority.

The production chain is now:

```text
Project Lifecycle / Scene System / Editor Selection / Resource Selection / WindowManager
        ↓ read-only source adapters
WorkspaceContextRuntimeBinding
        ↓ one writer lease per Context domain
WorkspaceContextService
        ↓ portable immutable snapshot
future admitted Tools
```

Context remains ephemeral projection state. It does not load projects, switch scenes, mutate Nodes or Resources, or own Window state.

## Stable identity

- `ngvge.workspace-context-runtime-binding@1`
- `ngvge.workspace-context-source.project-lifecycle`
- `ngvge.workspace-context-source.scene-system`
- `ngvge.workspace-context-source.node-selection`
- `ngvge.workspace-context-source.resource-selection`
- existing `ngvge.workspace-context-source.window-manager`

## Project projection

Current NGVGE project serialization does not yet expose a persistent canonical ProjectId suitable for Workspace Context. WS-9C therefore deliberately does **not** reuse Redux/server project IDs, URLs, Scratch IDs, or backend handles.

Instead it derives a session-scoped semantic project context identity from the already-authoritative Project Lifecycle Host generation:

```text
ProjectLifecycleHost.projectGeneration = 7
    ↓
projectId = ngvge.project-context.g7
```

The identity is stable for the currently loaded project instance and changes only after a successful root project load. It is not persisted and is not claimed to be the future persistent Project Model ProjectId.

When a root project load starts, WS-9C enters a Context quarantine boundary and clears:

- project context;
- scene context;
- node selection context;
- resource selection context.

While that root load is in flight, Scene module events and Node/Resource UI callbacks are not allowed to republish context. This prevents old-project events from racing back into the new Workspace projection.

On successful load it exits quarantine, publishes the new generation identity, and reprojects active Scene state. On failed load the previous generation identity is restored, but stale Node/Resource selections remain cleared.

## Scene projection

Scene context observes the first-party `ngvge.scene-system` module data and projects only `activeSceneId`.

It does not read SceneSelector React state and does not invoke scene mutation commands. Disabling/resetting Scene module data causes Scene Context to become null.

## Node selection projection

Project Explorer remains the source of multi-selection semantics. It reports:

```text
selectedNodeIds[]
primaryNodeId
```

through a dedicated projection callback into the runtime binding. Existing Node selection commands and Redux compatibility selection remain unchanged.

A GUI-level primary-selection fallback ensures Context still receives a single selected NodeId when selection changes through existing Inspector/command paths that do not originate from Project Explorer multi-selection UI.

## Resource selection projection

Project Asset Manager projects its selected global asset `ResourceId` through a dedicated callback. Its resource projection is cleared when the Asset Manager selection disappears or the tool surface is torn down, preventing stale resource context after close/minimize/project switch.

No Scratch costume object, sound object, storage asset, texture, or renderer handle enters Context.

## Window projection

WS-9B's `bindWindowManagerToWorkspaceContext()` is now installed by the production runtime binding. WindowManager remains the only Window runtime state authority.

## Production bootstrap

GUI owns one `WorkspaceContextService` instance and one `WorkspaceContextRuntimeBinding` instance for its lifetime. The binding is disposed during GUI teardown, which unsubscribes source observers and releases all five Context writer leases.

The Workspace shell exposes diagnostic attributes only:

- `data-ngvge-workspace-context`
- `data-ngvge-workspace-context-runtime-binding`
- `data-ngvge-workspace-context-revision`

These are diagnostics, not authority surfaces.

## Consumer lifecycle boundary

WS-9C integrates **sources**, not privileged Tool consumers. WS-9B's capability-lease revocation behavior remains unchanged. Agent is intentionally not migrated directly to `WorkspaceContextService`, because doing so would bypass WS-9A Tool Capability admission. Agent context migration must use an admitted `context-read/query` capability in a later stage.

## Non-goals

WS-9C does not:

- introduce a persistent Project Model ProjectId;
- use Redux/server/Scratch project IDs as NGVGE core identity;
- make Context a Project/Scene/Node/Resource/Window writer authority;
- give Agent direct Context Service access;
- activate Terminal or Paint;
- create filesystem/process/browser capabilities;
- persist Workspace Context;
- expose VM, Scratch Target, Renderer, DOM, React, Redux store, or backend resource handles in Context.

## Definition of Done

1. Production `WorkspaceContextRuntimeBinding` exists and is versioned.
2. Project/Scene/Node/Resource/Window source IDs are explicit.
3. Project Context derives from Project Lifecycle generation, not host/backend Project IDs.
4. Root project load clears stale dependent Context before a new generation is published.
5. Failed loads do not resurrect stale Node/Resource selections.
6. Scene Context observes first-party Scene module semantic data.
7. Project Explorer projects multi-selection through a dedicated seam.
8. Asset Manager projects ResourceId and clears selection on teardown.
9. WindowManager binding is installed in production.
10. GUI owns and disposes one Context source binding lifecycle.
11. every source writer lease is released on teardown.
12. no Context source exposes VM/Renderer/Scratch/backend private identities.
13. Agent does not bypass Tool Capability admission.
14. focused Unit and machine gates pass.
15. real Webpack Context source entries pass.
16. existing Workspace and cross-domain regression gates remain green.
