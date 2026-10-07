import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createCoreToolEcosystemRegistry} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';
import {createCoreWorkspaceToolCapabilityHost} from '../../../../src/lib/editor-shell/tool-capability-descriptors';
import {
    TOOL_CAPABILITY_ACCESS,
    WORKSPACE_TOOL_CAPABILITIES
} from '../../../../src/lib/editor-shell/tool-capability';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';
import {WorkspaceToolPersistenceService} from '../../../../src/lib/editor-shell/workspace-tool-persistence';
import {
    WORKSPACE_CAPABILITY_PROVIDER_REGISTRY_ID,
    WORKSPACE_CAPABILITY_PROVIDER_STATES,
    WorkspaceCapabilityProviderRegistry,
    normalizeProviderDescriptor
} from '../../../../src/lib/editor-shell/workspace-capability-provider';
import {
    CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS,
    createCoreWorkspaceCapabilityProviderRegistry
} from '../../../../src/lib/editor-shell/workspace-capability-providers';

const createFixture = () => {
    const toolRegistry = createCoreToolRegistry();
    const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
    const capabilityHost = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
    const contextService = new WorkspaceContextService();
    const persistenceService = new WorkspaceToolPersistenceService();
    return {toolRegistry, capabilityHost, contextService, persistenceService};
};

const contextProviderDescriptor = providerId => ({
    schemaVersion: 1,
    providerId,
    capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
    access: TOOL_CAPABILITY_ACCESS.QUERY,
    description: 'Context provider test seam.'
});

