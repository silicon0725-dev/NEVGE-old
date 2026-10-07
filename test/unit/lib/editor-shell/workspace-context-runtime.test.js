import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../../src/lib/editor-shell/window-manager';
import {
    WORKSPACE_CONTEXT_DOMAINS,
    WORKSPACE_CONTEXT_SOURCE_IDS,
    WorkspaceContextService
} from '../../../../src/lib/editor-shell/workspace-context';
import {
    WORKSPACE_CONTEXT_RUNTIME_BINDING_ID,
    createProjectContextId,
    createWorkspaceContextRuntimeBinding
} from '../../../../src/lib/editor-shell/workspace-context-runtime';

const createLifecycleHarness = (projectGeneration = 1) => {
    const listeners = new Set();
    let state = {
        activeOperation: null,
        lastCompletedOperation: null,
        lastFailedOperation: null,
        projectGeneration
    };
    return {
        host: {
            getState: () => state,
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        },
        emit: (type, patch = {}) => {
            state = Object.assign({}, state, patch);
            listeners.forEach(listener => listener({state, type}));
        }
    };
};

const createModuleManagerHarness = activeSceneId => {
    const listeners = new Set();
    let enabled = true;
    let project = {activeSceneId, scenes: []};
    return {
        manager: {
            getModuleData: () => project,
            getModuleState: () => ({enabled}),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        },
        setActiveScene: sceneId => {
            project = {activeSceneId: sceneId, scenes: []};
            listeners.forEach(listener => listener({moduleId: 'ngvge.scene-system', type: 'module-data'}));
        },
        setEnabled: value => {
            enabled = Boolean(value);
            listeners.forEach(listener => listener({moduleId: 'ngvge.scene-system', type: 'module-state'}));
        }
    };
};

const createWindowHarness = () => {
    const manager = new WindowManager();
    const registry = createCoreToolRegistry();
    const explorer = createWindowDescriptor(registry.require(TOOL_IDS.NODE_EXPLORER));
    manager.registerWindow(explorer, {visible: true});
    return {explorer, manager};
};

