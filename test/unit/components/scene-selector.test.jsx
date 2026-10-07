import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import SceneSelector from '../../../src/components/scene-selector/scene-selector.jsx';
import VM from 'scratch-vm';

import {createModuleManager} from '../../../src/lib/first-party-modules/module-manager';
import {registerBuiltInModules} from '../../../src/lib/first-party-modules/built-in-modules';
import {MODULE_AVAILABILITY, MODULE_KINDS, MODULE_PERMISSIONS} from '../../../src/lib/first-party-modules/constants';
import {createVMProjectIOService} from '../../../src/lib/first-party-modules/vm-project-io-service';
import {
    createPortableProjectPayload,
    encodeBase64Bytes,
    toUint8Array
} from '../../../src/lib/first-party-modules/portable-project-files';
import {createBlankSceneFiles} from '../../../src/lib/scene-system/blank-scene-project';
import {
    SCENE_CONTROLLER_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} from '../../../src/lib/scene-system/constants';

const originalDocument = global.document;

beforeAll(() => {
    global.document = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    };
});

afterAll(() => {
    if (typeof originalDocument === 'undefined') delete global.document;
    else global.document = originalDocument;
});

const makeProject = () => ({
    activeSceneId: 'scene-1',
    extensionData: {},
    schemaVersion: 1,
    startupSceneId: 'scene-1',
    scenes: [
        {id: 'scene-1', metadata: {}, name: 'Menu', snapshot: {byteLength: 10}, variables: []},
        {id: 'scene-2', metadata: {}, name: 'Battle', snapshot: {byteLength: 10}, variables: []}
    ]
});

const toView = project => ({
    activeSceneId: project.activeSceneId,
    busy: false,
    error: null,
    loadedSceneId: project.activeSceneId,
    operation: null,
    revision: 1,
    scenes: project.scenes.map((scene, index) => ({
        hasSnapshot: Boolean(scene.snapshot),
        id: scene.id,
        index,
        isActive: project.activeSceneId === scene.id,
        isStartup: project.startupSceneId === scene.id,
        metadata: {},
        name: scene.name,
        snapshotByteLength: scene.snapshot ? scene.snapshot.byteLength || 0 : 0
    })),
    startupSceneId: project.startupSceneId
});

