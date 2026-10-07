import {DockRuntimeModel} from '../../../../src/lib/editor-shell/dock-runtime-model';
import {
    LAUNCHPAD_SECTIONS,
    WORKSPACE_LAUNCHPAD_MODEL_ID,
    LaunchpadModel
} from '../../../../src/lib/editor-shell/launchpad-model';
import {
    TOOL_DEFINITION_SCHEMA_VERSION,
    TOOL_IDS,
    TOOL_SOURCE_KINDS,
    createCoreToolRegistry
} from '../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../../src/lib/editor-shell/window-manager';

const makeExtensionTool = () => ({
    schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
    id: 'ngvge.tool.extension-demo',
    title: 'Extension Demo',
    iconKey: 'extension-demo',
    commandScope: 'project',
    source: {
        kind: TOOL_SOURCE_KINDS.EXTENSION,
        providerId: 'ngvge.extension.demo'
    },
    singleton: true,
    window: {
        id: 'extension-demo-window',
        title: 'Extension Demo',
        role: 'supporting',
        defaultVisible: false,
        defaultPosition: {x: 0, y: 0},
        defaultSize: {width: 320, height: 240},
        minSize: {width: 160, height: 120},
        maxSize: {width: 800, height: 600},
        capabilities: {
            close: true,
            minimize: true,
            maximize: true,
            resize: true,
            persist: true
        }
    }
});

const createHarness = () => {
    const toolRegistry = createCoreToolRegistry();
    const windowManager = new WindowManager();
    const dockRuntimeModel = new DockRuntimeModel({
        toolRegistry,
        windowManager,
        pinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR]
    });
    toolRegistry.list().filter(tool => tool.singleton).forEach(tool => {
        windowManager.registerWindow(createWindowDescriptor(tool), {visible: false});
    });
    const launchpadModel = new LaunchpadModel({toolRegistry, windowManager, dockRuntimeModel});
    return {toolRegistry, windowManager, dockRuntimeModel, launchpadModel};
};

describe('WS-3E Launchpad Model', () => {
    test('projects every ToolRegistry definition without creating a second tool identity', () => {
        const {toolRegistry, launchpadModel} = createHarness();
        const entries = launchpadModel.listEntries();
        expect(launchpadModel.id).toBe(WORKSPACE_LAUNCHPAD_MODEL_ID);
        expect(entries.map(entry => entry.toolId)).toEqual(toolRegistry.list().map(tool => tool.id));
        expect(entries.every(entry => entry.toolId.startsWith('ngvge.tool.'))).toBe(true);
        expect(entries[0]).not.toHaveProperty('windowManager');
        expect(entries[0]).not.toHaveProperty('vm');
        expect(entries[0]).not.toHaveProperty('renderer');
    });

    test('derives pinned from DockRuntimeModel and compatibility from ToolDefinition source metadata', () => {
        const {launchpadModel} = createHarness();
        expect(launchpadModel.listEntries({section: LAUNCHPAD_SECTIONS.PINNED}).map(entry => entry.toolId)).toEqual([
            TOOL_IDS.NODE_EXPLORER,
            TOOL_IDS.INSPECTOR
        ]);
        expect(launchpadModel.listEntries({section: LAUNCHPAD_SECTIONS.COMPATIBILITY}).map(entry => entry.toolId))
            .toEqual([TOOL_IDS.LEGACY_SPRITES]);
        expect(launchpadModel.listEntries({section: LAUNCHPAD_SECTIONS.FIRST_PARTY}).map(entry => entry.toolId))
            .not.toContain(TOOL_IDS.LEGACY_SPRITES);
    });

    test('derives Recent from WindowManager focus history and orders newest first', () => {
        const {windowManager, launchpadModel} = createHarness();
        windowManager.open('project-explorer');
        windowManager.open('project-inspector');
        expect(launchpadModel.listEntries({section: LAUNCHPAD_SECTIONS.RECENT}).map(entry => entry.toolId)).toEqual([
            TOOL_IDS.INSPECTOR,
            TOOL_IDS.NODE_EXPLORER
        ]);
    });

    test('automatically surfaces dynamically registered extension tools through ToolRegistry events', () => {
        const {toolRegistry, launchpadModel} = createHarness();
        const events = [];
        const unsubscribe = launchpadModel.subscribe(event => events.push(event));
        const extensionTool = toolRegistry.register(makeExtensionTool());
        expect(launchpadModel.listEntries({section: LAUNCHPAD_SECTIONS.EXTENSIONS}).map(entry => entry.toolId))
            .toEqual([extensionTool.id]);
        expect(events.some(event => event.type === 'launchpad:tool-registry-changed')).toBe(true);
        unsubscribe();
    });

    test('filters search across title, ToolId, and provider without mutating categories', () => {
        const {toolRegistry, launchpadModel} = createHarness();
        toolRegistry.register(makeExtensionTool());
        expect(launchpadModel.listEntries({query: 'extension demo'}).map(entry => entry.toolId))
            .toEqual(['ngvge.tool.extension-demo']);
        expect(launchpadModel.listEntries({query: 'ngvge.extension.demo'}).map(entry => entry.toolId))
            .toEqual(['ngvge.tool.extension-demo']);
        expect(launchpadModel.listEntries({section: LAUNCHPAD_SECTIONS.COMPATIBILITY, query: 'legacy'}).length).toBe(1);
    });

    test('reacts to pin and focus state changes through its own revision seam', () => {
        const {dockRuntimeModel, windowManager, launchpadModel} = createHarness();
        const startRevision = launchpadModel.revision;
        dockRuntimeModel.pin(TOOL_IDS.ASSETS);
        windowManager.open('asset-manager');
        expect(launchpadModel.revision).toBeGreaterThan(startRevision);
        const assets = launchpadModel.listEntries().find(entry => entry.toolId === TOOL_IDS.ASSETS);
        expect(assets).toMatchObject({pinned: true, running: true, active: true, recent: true});
    });

    test('fails closed on unknown sections and invalid queries', () => {
        const {launchpadModel} = createHarness();
        expect(() => launchpadModel.listEntries({section: 'other'})).toThrow(/Unknown Launchpad section/);
        expect(() => launchpadModel.listEntries({query: {text: 'assets'}})).toThrow(/query must be a string/);
    });
});