describe('WS-9E Workspace Capability Provider Binding & Diagnostics', () => {
    test('binds Agent context-read through the core provider registry and preserves revocable facade semantics', () => {
        const {capabilityHost, contextService, persistenceService} = createFixture();
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost,
            contextService,
            workspaceToolPersistenceService: persistenceService
        });
        const writer = contextService.claimWriter('node-selection', 'ngvge.workspace-context-source.provider-test');
        writer.update({selectedNodeIds: ['node:provider'], primaryNodeId: 'node:provider'});
        const lease = capabilityHost.admit(TOOL_IDS.AGENT);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
        expect(registry.id).toBe(WORKSPACE_CAPABILITY_PROVIDER_REGISTRY_ID);
        expect(binding.providerId).toBe(CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.CONTEXT_READ);
        expect(binding.facade.getSnapshot()).toMatchObject({primaryNodeId: 'node:provider'});
        expect(binding.release('test-release')).toBe(true);
        expect(binding.getRevokeReason()).toBe('test-release');
        expect(() => binding.facade.getSnapshot()).toThrow(/binding has been revoked/);
    });

    test('reports provider-missing before binding instead of allowing late undefined service access', () => {
        const {capabilityHost} = createFixture();
        const registry = new WorkspaceCapabilityProviderRegistry({capabilityHost});
        const diagnostics = registry.diagnoseTool(TOOL_IDS.AGENT);
        expect(diagnostics.requests).toEqual([
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_MISSING,
                diagnosticCode: 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_MISSING'
            })
        ]);
        const lease = capabilityHost.admit(TOOL_IDS.AGENT);
        expect(() => registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        })).toThrow(/No Workspace Capability Provider/);
    });

    test('fails closed when a registered provider reports unavailable and surfaces its diagnostic', () => {
        const {capabilityHost} = createFixture();
        const registry = new WorkspaceCapabilityProviderRegistry({capabilityHost});
        registry.registerProvider({
            descriptor: contextProviderDescriptor('ngvge.workspace-capability-provider.context-unavailable'),
            createFacade: () => ({getSnapshot: () => ({})}),
            getAvailability: () => ({
                available: false,
                code: 'NGVGE_CONTEXT_SOURCE_OFFLINE',
                message: 'Context source is offline.'
            })
        });
        expect(registry.diagnoseTool(TOOL_IDS.AGENT).requests[0]).toMatchObject({
            state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
            diagnosticCode: 'NGVGE_CONTEXT_SOURCE_OFFLINE'
        });
        const lease = capabilityHost.admit(TOOL_IDS.AGENT);
        expect(() => registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        })).toThrow(/Context source is offline/);
    });

    test('an already-bound facade fails closed when provider availability changes at runtime', () => {
        const {capabilityHost} = createFixture();
        const registry = new WorkspaceCapabilityProviderRegistry({capabilityHost});
        let available = true;
        registry.registerProvider({
            descriptor: contextProviderDescriptor('ngvge.workspace-capability-provider.context-dynamic'),
            createFacade: () => ({getSnapshot: () => ({revision: 7})}),
            getAvailability: () => ({
                available,
                code: available ? null : 'NGVGE_CONTEXT_TEMPORARILY_UNAVAILABLE',
                message: available ? null : 'Context provider temporarily unavailable.'
            })
        });
        const lease = capabilityHost.admit(TOOL_IDS.AGENT);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
        expect(binding.facade.getSnapshot()).toEqual({revision: 7});
        available = false;
        expect(binding.getAvailability()).toMatchObject({available: false});
        expect(() => binding.facade.getSnapshot()).toThrow(/temporarily unavailable/);
    });

    test('provider unregister revokes existing bindings even while the Tool admission lease remains active', () => {
        const {capabilityHost} = createFixture();
        const registry = new WorkspaceCapabilityProviderRegistry({capabilityHost});
        const providerId = 'ngvge.workspace-capability-provider.context-ephemeral';
        registry.registerProvider({
            descriptor: contextProviderDescriptor(providerId),
            createFacade: () => ({getSnapshot: () => ({revision: 1})})
        });
        const lease = capabilityHost.admit(TOOL_IDS.AGENT);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
        expect(binding.facade.getSnapshot()).toEqual({revision: 1});
        expect(registry.unregisterProvider(providerId)).toBe(true);
        expect(lease.isActive()).toBe(true);
        expect(binding.isActive()).toBe(false);
        expect(() => binding.facade.getSnapshot()).toThrow(/binding has been revoked/);
    });

    test('Tool admission revoke propagates into provider binding without requiring provider polling', () => {
        const {toolRegistry, capabilityHost, contextService, persistenceService} = createFixture();
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost,
            contextService,
            workspaceToolPersistenceService: persistenceService
        });
        const lease = capabilityHost.admit(TOOL_IDS.AGENT);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
        toolRegistry.unregister(TOOL_IDS.AGENT);
        expect(binding.isActive()).toBe(false);
        expect(binding.getRevokeReason()).toBe('capability-lease:tool-unregistered');
        expect(() => binding.facade.getSnapshot()).toThrow(/binding has been revoked/);
    });

    test('enforces one provider per capability/access surface and rejects raw authority facade fields', () => {
        const {capabilityHost} = createFixture();
        const registry = new WorkspaceCapabilityProviderRegistry({capabilityHost});
        registry.registerProvider({
            descriptor: contextProviderDescriptor('ngvge.workspace-capability-provider.context-primary'),
            createFacade: () => ({getSnapshot: () => ({})})
        });
        expect(() => registry.registerProvider({
            descriptor: contextProviderDescriptor('ngvge.workspace-capability-provider.context-secondary'),
            createFacade: () => ({getSnapshot: () => ({})})
        })).toThrow(/already has a provider/);

        const lease = capabilityHost.admit(TOOL_IDS.AGENT);
        const rawRegistry = new WorkspaceCapabilityProviderRegistry({capabilityHost});
        rawRegistry.registerProvider({
            descriptor: contextProviderDescriptor('ngvge.workspace-capability-provider.context-raw'),
            createFacade: () => ({vm: {}})
        });
        expect(() => rawRegistry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        })).toThrow(/forbidden raw authority field/);
    });

    test('core coverage diagnostics distinguish ready Workspace providers from registered-but-unavailable Project/Resource providers', () => {
        const {capabilityHost, contextService, persistenceService} = createFixture();
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost,
            contextService,
            workspaceToolPersistenceService: persistenceService
        });
        const coverage = registry.getCoverageDiagnostics().surfaces;
        expect(coverage).toEqual(expect.arrayContaining([
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.READY
            }),
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
                diagnosticCode: 'NGVGE_WORKSPACE_PROJECT_READ_PROVIDER_UNAVAILABLE'
            }),
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
                diagnosticCode: 'NGVGE_WORKSPACE_RESOURCE_COMMAND_AUTHORITY_UNAVAILABLE'
            })
        ]));
    });

    test('Workspace state mutate provider is ToolId-scoped and cannot expose another Tool state', () => {
        const {capabilityHost, contextService, persistenceService} = createFixture();
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost,
            contextService,
            workspaceToolPersistenceService: persistenceService
        });
        const lease = capabilityHost.admit(TOOL_IDS.TODO);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        });
        expect(binding.facade.toolId).toBe(TOOL_IDS.TODO);
        expect(binding.facade.setState({schemaVersion: 1, marker: 'todo-only'})).toEqual({
            schemaVersion: 1,
            marker: 'todo-only'
        });
        expect(persistenceService.getState(TOOL_IDS.TODO)).toEqual({schemaVersion: 1, marker: 'todo-only'});
        expect(binding.facade.getState).toBeUndefined();
    });

    test('provider descriptor schema rejects backend-specific fields', () => {
        expect(() => normalizeProviderDescriptor({
            ...contextProviderDescriptor('ngvge.workspace-capability-provider.context-invalid'),
            backend: {}
        })).toThrow(/unsupported field/);
    });
});