const createHarness = () => {
    let project = makeProject();
    const listeners = new Set();
    const emit = () => listeners.forEach(listener => listener({
        change: {moduleId: SCENE_SYSTEM_MODULE_ID},
        moduleId: SCENE_SYSTEM_MODULE_ID,
        type: 'module-data'
    }));
    const execute = jest.fn(async (command, optionsJSON) => {
        const options = JSON.parse(optionsJSON || '{}');
        if (command === 'create-and-load') {
            const scene = {id: 'scene-3', metadata: {}, name: 'Scene 3', snapshot: {byteLength: 10}, variables: []};
            project.scenes.push(scene);
            project.activeSceneId = scene.id;
            emit();
            return JSON.stringify(scene);
        }
        if (command === 'enter' || command === 'load') {
            project.activeSceneId = options.sceneId;
            emit();
            return JSON.stringify({activeSceneId: options.sceneId, loadedSceneId: options.sceneId});
        }
        if (command === 'rename') {
            project.scenes.find(scene => scene.id === options.sceneId).name = options.name;
            emit();
            return JSON.stringify({id: options.sceneId, name: options.name});
        }
        if (command === 'set-startup') {
            project.startupSceneId = options.sceneId;
            emit();
            return JSON.stringify({id: options.sceneId});
        }
        if (command === 'move') {
            const sourceIndex = project.scenes.findIndex(scene => scene.id === options.sceneId);
            const [scene] = project.scenes.splice(sourceIndex, 1);
            project.scenes.splice(options.index, 0, scene);
            emit();
            return JSON.stringify(scene);
        }
        if (command === 'delete') {
            project.scenes = project.scenes.filter(scene => scene.id !== options.sceneId);
            if (!project.scenes.some(scene => scene.id === project.activeSceneId)) {
                project.activeSceneId = project.scenes[0].id;
            }
            emit();
            return JSON.stringify({activeSceneId: project.activeSceneId});
        }
        if (command === 'duplicate-and-load') {
            const source = project.scenes.find(scene => scene.id === options.sceneId);
            const scene = {...source, id: 'scene-copy', name: `${source.name} Copy`};
            project.scenes.push(scene);
            project.activeSceneId = scene.id;
            emit();
            return JSON.stringify(scene);
        }
        return 'null';
    });
    const controller = {
        execute,
        getViewStateJSON: () => JSON.stringify(toView(project))
    };
    const moduleManager = {
        getCapability: id => id === SCENE_CONTROLLER_CAPABILITY_ID ? controller : null,
        getModuleData: () => JSON.parse(JSON.stringify(project)),
        getModuleState: () => ({enabled: true}),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
    return {
        controller,
        vm: {runtime: {ngvgeFirstPartyModules: moduleManager}}
    };
};

const createFacadeHarness = () => {
    const moduleManager = createModuleManager();
    moduleManager.registerModule({
        manifest: {
            apiVersion: '1',
            availability: MODULE_AVAILABILITY.AVAILABLE,
            capabilities: [SCENE_CONTROLLER_CAPABILITY_ID],
            defaultEnabled: false,
            dependencies: [],
            description: 'Scene selector controller protocol test module.',
            id: SCENE_SYSTEM_MODULE_ID,
            kind: MODULE_KINDS.FIRST_PARTY,
            name: 'Scene System Test',
            permissions: [],
            version: '2'
        },
        hooks: {
            enable: context => {
                context.data.set(makeProject());
                context.capabilities.provide(SCENE_CONTROLLER_CAPABILITY_ID, Object.freeze({
                    execute: async () => 'null',
                    getViewStateJSON: () => JSON.stringify(toView(context.data.get(makeProject())))
                }));
            }
        }
    });
    moduleManager.enableModule(SCENE_SYSTEM_MODULE_ID);
    return {
        moduleManager,
        vm: {runtime: {ngvgeFirstPartyModules: moduleManager.client}}
    };
};


const createRealSceneHarness = async () => {
    const vm = new VM();
    const projectIO = createVMProjectIOService(vm);
    const files = createBlankSceneFiles({stageName: 'Real SceneSelector Stage'});
    const records = [];
    for (const name of Object.keys(files).sort()) {
        const bytes = await toUint8Array(files[name], name);
        records.push({data: encodeBase64Bytes(bytes), name});
    }
    await projectIO.restorePortableProject(createPortableProjectPayload(records), {
        emitProjectLoaded: false,
        stopRuntime: false
    });
    const moduleManager = createModuleManager({
        services: {
            runtime: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm.runtime},
            vm: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm},
            'vm-project-io': {permission: MODULE_PERMISSIONS.RUNTIME, value: projectIO}
        }
    });
    registerBuiltInModules(moduleManager);
    moduleManager.initializeAll();
    moduleManager.enableDefaults({silent: true});
    moduleManager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
    vm.runtime.ngvgeFirstPartyModules = moduleManager.client;
    return {moduleManager, vm};
};

const renderSelector = async harness => {
    let component;
    await act(async () => {
        component = renderer.create(
            <IntlProvider locale="en">
                <SceneSelector vm={harness.vm} />
            </IntlProvider>
        );
    });
    return component;
};

