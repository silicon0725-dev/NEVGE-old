import {
    WORKSPACE_TOOL_REGISTRY_ID,
    TOOL_DEFINITION_SCHEMA_VERSION,
    TOOL_IDS,
    TOOL_SOURCE_KINDS,
    WINDOW_IDS,
    ToolRegistry,
    createCoreToolRegistry
} from '../../../../src/lib/editor-shell/tool-registry';

const makeDefinition = id => ({
    schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
    id,
    title: 'Test Tool',
    source: {kind: TOOL_SOURCE_KINDS.DEVELOPER, providerId: 'test.provider'},
    singleton: true,
    window: {
        id: `${id}.window`,
        title: 'Test Tool',
        role: 'supporting',
        defaultVisible: false,
        defaultPosition: {x: 0, y: 0},
        defaultSize: {width: 100, height: 100},
        minSize: {width: 50, height: 50},
        maxSize: {width: 500, height: 500},
        capabilities: {
            close: true,
            minimize: true,
            maximize: true,
            resize: true,
            persist: true
        }
    }
});

describe('Workspace Tool Registry foundation', () => {
    test('publishes stable registry and builtin ToolIds', () => {
        const registry = createCoreToolRegistry();
        expect(registry.id).toBe(WORKSPACE_TOOL_REGISTRY_ID);
        expect(registry.list().map(tool => tool.id)).toEqual([
            TOOL_IDS.NODE_EXPLORER,
            TOOL_IDS.INSPECTOR,
            TOOL_IDS.ASSETS,
            TOOL_IDS.STAGE,
            TOOL_IDS.LEGACY_SPRITES,
            TOOL_IDS.EXTENSION_MANAGER,
            TOOL_IDS.AGENT,
            TOOL_IDS.TODO,
            TOOL_IDS.PAINT,
            TOOL_IDS.EDITOR
        ]);
        expect(Object.isFrozen(registry.list())).toBe(true);
    });

    test('keeps stable existing WindowIds while lifting them into definitions', () => {
        const registry = createCoreToolRegistry();
        expect(registry.require(TOOL_IDS.NODE_EXPLORER).window.id).toBe(WINDOW_IDS.NODE_EXPLORER);
        expect(registry.require(TOOL_IDS.INSPECTOR).window.id).toBe(WINDOW_IDS.INSPECTOR);
        expect(registry.require(TOOL_IDS.ASSETS).window.id).toBe(WINDOW_IDS.ASSETS);
        expect(registry.require(TOOL_IDS.STAGE).window.id).toBe(WINDOW_IDS.STAGE);
        expect(registry.require(TOOL_IDS.LEGACY_SPRITES).window.id).toBe(WINDOW_IDS.LEGACY_SPRITES);
        expect(registry.require(TOOL_IDS.EXTENSION_MANAGER).window.id).toBe(WINDOW_IDS.EXTENSION_MANAGER);
        expect(registry.require(TOOL_IDS.AGENT).window.id).toBe(WINDOW_IDS.AGENT);
        expect(registry.require(TOOL_IDS.TODO).window.id).toBe(WINDOW_IDS.TODO);
        expect(registry.require(TOOL_IDS.PAINT).window.id).toBe(WINDOW_IDS.PAINT);
        expect(registry.require(TOOL_IDS.EDITOR).window.idPrefix).toBe(WINDOW_IDS.EDITOR_PREFIX);
    });

    test('marks Node Explorer primary and Legacy Sprites compatibility-only', () => {
        const registry = createCoreToolRegistry();
        const nodeExplorer = registry.require(TOOL_IDS.NODE_EXPLORER);
        const legacySprites = registry.require(TOOL_IDS.LEGACY_SPRITES);
        expect(nodeExplorer.window.role).toBe('primary');
        expect(legacySprites.window.role).toBe('compatibility');
        expect(legacySprites.window.defaultVisible).toBe(false);
        expect(legacySprites.compatibility).toEqual({
            uiId: 'scratch-target-pane',
            authority: 'scratch.compatibility'
        });
        expect(nodeExplorer.source).toEqual({kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'});
        expect(legacySprites.source).toEqual({
            kind: TOOL_SOURCE_KINDS.COMPATIBILITY,
            providerId: 'scratch.compatibility'
        });
    });

    test('fails closed on duplicate or unstable tool identities', () => {
        const registry = new ToolRegistry();
        registry.register(makeDefinition('ngvge.tool.test'));
        expect(() => registry.register(makeDefinition('ngvge.tool.test'))).toThrow(/already registered/);
        expect(() => registry.register(makeDefinition('scratch.target-pane'))).toThrow(/stable ngvge\.tool/);
    });

    test('publishes registry events so dynamic plugin ToolDefinitions can be projected by Workspace consumers', () => {
        const registry = createCoreToolRegistry();
        const events = [];
        const unsubscribe = registry.subscribe(event => events.push(event));
        registry.register(makeDefinition('ngvge.tool.dynamic-test'));
        expect(events[0]).toMatchObject({type: 'tool:registered', toolId: 'ngvge.tool.dynamic-test'});
        expect(registry.unregister('ngvge.tool.dynamic-test')).toBe(true);
        expect(events[1]).toMatchObject({type: 'tool:unregistered', toolId: 'ngvge.tool.dynamic-test'});
        unsubscribe();
    });

});
