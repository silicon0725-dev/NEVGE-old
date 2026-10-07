# WS-9D | Context Consumer Admission & Agent Migration

Status: COMPLETE / VERIFIED  
Authority: ARC-0001  
Baseline: WS-9C COMPLETE / VERIFIED

## Purpose

WS-9D closes the first production consumer loop for Workspace Context.

WS-9B created a query-only Context capability and WS-9C connected authoritative sources. WS-9D now requires a Tool to pass Tool Ecosystem + Capability admission before it can consume Context, then migrates the first privileged consumer — `ngvge.tool.agent` — away from the legacy `getCurrentNodeId()` callback path.

The production chain is now:

```text
ToolRegistry + Tool Ecosystem Manifest
        ↓
WorkspaceToolCapabilityHost
        ↓ admit ToolId
revocable Tool Capability Lease
        ↓
Workspace Context Consumer Admission
        ↓
context-read / query facade
        ↓
Agent Workspace Runtime
        ↓ minimal safe projection
NodeId + portable Node snapshot
```

The Agent never receives `WorkspaceContextService` itself.

## Stable identity

- `ngvge.workspace-context-consumer-admission@1`
- existing `ngvge.workspace-tool-capability-host@1`
- existing `ngvge.workspace-capability.context-read`
- existing `ngvge.workspace-context-read-capability@1`
- ToolId `ngvge.tool.agent`

## Agent ecosystem admission

The Agent now has an active first-party Tool Ecosystem manifest declaring these dependencies:

```text
workspace.window-manager
workspace.context
workspace.node-command
agent.transaction
```

Its ecosystem authority classification is `project-command`, describing the maximum existing reviewed Agent transaction responsibility. This declaration does **not** grant a raw Project writer.

The Tool Capability Descriptor remains deliberately narrower:

```text
ToolId: ngvge.tool.agent
Capability: ngvge.workspace-capability.context-read
Access: query
Required: true
```

No `project-command/mutate` capability is granted by the Workspace Tool Capability Host in WS-9D. Existing Agent mutation still flows through the separately reviewed ChangeSet / AgentTransactionHost boundary established by WS-7.

## Context consumer admission

`admitWorkspaceContextConsumer()` performs:

```text
ToolId
  ↓
CapabilityHost.admit(ToolId)
  ↓
validate explicit context-read/query descriptor
  ↓
create Workspace Context read facade
  ↓
return consumer lifecycle + revocable lease
```

A Tool without an explicit Context descriptor fails closed. Todo therefore cannot consume Context merely because the Context Service exists.

Terminal and Paint remain `PLANNED` and still receive no capability descriptors.

## Agent migration

The legacy production path is retired:

```text
GUI selected Node ref
  ↓
getCurrentNodeId()
  ↓
Agent runtime
```

The new path is:

```text
Workspace Context source projection
  ↓
WorkspaceContextService
  ↓
context-read/query lease facade
  ↓
Agent runtime reads primaryNodeId
```

`getCurrentNodeId` no longer exists in production `src/`.

## Safe Agent projection remains unchanged

WS-9D intentionally does not expand the AI/provider visibility contract merely because Workspace Context contains more fields.

The Agent runtime consumes `primaryNodeId` from the admitted Context snapshot, then projects only:

```text
{
  nodeId,
  node: portable Node snapshot
}
```

It does not expose Context `projectId`, `sceneId`, `resourceId`, `activeToolId`, `activeWindowId`, raw Context Service, VM, Renderer, Scratch Target, Redux, DOM, or backend handles to the Agent model/provider surface.

## Live Context refresh

The former ref callback path could change selected Node without changing Agent Model revision. Because the Agent UI memoizes its view from Model revision, a pure selection change could retain stale Context presentation.

WS-9D fixes this by subscribing the Agent runtime to the admitted Context facade:

```text
Context event
  ↓
Agent runtime
  ↓
model.notifyContextChanged()
  ↓
Agent Model revision
  ↓
UI recomputes Current Context
```

This subscription is read-only and owns no Context writer authority.

## Lease revocation lifecycle

Capability leases are no longer passive objects. They support revocation listeners and consumer release.

The Capability Host subscribes to ToolRegistry lifecycle:

```text
ToolRegistry tool:unregistered
  ↓
CapabilityHost.revokeTool(toolId)
  ↓
lease revoked immediately
  ↓
Context facade unsubscribes immediately
  ↓
future getSnapshot() fails closed
```

Host disposal revokes every still-active lease with `host-disposed`.

This is the generic lifecycle seam future extension-provided Tools can use: disabling/unloading an Extension Tool must remove its ToolId from ToolRegistry, which automatically revokes its admitted leases. NGVGE currently has no active extension-provided Workspace Tool implementation, so WS-9D does not invent a parallel Extension-specific revocation authority.

## Production bootstrap

GUI now owns one Workspace Tool Capability Host lifecycle and one Agent Context consumer admission lifecycle.

The Agent runtime receives only:

```text
contextReadCapability: agentContextConsumer.contextRead
```

It does not receive `workspaceContextService`.

On GUI teardown:

- Agent runtime unsubscribes Context observation;
- Agent Context consumer releases its lease;
- Capability Host revokes any remaining leases and unsubscribes ToolRegistry lifecycle.

All teardown paths are idempotent.

## Cumulative Gate evolution

WS-9B and WS-9C originally asserted that Agent had not yet migrated, because migration was explicitly deferred at those stages. WS-9D supersedes that temporary non-goal.

Their machine gates were therefore updated from the historical assertion:

```text
Agent must still use getCurrentNodeId
```

into the actual permanent invariant:

```text
Agent must never receive raw WorkspaceContextService authority.
Legacy callback or later admitted capability consumption are both valid for the older stage boundary.
```

This preserves cumulative certification without freezing a temporary implementation state forever.

## Non-goals

WS-9D does not:

- grant Agent raw Project mutation through Capability Host;
- replace WS-7 ChangeSet review / AgentTransactionHost;
- expose full Workspace Context to the AI/provider surface;
- make Workspace Context a semantic writer authority;
- activate Terminal or Paint;
- add filesystem, process, browser, network, credential, or shell capabilities;
- create active extension-provided Workspace Tools;
- persist Workspace Context or capability leases;
- expose VM, Scratch Target, Renderer, Redux store, React component, DOM node, or backend-private handle.

## Definition of Done

1. Agent has an active Tool Ecosystem manifest with explicit Context dependency.
2. Agent declares `context-read/query` in Tool Capability Descriptor.
3. Agent is admitted through WorkspaceToolCapabilityHost before Context consumption.
4. Agent receives a Context capability facade, never raw WorkspaceContextService.
5. production `getCurrentNodeId()` Agent bypass is retired.
6. Agent Context still exposes only the WS-7 safe Node projection.
7. Agent Model revision follows Context events so selection UI cannot remain stale.
8. Context consumer admission fails closed for undeclared Tools.
9. ToolRegistry unregister immediately revokes active Tool leases.
10. Context subscriptions detach immediately on lease revocation.
11. Host disposal revokes remaining leases and forbids new admission.
12. Terminal/Paint remain planned and unadmitted.
13. WS-9B/WS-9C cumulative gates encode permanent no-raw-Service invariants rather than temporary migration deferral.
14. focused machine / Unit gates pass.
15. real Webpack consumer / Agent entries pass.
16. full Unit, Integration, Smoke, ESLint, TypeScript and permanent regression remain green.
17. LSC-G1 / LRC-G1 / LPL-G1 / LEX-G1 / COL-0 / ARC-C001.1 remain green.
