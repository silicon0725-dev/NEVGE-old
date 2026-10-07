import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createCoreToolEcosystemRegistry} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';
import {createCoreWorkspaceToolCapabilityHost} from '../../../../src/lib/editor-shell/tool-capability-descriptors';
import {createWorkspaceNodeCommandHost} from '../../../../src/lib/editor-shell/node-workspace-command';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';
import {WorkspaceToolPersistenceService} from '../../../../src/lib/editor-shell/workspace-tool-persistence';
import {
    createCoreWorkspaceCapabilityProviderRegistry
} from '../../../../src/lib/editor-shell/workspace-capability-providers';
import {admitWorkspaceContextConsumer} from '../../../../src/lib/editor-shell/workspace-context-consumer';
import {createWorkspaceAgentRuntime} from '../../../../src/lib/editor-shell/agent-workspace-runtime';

const createDatabase = () => {
    const nodes = new Map([
        ['node:a', {
            childIds: [], enabled: true, id: 'node:a', name: 'A', parentId: null,
            properties: {}, targetId: null, typeId: 'ngvge.node'
        }],
        ['node:b', {
            childIds: [], enabled: false, id: 'node:b', name: 'B', parentId: 'node:a',
            properties: {}, targetId: null, typeId: 'ngvge.node'
        }]
    ]);
    return {
        nodes,
        createNode: jest.fn(),
        deleteNodes: jest.fn(),
        duplicateNodes: jest.fn(),
        getNode: jest.fn(nodeId => {
            const node = nodes.get(nodeId);
            return node ? JSON.parse(JSON.stringify(node)) : null;
        }),
        renameNode: jest.fn(),
        reparentNodes: jest.fn(),
        setNodeEnabled: jest.fn(),
        setNodeProperty: jest.fn()
    };
};

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
    const selectionWriter = contextService.claimWriter('node-selection', 'ngvge.workspace-context-source.test-selection');
    const projectWriter = contextService.claimWriter('project', 'ngvge.workspace-context-source.test-project');
    const consumer = admitWorkspaceContextConsumer({
        capabilityHost,
        providerRegistry,
        toolId: TOOL_IDS.AGENT
    });
    const database = createDatabase();
    const workspaceNodeCommandHost = createWorkspaceNodeCommandHost({projectNodeDatabase: database});
    const runtime = createWorkspaceAgentRuntime({
        workspaceNodeCommandHost,
        contextReadCapability: consumer.contextRead
    });
    return {
        toolRegistry,
        capabilityHost,
        contextService,
        selectionWriter,
        projectWriter,
        consumer,
        runtime
    };
};

describe('WS-9D Agent admitted Context migration', () => {
    test('reads primary NodeId from admitted Workspace Context instead of a getCurrentNodeId callback', () => {
        const {selectionWriter, projectWriter, runtime} = createFixture();
        projectWriter.update({projectId: 'project-a'});
        selectionWriter.update({selectedNodeIds: ['node:a'], primaryNodeId: 'node:a'});
        expect(runtime.model.getView().context).toMatchObject({
            nodeId: 'node:a',
            node: {id: 'node:a', name: 'A', typeId: 'ngvge.node'}
        });
        expect(runtime.model.getView().context).not.toHaveProperty('projectId');
        expect(runtime.model.getView().context).not.toHaveProperty('resourceId');
    });

    test('Context capability events advance Agent model revision so selection UI cannot retain stale context', () => {
        const {selectionWriter, runtime} = createFixture();
        const revisions = [];
        runtime.model.subscribe(event => {
            if (event.type === 'context:changed') revisions.push(event.revision);
        });
        selectionWriter.update({selectedNodeIds: ['node:a'], primaryNodeId: 'node:a'});
        const firstRevision = runtime.model.revision;
        selectionWriter.update({selectedNodeIds: ['node:b'], primaryNodeId: 'node:b'});
        expect(runtime.model.revision).toBeGreaterThan(firstRevision);
        expect(revisions.length).toBeGreaterThanOrEqual(2);
        expect(runtime.model.getView().context).toMatchObject({nodeId: 'node:b', node: {name: 'B'}});
    });

    test('revoked admission fails closed instead of falling back to stale Agent context', () => {
        const {selectionWriter, capabilityHost, consumer, runtime} = createFixture();
        selectionWriter.update({selectedNodeIds: ['node:a'], primaryNodeId: 'node:a'});
        expect(runtime.model.getView().context.nodeId).toBe('node:a');
        capabilityHost.revoke(consumer.lease.id, 'tool-disabled');
        const view = runtime.model.getView();
        expect(view.context.nodeId).toBeNull();
        expect(view.context.node).toBeNull();
        expect(view.context.unavailable).toMatch(/revoked/);
    });

    test('runtime dispose removes the Context subscription', () => {
        const {selectionWriter, runtime} = createFixture();
        selectionWriter.update({selectedNodeIds: ['node:a'], primaryNodeId: 'node:a'});
        const revision = runtime.model.revision;
        expect(runtime.dispose()).toBe(true);
        selectionWriter.update({selectedNodeIds: ['node:b'], primaryNodeId: 'node:b'});
        expect(runtime.model.revision).toBe(revision);
        expect(runtime.dispose()).toBe(false);
    });
});
