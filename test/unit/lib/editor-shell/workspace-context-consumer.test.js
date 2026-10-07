import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createCoreToolEcosystemRegistry} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';
import {createCoreWorkspaceToolCapabilityHost} from '../../../../src/lib/editor-shell/tool-capability-descriptors';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';
import {WorkspaceToolPersistenceService} from '../../../../src/lib/editor-shell/workspace-tool-persistence';
import {
    createCoreWorkspaceCapabilityProviderRegistry
} from '../../../../src/lib/editor-shell/workspace-capability-providers';
import {
    WORKSPACE_CONTEXT_CONSUMER_ADMISSION_ID,
    admitWorkspaceContextConsumer
} from '../../../../src/lib/editor-shell/workspace-context-consumer';

const createFixture = () => {
    const toolRegistry = createCoreToolRegistry();
    const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
    const capabilityHost = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
    const contextService = new WorkspaceContextService();
    const providerRegistry = createCoreWorkspaceCapabilityProviderRegistry({
        capabilityHost,
        contextService,
        workspaceToolPersistenceService: new WorkspaceToolPersistenceService()
    });
    return {toolRegistry, capabilityHost, contextService, providerRegistry};
};

describe('WS-9D Workspace Context consumer admission', () => {
    test('admits Agent through an explicit revocable context-read/query lease', () => {
        const {capabilityHost, contextService, providerRegistry} = createFixture();
        const writer = contextService.claimWriter('node-selection', 'ngvge.workspace-context-source.test');
        writer.update({selectedNodeIds: ['node:a'], primaryNodeId: 'node:a'});
        const consumer = admitWorkspaceContextConsumer({
            capabilityHost,
            providerRegistry,
            toolId: TOOL_IDS.AGENT
        });
        expect(consumer.id).toBe(WORKSPACE_CONTEXT_CONSUMER_ADMISSION_ID);
        expect(consumer.isActive()).toBe(true);
        expect(consumer.contextRead.getSnapshot()).toMatchObject({primaryNodeId: 'node:a'});
        expect(consumer.dispose()).toBe(true);
        expect(consumer.isActive()).toBe(false);
        expect(() => consumer.contextRead.getSnapshot()).toThrow(/revoked/);
    });

    test('fails closed when a Tool has no explicit context-read descriptor', () => {
        const {capabilityHost, contextService, providerRegistry} = createFixture();
        expect(() => admitWorkspaceContextConsumer({
            capabilityHost,
            providerRegistry,
            toolId: TOOL_IDS.TODO
        })).toThrow(/was not declared/);
    });

    test('ToolRegistry unload revokes the consumer and immediately stops Context observation', () => {
        const {toolRegistry, capabilityHost, contextService, providerRegistry} = createFixture();
        const writer = contextService.claimWriter('project', 'ngvge.workspace-context-source.test-project');
        const consumer = admitWorkspaceContextConsumer({
            capabilityHost,
            providerRegistry,
            toolId: TOOL_IDS.AGENT
        });
        const events = [];
        consumer.contextRead.subscribe(event => events.push(event));
        writer.update({projectId: 'project-a'});
        expect(events).toHaveLength(1);

        toolRegistry.unregister(TOOL_IDS.AGENT);
        expect(consumer.isActive()).toBe(false);
        writer.update({projectId: 'project-b'});
        expect(events).toHaveLength(1);
        expect(() => consumer.contextRead.getSnapshot()).toThrow(/revoked/);
    });
});
