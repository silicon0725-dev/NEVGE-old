'use strict';

const VM = require('scratch-vm');

const {
    PROJECT_LIFECYCLE_AUTHORITY_ID,
    PROJECT_LIFECYCLE_DOMAIN_ID,
    PROJECT_LIFECYCLE_HOST_ID,
    createProjectLifecycleHost,
    installProjectLifecycleHost
} = require('../../../../src/lib/project-lifecycle');
const {createBlankSceneProjectJSON} = require('../../../../src/lib/scene-system/blank-scene-project');

const collectEvents = host => {
    const events = [];
    const unsubscribe = host.subscribe(event => {
        events.push({
            active: event.state.activeOperation ? Object.assign({}, event.state.activeOperation) : null,
            generation: event.state.projectGeneration,
            phase: event.state.phase,
            type: event.type
        });
    });
    return {events, unsubscribe};
};

const findStart = (events, kind, nested) => events.find(event => (
    event.type === 'operation:start' &&
    event.active &&
    event.active.kind === kind &&
    event.active.nested === nested
));

describe('LPL-G1 Project Lifecycle Consolidation Certification', () => {
    test('keeps stable Host and single Writer Authority identities', () => {
        expect(PROJECT_LIFECYCLE_HOST_ID).toBe('ngvge.project-lifecycle-host@1');
        expect(PROJECT_LIFECYCLE_DOMAIN_ID).toBe('ngvge.project.lifecycle');
        expect(PROJECT_LIFECYCLE_AUTHORITY_ID).toBe('authority:ngvge.project-lifecycle-host');
    });

    test('nests real Scratch deserialize under one load root and advances generation once', async () => {
        const vm = new VM();
        const host = installProjectLifecycleHost(vm);
        const observation = collectEvents(host);

        await vm.loadProject(createBlankSceneProjectJSON({stageName: 'LPL-G1 Load'}));
        observation.unsubscribe();

        const root = findStart(observation.events, 'load', false);
        const nested = findStart(observation.events, 'deserialize', true);
        expect(root).toBeTruthy();
        expect(nested).toBeTruthy();
        expect(nested.active.rootId).toBe(root.active.rootId);
        expect(nested.active.rootKind).toBe('load');
        expect(host.getState().projectGeneration).toBe(1);
        expect(host.getState().phase).toBe('idle');
    });

    test('keeps JSON and asset serialization under one real serialize-files root', async () => {
        const vm = new VM();
        const host = installProjectLifecycleHost(vm);
        await vm.loadProject(createBlankSceneProjectJSON({stageName: 'LPL-G1 Files'}));
        const observation = collectEvents(host);

        const files = vm.saveProjectSb3DontZip();
        observation.unsubscribe();

        expect(files['project.json']).toBeTruthy();
        const root = findStart(observation.events, 'serialize-files', false);
        const json = findStart(observation.events, 'serialize-json', true);
        const assets = findStart(observation.events, 'serialize-assets', true);
        expect(root).toBeTruthy();
        expect(json.active.rootId).toBe(root.active.rootId);
        expect(assets.active.rootId).toBe(root.active.rootId);
        expect(host.getState().projectGeneration).toBe(1);
    });

    test('keeps JSON and assets under one real archive root', async () => {
        const vm = new VM();
        const host = installProjectLifecycleHost(vm);
        await vm.loadProject(createBlankSceneProjectJSON({stageName: 'LPL-G1 Archive'}));
        const observation = collectEvents(host);

        const archive = await vm.saveProjectSb3();
        observation.unsubscribe();

        expect(archive).toBeTruthy();
        const root = findStart(observation.events, 'serialize-archive', false);
        const json = findStart(observation.events, 'serialize-json', true);
        const assets = findStart(observation.events, 'serialize-assets', true);
        expect(root).toBeTruthy();
        expect(json.active.rootId).toBe(root.active.rootId);
        expect(assets.active.rootId).toBe(root.active.rootId);
    });

    test('does not advance generation after a failed root load', async () => {
        const host = createProjectLifecycleHost({runtime: {}}, {
            loadProject: async () => {
                const error = new Error('synthetic failure');
                error.code = 'LPL_G1_LOAD_FAILURE';
                throw error;
            }
        });

        await expect(host.loadProject({})).rejects.toMatchObject({code: 'LPL_G1_LOAD_FAILURE'});
        expect(host.getState()).toEqual(expect.objectContaining({
            failedOperationCount: 1,
            phase: 'idle',
            projectGeneration: 0
        }));
        expect(host.getState().lastFailedOperation).toEqual(expect.objectContaining({
            kind: 'load',
            ok: false
        }));
    });

    test('rejects asynchronous hooks from synchronous serialization APIs', () => {
        const host = createProjectLifecycleHost({runtime: {}}, {toJSON: () => '{}'});
        host.registerHook({
            afterSerializeProjectJSON: async value => value,
            id: 'ngvge.lpl-g1.async-sync-hook@1'
        });

        expect(() => host.serializeProjectJSON()).toThrow(expect.objectContaining({
            code: 'PROJECT_LIFECYCLE_ASYNC_SYNC_HOOK'
        }));
        expect(host.getState().phase).toBe('idle');
        expect(host.getState().failedOperationCount).toBe(1);
    });

    test('orders hooks deterministically by priority', () => {
        const host = createProjectLifecycleHost({runtime: {}}, {toJSON: () => '{}'});
        const order = [];
        host.registerHook({
            afterSerializeProjectJSON: (context, value) => {
                order.push('late');
                return value;
            },
            id: 'ngvge.lpl-g1.late@1',
            priority: 20
        });
        host.registerHook({
            afterSerializeProjectJSON: (context, value) => {
                order.push('early');
                return value;
            },
            id: 'ngvge.lpl-g1.early@1',
            priority: 10
        });

        host.serializeProjectJSON();
        expect(order).toEqual(['early', 'late']);
    });

    test('installs idempotently and exposes only diagnostic lifecycle state on runtime', () => {
        const vm = new VM();
        const first = installProjectLifecycleHost(vm);
        const second = installProjectLifecycleHost(vm);

        expect(second).toBe(first);
        expect(vm.runtime.ngvgeProjectLifecycleHost).toEqual(expect.objectContaining({
            hostId: PROJECT_LIFECYCLE_HOST_ID,
            version: 1
        }));
        expect(typeof vm.runtime.ngvgeProjectLifecycleHost.getState).toBe('function');
        expect(vm.runtime.ngvgeProjectLifecycleHost.loadProject).toBeUndefined();
        expect(vm.runtime.ngvgeProjectLifecycleHost.serializeAssets).toBeUndefined();
    });

    test('keeps replaceable backend handles private', () => {
        const calls = [];
        const host = createProjectLifecycleHost({runtime: {}}, {
            serializeAssets: () => {
                calls.push('assets');
                return ['asset'];
            },
            toJSON: () => {
                calls.push('json');
                return '{}';
            }
        });

        expect(host.serializeAssets()).toEqual(['asset']);
        expect(host.serializeProjectJSON()).toBe('{}');
        expect(calls).toEqual(['assets', 'json']);
        expect(host.backend).toBeUndefined();
        expect(host.vm).toBeUndefined();
    });
});