describe('WS-9C Context Source Integration & Lifecycle Binding', () => {
    test('uses lifecycle generation rather than a host/server project identifier', () => {
        expect(createProjectContextId(0)).toBeNull();
        expect(createProjectContextId(1)).toBe('ngvge.project-context.g1');
        expect(createProjectContextId(42)).toBe('ngvge.project-context.g42');
        expect(createProjectContextId('42')).toBeNull();
    });

    test('binds Project, Scene, Node, Resource, and Window projections through one runtime binding', () => {
        const contextService = new WorkspaceContextService();
        const lifecycle = createLifecycleHarness(3);
        const scenes = createModuleManagerHarness('scene-a');
        const windows = createWindowHarness();
        const binding = createWorkspaceContextRuntimeBinding({
            contextService,
            projectLifecycleHost: lifecycle.host,
            moduleManager: scenes.manager,
            windowManager: windows.manager
        });

        expect(binding.id).toBe(WORKSPACE_CONTEXT_RUNTIME_BINDING_ID);
        expect(contextService.getWriterSource(WORKSPACE_CONTEXT_DOMAINS.PROJECT))
            .toBe(WORKSPACE_CONTEXT_SOURCE_IDS.PROJECT_LIFECYCLE);
        expect(contextService.getWriterSource(WORKSPACE_CONTEXT_DOMAINS.SCENE))
            .toBe(WORKSPACE_CONTEXT_SOURCE_IDS.SCENE_SYSTEM);
        expect(contextService.getWriterSource(WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION))
            .toBe(WORKSPACE_CONTEXT_SOURCE_IDS.NODE_SELECTION);
        expect(contextService.getWriterSource(WORKSPACE_CONTEXT_DOMAINS.RESOURCE))
            .toBe(WORKSPACE_CONTEXT_SOURCE_IDS.RESOURCE_SELECTION);

        binding.setNodeSelection(['node-a', 'node-b'], 'node-b');
        binding.setResourceSelection('ngvge:resource:asset-0007');
        windows.manager.activate(windows.explorer.windowId);

        expect(contextService.getSnapshot()).toMatchObject({
            projectId: 'ngvge.project-context.g3',
            sceneId: 'scene-a',
            selectedNodeIds: ['node-a', 'node-b'],
            primaryNodeId: 'node-b',
            resourceId: 'ngvge:resource:asset-0007',
            activeToolId: TOOL_IDS.NODE_EXPLORER,
            activeWindowId: windows.explorer.windowId
        });
    });

    test('root project load clears dependent projections before the new generation is published', () => {
        const contextService = new WorkspaceContextService();
        const lifecycle = createLifecycleHarness(5);
        const scenes = createModuleManagerHarness('scene-old');
        const windows = createWindowHarness();
        const binding = createWorkspaceContextRuntimeBinding({
            contextService,
            projectLifecycleHost: lifecycle.host,
            moduleManager: scenes.manager,
            windowManager: windows.manager
        });
        binding.setNodeSelection(['node-old'], 'node-old');
        binding.setResourceSelection('ngvge:resource:asset-old0');

        lifecycle.emit('operation:start', {
            activeOperation: {nested: false, rootKind: 'load'}
        });
        expect(contextService.getSnapshot()).toMatchObject({
            projectId: null,
            sceneId: null,
            selectedNodeIds: [],
            primaryNodeId: null,
            resourceId: null
        });

        scenes.setActiveScene('scene-new');
        binding.setNodeSelection(['node-from-load'], 'node-from-load');
        binding.setResourceSelection('ngvge:resource:asset-load');
        expect(contextService.getSnapshot()).toMatchObject({
            projectId: null,
            sceneId: null,
            selectedNodeIds: [],
            resourceId: null
        });

        lifecycle.emit('operation:complete', {
            activeOperation: null,
            lastCompletedOperation: {rootKind: 'load'},
            projectGeneration: 6
        });
        expect(contextService.getSnapshot()).toMatchObject({
            projectId: 'ngvge.project-context.g6',
            sceneId: 'scene-new',
            selectedNodeIds: [],
            resourceId: null
        });
    });

    test('failed root load restores the previous project generation projection without stale selections', () => {
        const contextService = new WorkspaceContextService();
        const lifecycle = createLifecycleHarness(8);
        const scenes = createModuleManagerHarness('scene-a');
        const windows = createWindowHarness();
        const binding = createWorkspaceContextRuntimeBinding({
            contextService,
            projectLifecycleHost: lifecycle.host,
            moduleManager: scenes.manager,
            windowManager: windows.manager
        });
        binding.setNodeSelection(['node-a'], 'node-a');
        binding.setResourceSelection('ngvge:resource:asset-000a');

        lifecycle.emit('operation:start', {activeOperation: {nested: false, rootKind: 'load'}});
        lifecycle.emit('operation:error', {
            activeOperation: null,
            lastFailedOperation: {rootKind: 'load'},
            projectGeneration: 8
        });

        expect(contextService.getSnapshot()).toMatchObject({
            projectId: 'ngvge.project-context.g8',
            sceneId: 'scene-a',
            selectedNodeIds: [],
            primaryNodeId: null,
            resourceId: null
        });
    });

    test('Scene module changes are projected and module disable clears Scene context', () => {
        const contextService = new WorkspaceContextService();
        const lifecycle = createLifecycleHarness(1);
        const scenes = createModuleManagerHarness('scene-a');
        const windows = createWindowHarness();
        createWorkspaceContextRuntimeBinding({
            contextService,
            projectLifecycleHost: lifecycle.host,
            moduleManager: scenes.manager,
            windowManager: windows.manager
        });

        scenes.setActiveScene('scene-b');
        expect(contextService.getSnapshot().sceneId).toBe('scene-b');
        scenes.setEnabled(false);
        expect(contextService.getSnapshot().sceneId).toBeNull();
    });

    test('dispose revokes every source writer and clears the projection', () => {
        const contextService = new WorkspaceContextService();
        const lifecycle = createLifecycleHarness(2);
        const scenes = createModuleManagerHarness('scene-a');
        const windows = createWindowHarness();
        const binding = createWorkspaceContextRuntimeBinding({
            contextService,
            projectLifecycleHost: lifecycle.host,
            moduleManager: scenes.manager,
            windowManager: windows.manager
        });
        binding.setNodeSelection(['node-a'], 'node-a');
        binding.setResourceSelection('ngvge:resource:asset-000a');

        expect(binding.dispose()).toBe(true);
        expect(binding.dispose()).toBe(false);
        expect(contextService.getSnapshot()).toMatchObject({
            projectId: null,
            sceneId: null,
            selectedNodeIds: [],
            primaryNodeId: null,
            resourceId: null,
            activeToolId: null,
            activeWindowId: null
        });
        Object.values(WORKSPACE_CONTEXT_DOMAINS).forEach(domain => {
            expect(contextService.getWriterSource(domain)).toBeNull();
        });
        expect(() => binding.setResourceSelection('ngvge:resource:asset-000b')).toThrow(/disposed/);
    });
});
