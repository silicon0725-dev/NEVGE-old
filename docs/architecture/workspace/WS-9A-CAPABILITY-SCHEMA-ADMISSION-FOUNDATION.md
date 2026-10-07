# WS-9A | Capability Schema & Admission Foundation

Status: COMPLETE / VERIFIED  
Authority: ARC-0001  
Baseline: WS-8 COMPLETE / VERIFIED

## Purpose

WS-9A establishes the first executable admission boundary between a Workspace Tool declaration and future semantic capability providers.

WS-8 already proved that a tool can enter the Workspace through stable ToolId, WindowModel, WindowManager, Launchpad/Dock, scoped persistence, and explicit ecosystem authority metadata. WS-9A deliberately does not replace that layer. It adds a separate, versioned Capability contract that answers a narrower question:

> Which semantic operations may this active ToolId ask for, and can that declaration be revoked without exposing backend objects?

The stage remains admission-only. It does not bind Project, Resource, Runtime, filesystem, process, browser, or other privileged backend implementations to tools.

## Stable identities

- `ngvge.workspace-tool-capability-host@1`
- Tool Capability Descriptor schema v1
- Tool Capability Grant schema v1

Initial capability identities:

- `ngvge.workspace-capability.workspace-state`
- `ngvge.workspace-capability.project-read`
- `ngvge.workspace-capability.project-command`
- `ngvge.workspace-capability.resource-read`
- `ngvge.workspace-capability.resource-command`

## Layering

```text
Tool Ecosystem Manifest / ToolRegistry
                │
                ▼
      Tool Capability Descriptor
                │
                ▼
  WorkspaceToolCapabilityHost @1
                │
                ▼
       revocable Capability Grant
                │
                ▼
       future provider bindings
```

The Capability Host is not a replacement for Project/Resource authority. It validates admission only. Future stages may bind admitted capability identities to controlled providers, but the provider remains behind the existing NGVGE authority boundary.

## Capability Definition

A capability definition declares:

- stable `capabilityId`;
- semantic scope: Workspace / Project / Resource;
- allowed access verbs;
- privilege classification;
- compatible WS-8 ecosystem authority declarations;
- human-readable semantic responsibility.

The initial access vocabulary is:

```text
observe
query
propose
mutate
```

The distinction is intentional. A future Agent or collaboration surface may receive `propose` without receiving `mutate`.

## Tool Capability Descriptor

A Tool Capability Descriptor is keyed by stable `ngvge.tool.*` identity and contains only explicit requests:

```text
ToolCapabilityDescriptor v1
├── toolId
└── requests[]
    ├── capabilityId
    ├── access
    └── required
```

The descriptor contains no VM, renderer, Scratch Target, DOM object, backend handle, filesystem object, process object, or implementation library identity.

## Admission invariants

Admission fails closed when any of the following is true:

1. the Tool is not present in the Tool Ecosystem Registry;
2. the Tool ecosystem lifecycle is not ACTIVE;
3. the active ToolId is not present in ToolRegistry;
4. no Tool Capability Descriptor is registered;
5. a requested capability definition is not registered;
6. the requested access verb is not allowed by the capability definition;
7. the WS-8 ecosystem authority declaration is insufficient for the requested capability.

A planned ToolId is therefore not enough to obtain a capability grant.

## Revocable grants

Successful admission returns a revocable lease containing a frozen, portable Grant record:

```text
ToolCapabilityGrant v1
├── hostId
├── leaseId
├── toolId
└── capabilities[]
    ├── capabilityId
    ├── access
    ├── required
    ├── scope
    └── privilege
```

The lease can answer whether a declared capability is present and can fail closed when code asks for an undeclared capability.

The Host can revoke:

- one lease by LeaseId;
- every lease for a ToolId.

After revocation, stale references cannot continue capability checks. WS-9A does not yet wire revocation to Window close, extension disable, project switch, or host teardown; that lifecycle binding belongs to a later WS-9 substage.

## Todo reference admission

Todo remains the WS-8 reference Tool and keeps its existing production implementation unchanged.

Its WS-9A descriptor requests only:

```text
ngvge.workspace-capability.workspace-state
access = mutate
```

This declaration is compatible with its existing `workspace-only` ecosystem authority.

Todo does not receive Project or Resource capability declarations.

WS-9A does not route Todo persistence through the Capability Host yet. Existing `WorkspaceToolPersistenceService` consumption remains unchanged so the stage can prove the admission contract without introducing a production behavior switch.

## Planned Terminal / Paint

`ngvge.tool.terminal` and `ngvge.tool.paint` remain PLANNED in WS-8.

WS-9A does not register capability descriptors for them and does not activate them.

In particular, WS-9A does not define host process execution authority. A future Terminal stage must introduce an explicit privileged Host capability and permission/policy boundary rather than treating terminal execution as a consequence of opening a Workspace Tool.

Better Paint will later require a Resource provider binding that accepts ResourceId-addressed DTO/commands rather than backend resource objects.

## Non-goals

WS-9A does not:

- expose raw capability provider objects;
- import Scratch VM or Renderer into the Capability Host;
- expose Scratch Target identity;
- implement Project/Resource provider bindings;
- implement Workspace Context Service;
- wire grants to Window lifecycle automatically;
- add filesystem/process/browser execution capability;
- activate Better Terminal or Better Paint;
- change Todo runtime behavior;
- replace ToolRegistry, Tool Ecosystem Registry, WindowManager, or existing semantic authorities.

## WS-9A completion definition

WS-9A is complete when:

1. Capability Host identity and descriptor/grant schemas are versioned.
2. Workspace / Project / Resource capabilities have explicit stable identities.
3. query/propose/mutate semantics are distinct.
4. admission requires ACTIVE ecosystem lifecycle and active ToolRegistry identity.
5. unregistered/undeclared/authority-incompatible capability access fails closed.
6. grants are revocable leases.
7. stale leases fail closed after revocation.
8. no raw VM/Renderer/Scratch Target/backend object enters the schema or Host.
9. Todo proves minimal Workspace-only capability admission without production behavior change.
10. Terminal/Paint remain planned and receive no WS-9A admission descriptor.
11. focused Unit and machine gates pass.
12. real production Webpack capability entry passes.
13. cumulative WS-0 through WS-8 regression gates remain green.
14. real Editor production entry remains green.
