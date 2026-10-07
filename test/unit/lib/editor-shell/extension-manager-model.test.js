import {
    EXTENSION_MANAGER_ITEM_STATUS,
    WORKSPACE_EXTENSION_MANAGER_MODEL_ID,
    WorkspaceExtensionManagerModel,
    makeManagerItemId
} from '../../../../src/lib/editor-shell/extension-manager-model';
import {EXTENSION_HOST_KINDS} from '../../../../src/lib/extension-containment';

const createEmitter = () => {
    const listeners = new Set();
    return {
        emit: event => listeners.forEach(listener => listener(event)),
        subscribe (listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};

const createFixture = () => {
    const descriptors = new Map();
    const diagnostics = [];
    const containmentClient = {
        getDescriptor: id => descriptors.get(id) || null,
        listDescriptors: () => Array.from(descriptors.values()),
        listDiagnostics: () => diagnostics.slice()
    };
    descriptors.set('ngvge-module:ngvge.scene-system', Object.freeze({
        capabilities: Object.freeze(['scene.manage']),
        compatibility: Object.freeze({legacy: false, quarantine: false}),
        descriptorId: 'ngvge-module:ngvge.scene-system',
        extensionId: 'ngvge.scene-system',
        hostKind: EXTENSION_HOST_KINDS.NGVGE_MODULE,
        permissions: Object.freeze(['project.nodes']),
        source: Object.freeze({kind: 'built-in-module', value: '1.0.0'}),
        trust: Object.freeze({
            effectiveExecutionMode: 'native-host',
            level: 'first-party',
            requestedExecutionMode: 'native-host'
        })
    }));
    descriptors.set('legacy-addon:compact', Object.freeze({
        capabilities: Object.freeze(['legacy-addon.dom']),
        compatibility: Object.freeze({legacy: true, quarantine: true}),
        descriptorId: 'legacy-addon:compact',
        extensionId: 'compact',
        hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON,
        permissions: Object.freeze([]),
        source: Object.freeze({kind: 'bundled-legacy-addon', value: null}),
        trust: Object.freeze({
            effectiveExecutionMode: 'legacy-raw-vm-quarantine',
            level: 'legacy-quarantined',
            requestedExecutionMode: 'legacy-userscript'
        })
    }));

    const moduleEvents = createEmitter();
    let moduleEnabled = true;
    const moduleClient = {
        ...moduleEvents,
        disableModule: jest.fn(() => {
            moduleEnabled = false;
            moduleEvents.emit({type: 'module:disable'});
        }),
        enableModule: jest.fn(() => {
            moduleEnabled = true;
            moduleEvents.emit({type: 'module:enable'});
        }),
        listModules: () => [{
            manifest: {
                availability: 'available',
                capabilities: ['scene.manage'],
                compatibility: {sb3: {level: 'full'}},
                description: 'Scene workflow',
                id: 'ngvge.scene-system',
                name: 'Scene System',
                permissions: ['project.nodes'],
                version: '1.0.0'
            },
            state: {enabled: moduleEnabled}
        }]
    };

    const scratchEvents = createEmitter();
    const loadedScratch = new Set();
    const scratchExtensionHost = {
        ...scratchEvents,
        isExtensionLoaded: id => loadedScratch.has(id),
        listLoadedExtensionIds: () => Array.from(loadedScratch),
        loadBuiltInExtension: jest.fn(id => {
            loadedScratch.add(id);
            scratchEvents.emit({extensionId: id, kind: 'loaded'});
        }),
        loadExtensionURL: jest.fn(async (url, metadata) => {
            loadedScratch.add(metadata.extensionId);
            scratchEvents.emit({extensionId: metadata.extensionId, kind: 'loaded', source: url});
        }),
        synchronizeLoadedExtensions: jest.fn(),
        unloadExtension: jest.fn(id => {
            loadedScratch.delete(id);
            scratchEvents.emit({extensionId: id, kind: 'unloaded'});
        })
    };

    const discoveryEvents = createEmitter();
    const discoveryProvider = {
        ...discoveryEvents,
        list: () => [{
            description: 'Draw with sprites',
            extensionId: 'pen',
            hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
            iconURL: null,
            manifest: {
                compatibility: {ngvge: true, scratch: true},
                legacy: true,
                permissions: [],
                version: '0.0.0-legacy'
            },
            name: 'Pen',
            source: {kind: 'builtin-id', value: 'pen'},
            tags: ['scratch']
        }]
    };

    const legacyEvents = createEmitter();
    let legacyEnabled = false;
    let legacySetting = true;
    const legacyAddonAdapter = {
        ...legacyEvents,
        list: () => [{
            description: 'Compact UI',
            dynamicDisable: true,
            enabled: legacyEnabled,
            extensionId: 'compact',
            installed: true,
            name: 'Compact editor',
            settings: [{
                defaultValue: true,
                id: 'hideLabels',
                name: 'Hide labels',
                potentialValues: [],
                type: 'boolean',
                value: legacySetting
            }],
            tags: ['theme']
        }],
        setEnabled: jest.fn((id, enabled) => {
            legacyEnabled = enabled;
            legacyEvents.emit({addonId: id, type: 'setting-changed'});
        }),
        setSetting: jest.fn((id, settingId, value) => {
            legacySetting = value;
            legacyEvents.emit({addonId: id, settingId, type: 'setting-changed'});
        })
    };

    const model = new WorkspaceExtensionManagerModel({
        containmentClient,
        discoveryProvider,
        legacyAddonAdapter,
        moduleClient,
        scratchExtensionHost
    });
    return {
        containmentClient,
        descriptors,
        discoveryProvider,
        legacyAddonAdapter,
        model,
        moduleClient,
        scratchExtensionHost
    };
};

describe('WorkspaceExtensionManagerModel', () => {
    test('projects three separate runtime hosts into one manager list', () => {
        const fixture = createFixture();
        expect(fixture.model.id).toBe(WORKSPACE_EXTENSION_MANAGER_MODEL_ID);
        expect(fixture.model.listItems().map(item => item.hostKind).sort()).toEqual([
            EXTENSION_HOST_KINDS.LEGACY_ADDON,
            EXTENSION_HOST_KINDS.NGVGE_MODULE,
            EXTENSION_HOST_KINDS.SCRATCH_EXTENSION
        ].sort());
        expect(fixture.model.getItem('ngvge-module:ngvge.scene-system').trust.level).toBe('first-party');
        expect(fixture.model.getItem('legacy-addon:compact').trust.level).toBe('legacy-quarantined');
        fixture.model.dispose();
    });

    test('does not invent effective trust for an uninstalled Scratch discovery entry', () => {
        const fixture = createFixture();
        const pen = fixture.model.getItem('scratch-extension:pen');
        expect(pen.installed).toBe(false);
        expect(pen.trust).toMatchObject({evaluated: false, level: null});
        expect(pen.status).toBe(EXTENSION_MANAGER_ITEM_STATUS.DISABLED);
        fixture.model.dispose();
    });

    test('routes NGVGE Module enable and disable through the Module client', async () => {
        const fixture = createFixture();
        const itemId = makeManagerItemId(EXTENSION_HOST_KINDS.NGVGE_MODULE, 'ngvge.scene-system');
        await fixture.model.setEnabled(itemId, false);
        expect(fixture.moduleClient.disableModule).toHaveBeenCalledWith('ngvge.scene-system');
        expect(fixture.model.getItem(itemId).enabled).toBe(false);
        await fixture.model.setEnabled(itemId, true);
        expect(fixture.moduleClient.enableModule).toHaveBeenCalledWith('ngvge.scene-system');
        fixture.model.dispose();
    });

    test('routes Scratch extension loading through ScratchExtensionHost', async () => {
        const fixture = createFixture();
        const itemId = makeManagerItemId(EXTENSION_HOST_KINDS.SCRATCH_EXTENSION, 'pen');
        await fixture.model.setEnabled(itemId, true);
        expect(fixture.scratchExtensionHost.loadBuiltInExtension).toHaveBeenCalledWith('pen', expect.any(Object));
        expect(fixture.model.getItem(itemId).installed).toBe(true);
        await fixture.model.setEnabled(itemId, false);
        expect(fixture.scratchExtensionHost.unloadExtension).toHaveBeenCalledWith('pen');
        fixture.model.dispose();
    });

    test('routes Legacy Addon enable and settings through the legacy adapter', async () => {
        const fixture = createFixture();
        const itemId = makeManagerItemId(EXTENSION_HOST_KINDS.LEGACY_ADDON, 'compact');
        await fixture.model.setEnabled(itemId, true);
        expect(fixture.legacyAddonAdapter.setEnabled).toHaveBeenCalledWith('compact', true);
        fixture.model.setSetting(itemId, 'hideLabels', false);
        expect(fixture.legacyAddonAdapter.setSetting).toHaveBeenCalledWith('compact', 'hideLabels', false);
        expect(fixture.model.getItem(itemId).settings[0].value).toBe(false);
        fixture.model.dispose();
    });
});