describe('SceneSelector V2 controller protocol', () => {
    test('renders the active scene and opens the scene list from a JSON view snapshot', async () => {
        const harness = createHarness();
        const component = await renderSelector(harness);
        const toggle = component.root.findByProps({'aria-label': 'Open scene selector'});

        expect(JSON.stringify(component.toJSON())).toContain('Menu');
        await act(async () => toggle.props.onClick());
        expect(component.root.findByProps({role: 'dialog'})).toBeDefined();
        expect(JSON.stringify(component.toJSON())).toContain('Battle');
        expect(JSON.stringify(component.toJSON())).toContain('Startup scene');
    });

    test('uses the shared Enter Scene command for top-bar navigation', async () => {
        const harness = createHarness();
        const component = await renderSelector(harness);
        await act(async () => component.root.findByProps({'aria-label': 'Open scene selector'}).props.onClick());

        await act(async () => component.root.findByProps({'aria-label': 'Switch to Battle'}).props.onClick());

        expect(harness.controller.execute).toHaveBeenCalledWith('enter', JSON.stringify({sceneId: 'scene-2'}));
        expect(JSON.stringify(component.toJSON())).toContain('Battle');
    });

    test('creates and loads a scene through one controller command', async () => {
        const harness = createHarness();
        const component = await renderSelector(harness);
        act(() => component.root.findByProps({'aria-label': 'Open scene selector'}).props.onClick());
        const createButton = component.root.findByProps({'aria-label': 'New scene'});

        await act(async () => createButton.props.onClick());

        expect(harness.controller.execute).toHaveBeenCalledWith('create-and-load', '{}');
        expect(JSON.stringify(component.toJSON())).toContain('Scene 3');
    });

    test('recovers from an externally-started scene navigation instead of staying busy forever', async () => {
        jest.useFakeTimers();
        let view = toView(makeProject());
        const listeners = new Set();
        const controller = {
            execute: jest.fn(async () => 'null'),
            getViewStateJSON: jest.fn(() => JSON.stringify(view))
        };
        const moduleManager = {
            getCapability: id => id === SCENE_CONTROLLER_CAPABILITY_ID ? controller : null,
            getModuleState: () => ({enabled: true}),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        };
        const component = await renderSelector({vm: {runtime: {ngvgeFirstPartyModules: moduleManager}}});
        try {
            await act(async () => component.root.findByProps({'aria-label': 'Open scene selector'}).props.onClick());
            view = Object.assign({}, view, {busy: true, operation: 'load'});
            await act(async () => {
                listeners.forEach(listener => listener({moduleId: SCENE_SYSTEM_MODULE_ID, type: 'module-data'}));
                await Promise.resolve();
            });
            expect(component.root.findByProps({'aria-label': 'New scene'}).props.disabled).toBe(true);

            view = Object.assign({}, view, {
                activeSceneId: 'scene-2',
                busy: false,
                loadedSceneId: 'scene-2',
                operation: null,
                scenes: view.scenes.map(scene => Object.assign({}, scene, {isActive: scene.id === 'scene-2'}))
            });
            await act(async () => {
                jest.advanceTimersByTime(40);
                await Promise.resolve();
            });

            expect(component.root.findByProps({'aria-label': 'New scene'}).props.disabled).toBe(false);
            expect(JSON.stringify(component.toJSON())).toContain('Battle');
        } finally {
            act(() => component.unmount());
            jest.useRealTimers();
        }
    });

    test('renders safely through a real capability facade because only JSON strings enter React state', async () => {
        const harness = createFacadeHarness();
        const component = await renderSelector(harness);
        await act(async () => component.root.findByProps({'aria-label': 'Open scene selector'}).props.onClick());
        expect(JSON.stringify(component.toJSON())).toContain('Battle');
    });

    test('does not touch revoked capability objects when the scene module is disabled', async () => {
        const harness = createFacadeHarness();
        const component = await renderSelector(harness);
        await act(async () => {
            harness.moduleManager.disableModule(SCENE_SYSTEM_MODULE_ID);
            await Promise.resolve();
        });
        expect(harness.moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled).toBe(false);
        expect(() => component.toJSON()).not.toThrow();
        expect(component.toJSON()).toBeNull();
        expect(() => act(() => component.unmount())).not.toThrow();
    });

    test('real Scene System creates a scene through the selector and can be disabled while mounted', async () => {
        const harness = await createRealSceneHarness();
        const component = await renderSelector(harness);
        try {
            await act(async () => component.root.findByProps({'aria-label': 'Open scene selector'}).props.onClick());
            const createButton = component.root.findByProps({'aria-label': 'New scene'});
            await act(async () => {
                await createButton.props.onClick();
            });
            expect(JSON.stringify(component.toJSON())).toContain('Scene 2');

            await act(async () => {
                harness.moduleManager.disableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
                await Promise.resolve();
            });
            expect(harness.moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled).toBe(false);
            expect(component.toJSON()).toBeNull();
            expect(() => act(() => component.unmount())).not.toThrow();
        } finally {
            harness.moduleManager.dispose();
        }
    });

});
