import {TOOL_ECOSYSTEM_AUTHORITIES, ToolEcosystemRegistry} from '../../../../src/lib/editor-shell/tool-ecosystem';
import {
    TOOL_CAPABILITY_ACCESS,
    WORKSPACE_TOOL_CAPABILITIES,
    WorkspaceToolCapabilityHost
} from '../../../../src/lib/editor-shell/tool-capability';
import {CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS} from '../../../../src/lib/editor-shell/tool-capability-descriptors';
import {TOOL_IDS, ToolRegistry, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../../src/lib/editor-shell/window-manager';
import {
    WORKSPACE_CONTEXT_DOMAINS,
    WORKSPACE_CONTEXT_SERVICE_ID,
    WORKSPACE_CONTEXT_SOURCE_IDS,
    WorkspaceContextService,
    bindWindowManagerToWorkspaceContext,
    createWorkspaceContextReadCapability
} from '../../../../src/lib/editor-shell/workspace-context';

const makeToolDefinition = toolId => ({
    schemaVersion: 1,
    id: toolId,
    title: 'Context Test Tool',
    iconKey: 'context-test',
    commandScope: 'workspace',
    singleton: true,
    source: {kind: 'first-party', providerId: 'ngvge.core'},
    window: {
        id: 'context-test-window',
        title: 'Context Test Tool',
        role: 'supporting',
        defaultVisible: false,
        defaultPosition: {x: 0, y: 0},
        defaultSize: {width: 320, height: 240},
        minSize: {width: 100, height: 100},
        maxSize: {width: 1000, height: 1000},
        capabilities: {close: true, minimize: true, maximize: true, resize: true, persist: true}
    }
});

const makeManifest = toolId => ({
    schemaVersion: 1,
    toolId,
    title: 'Context Test Tool',
    lifecycle: 'active',
    origin: 'first-party',
    requiredServices: [],
    persistenceScopes: ['workspace'],
    authority: TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
    ossIntake: {status: 'not-applicable'},
    notes: 'WS-9B Context capability test.'
});

const createContextLease = () => {
    const toolId = 'ngvge.tool.context-test';
    const toolRegistry = new ToolRegistry([makeToolDefinition(toolId)]);
    const ecosystemRegistry = new ToolEcosystemRegistry({toolRegistry, manifests: [makeManifest(toolId)]});
    const host = new WorkspaceToolCapabilityHost({
        toolRegistry,
        ecosystemRegistry,
        definitions: CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS,
        descriptors: [{
            schemaVersion: 1,
            toolId,
            requests: [{
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                required: true
            }]
        }]
    });
    return {host, lease: host.admit(toolId)};
};

describe('WS-9B Workspace Context Service', () => {
    test('starts from a frozen portable snapshot with stable semantic identity only', () => {
        const service = new WorkspaceContextService();
        const snapshot = service.getSnapshot();
        expect(service.id).toBe(WORKSPACE_CONTEXT_SERVICE_ID);
        expect(snapshot).toEqual({
            schemaVersion: 1,
            serviceId: WORKSPACE_CONTEXT_SERVICE_ID,
            revision: 0,
            projectId: null,
            sceneId: null,
            selectedNodeIds: [],
            primaryNodeId: null,
            resourceId: null,
            activeToolId: null,
            activeWindowId: null
        });
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.selectedNodeIds)).toBe(true);
        expect(snapshot).not.toHaveProperty('vm');
        expect(snapshot).not.toHaveProperty('target');
        expect(snapshot).not.toHaveProperty('renderer');
    });

    test('projects Project, Scene, Node selection, and Resource identities through one-writer domains', () => {
        const service = new WorkspaceContextService();
        const project = service.claimWriter('project', 'ngvge.workspace-context-source.project-lifecycle');
        const scene = service.claimWriter('scene', 'ngvge.workspace-context-source.scene-runtime');
        const selection = service.claimWriter('node-selection', 'ngvge.workspace-context-source.node-selection');
        const resource = service.claimWriter('resource', 'ngvge.workspace-context-source.resource-selection');
        const events = [];
        service.subscribe(event => events.push(event));

        project.update({projectId: 'project-1'});
        scene.update({sceneId: 'scene-2'});
        selection.update({selectedNodeIds: ['node-a', 'node-b'], primaryNodeId: 'node-b'});
        resource.update({resourceId: 'ngvge:resource:resource-0003'});

        expect(service.getSnapshot()).toMatchObject({
            projectId: 'project-1',
            sceneId: 'scene-2',
            selectedNodeIds: ['node-a', 'node-b'],
            primaryNodeId: 'node-b',
            resourceId: 'ngvge:resource:resource-0003',
            revision: 4
        });
        expect(events.map(event => event.domain)).toEqual(['project', 'scene', 'node-selection', 'resource']);
        expect(events.every(event => Object.isFrozen(event) && Object.isFrozen(event.snapshot))).toBe(true);
    });

    test('fails closed when a second source attempts to own the same Context domain', () => {
        const service = new WorkspaceContextService();
        service.claimWriter(WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION, 'ngvge.workspace-context-source.explorer');
        expect(() => service.claimWriter(
            WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION,
            'ngvge.workspace-context-source.agent'
        )).toThrow(/already has a writer/);
    });

    test('rejects malformed selection and backend-shaped fields instead of normalizing them silently', () => {
        const service = new WorkspaceContextService();
        const selection = service.claimWriter(
            WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION,
            'ngvge.workspace-context-source.node-selection'
        );
        expect(() => selection.update({selectedNodeIds: ['node-a'], primaryNodeId: 'node-b'}))
            .toThrow(/must be present/);
        expect(() => selection.update({
            selectedNodeIds: ['node-a'],
            primaryNodeId: 'node-a',
            target: {}
        })).toThrow(/unsupported field/);
        expect(() => selection.update({selectedNodeIds: ['node-a', 'node-a'], primaryNodeId: 'node-a'}))
            .toThrow(/duplicate NodeId/);
    });

    test('writer release clears the projected domain and stale writer references fail closed', () => {
        const service = new WorkspaceContextService();
        const writer = service.claimWriter(
            WORKSPACE_CONTEXT_DOMAINS.RESOURCE,
            'ngvge.workspace-context-source.asset-selection'
        );
        writer.update({resourceId: 'ngvge:resource:resource-000a'});
        expect(writer.release()).toBe(true);
        expect(service.getSnapshot().resourceId).toBeNull();
        expect(service.getWriterSource(WORKSPACE_CONTEXT_DOMAINS.RESOURCE)).toBeNull();
        expect(() => writer.update({resourceId: 'ngvge:resource:resource-000b'})).toThrow(/no longer active/);
    });

    test('WindowManager binding projects active WindowId and ToolId without copying Window authority', () => {
        const service = new WorkspaceContextService();
        const manager = new WindowManager();
        const registry = createCoreToolRegistry();
        const explorer = createWindowDescriptor(registry.require(TOOL_IDS.NODE_EXPLORER));
        const inspector = createWindowDescriptor(registry.require(TOOL_IDS.INSPECTOR));
        manager.registerWindow(explorer, {visible: true});
        manager.registerWindow(inspector, {visible: true});
        const binding = bindWindowManagerToWorkspaceContext({contextService: service, windowManager: manager});

        expect(service.getWriterSource(WORKSPACE_CONTEXT_DOMAINS.WINDOW))
            .toBe(WORKSPACE_CONTEXT_SOURCE_IDS.WINDOW_MANAGER);
        expect(service.getSnapshot()).toMatchObject({activeToolId: null, activeWindowId: null});

        manager.activate(explorer.windowId);
        expect(service.getSnapshot()).toMatchObject({
            activeToolId: TOOL_IDS.NODE_EXPLORER,
            activeWindowId: explorer.windowId
        });
        manager.activate(inspector.windowId);
        expect(service.getSnapshot()).toMatchObject({
            activeToolId: TOOL_IDS.INSPECTOR,
            activeWindowId: inspector.windowId
        });
        manager.close(inspector.windowId);
        expect(service.getSnapshot()).toMatchObject({
            activeToolId: TOOL_IDS.NODE_EXPLORER,
            activeWindowId: explorer.windowId
        });
        expect(binding.dispose()).toBe(true);
        expect(service.getSnapshot()).toMatchObject({activeToolId: null, activeWindowId: null});
    });

    test('Context read capability is lease-gated and a revoked Tool lease stops future observation', () => {
        const service = new WorkspaceContextService();
        const writer = service.claimWriter('project', 'ngvge.workspace-context-source.project-lifecycle');
        const {host, lease} = createContextLease();
        const capability = createWorkspaceContextReadCapability({contextService: service, capabilityLease: lease});
        const events = [];
        capability.subscribe(event => events.push(event));

        writer.update({projectId: 'project-1'});
        expect(capability.getSnapshot().projectId).toBe('project-1');
        expect(events).toHaveLength(1);

        host.revoke(lease.id, 'tool-disabled');
        writer.update({projectId: 'project-2'});
        expect(events).toHaveLength(1);
        expect(() => capability.getSnapshot()).toThrow(/revoked/);
    });

    test('a Tool without explicit context-read admission cannot wrap the Context Service', () => {
        const toolId = 'ngvge.tool.no-context';
        const toolRegistry = new ToolRegistry([makeToolDefinition(toolId)]);
        const ecosystemRegistry = new ToolEcosystemRegistry({toolRegistry, manifests: [makeManifest(toolId)]});
        const host = new WorkspaceToolCapabilityHost({
            toolRegistry,
            ecosystemRegistry,
            definitions: CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS,
            descriptors: [{schemaVersion: 1, toolId, requests: []}]
        });
        const lease = host.admit(toolId);
        expect(() => createWorkspaceContextReadCapability({
            contextService: new WorkspaceContextService(),
            capabilityLease: lease
        })).toThrow(/was not declared/);
    });
});
