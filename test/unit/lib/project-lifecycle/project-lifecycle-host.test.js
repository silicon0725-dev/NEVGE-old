const {
    PROJECT_LIFECYCLE_AUTHORITY_ID,
    PROJECT_LIFECYCLE_DOMAIN_ID,
    PROJECT_LIFECYCLE_HOST_ID,
    PROJECT_LIFECYCLE_PROPERTY,
    installProjectLifecycleHost
} = require('../../../../src/lib/project-lifecycle');

const createFixture = () => {
    const runtime = {};
    const vm = {runtime};
    vm.deserializeProject = jest.fn(async projectJSON => ({projectJSON}));
    vm.loadProject = jest.fn(async input => {
        await vm.deserializeProject({input, targets: []}, null);
        return 'loaded';
    });
    vm.toJSON = jest.fn(() => JSON.stringify({targets: []}));
    vm.serializeAssets = jest.fn(() => [{fileContent: new Uint8Array([1]), fileName: 'a.svg'}]);
    vm.saveProjectSb3DontZip = jest.fn(() => ({
        'project.json': new TextEncoder().encode(vm.toJSON()),
        ...Object.fromEntries(vm.serializeAssets().map(item => [item.fileName, item.fileContent]))
    }));
    vm.saveProjectSb3 = jest.fn(async () => vm.saveProjectSb3DontZip());
    return {runtime, vm};
};

describe('Project Lifecycle Host', () => {
    test('owns the public VM lifecycle facade without exposing VM authority on runtime', async () => {
        const {runtime, vm} = createFixture();
        const rawLoadProject = vm.loadProject;
        const host = installProjectLifecycleHost(vm);

        expect(host.hostId).toBe(PROJECT_LIFECYCLE_HOST_ID);
        expect(vm[PROJECT_LIFECYCLE_PROPERTY]).toBe(host);
        expect(vm.loadProject).not.toBe(rawLoadProject);
        expect(runtime[PROJECT_LIFECYCLE_PROPERTY]).toEqual(expect.objectContaining({
            hostId: PROJECT_LIFECYCLE_HOST_ID,
            version: 1
        }));
        expect(runtime[PROJECT_LIFECYCLE_PROPERTY].loadProject).toBeUndefined();
        expect(runtime[PROJECT_LIFECYCLE_PROPERTY].vm).toBeUndefined();

        await vm.loadProject('project-data');
        expect(rawLoadProject).toHaveBeenCalledWith('project-data');
        expect(host.getState()).toEqual(expect.objectContaining({
            authority: {
                authorityId: PROJECT_LIFECYCLE_AUTHORITY_ID,
                domain: PROJECT_LIFECYCLE_DOMAIN_ID,
                mode: 'writer'
            },
            phase: 'idle',
            projectGeneration: 1
        }));
    });

    test('preserves one root load transaction across nested deserialize', async () => {
        const {vm} = createFixture();
        const host = installProjectLifecycleHost(vm);
        const calls = [];
        host.registerHook({
            id: 'test.lifecycle-order',
            beforeLoad: context => calls.push(['beforeLoad', context.rootKind, context.nested]),
            beforeDeserialize: context => calls.push(['beforeDeserialize', context.rootKind, context.nested]),
            afterDeserialize: context => calls.push(['afterDeserialize', context.rootKind, context.nested]),
            afterLoad: context => calls.push(['afterLoad', context.rootKind, context.nested])
        });

        await vm.loadProject('nested-project');

        expect(calls).toEqual([
            ['beforeLoad', 'load', false],
            ['beforeDeserialize', 'load', true],
            ['afterDeserialize', 'load', true],
            ['afterLoad', 'load', false]
        ]);
    });

    test('composes project JSON and asset serialization through deterministic hooks', () => {
        const {vm} = createFixture();
        const host = installProjectLifecycleHost(vm);
        host.registerHook({
            id: 'test.json-metadata',
            priority: 10,
            afterSerializeProjectJSON: (context, serialized) => {
                const value = JSON.parse(serialized);
                value.ngvge = {source: context.rootKind};
                return JSON.stringify(value);
            }
        });
        host.registerHook({
            id: 'test.asset-extension',
            priority: 20,
            afterSerializeAssets: (context, descriptors) => descriptors.concat([{
                fileContent: new Uint8Array([2]),
                fileName: context.args[0] ? 'target-extra.bin' : 'project-extra.bin'
            }])
        });

        const files = vm.saveProjectSb3DontZip();
        const projectJSON = JSON.parse(new TextDecoder().decode(files['project.json']));

        expect(projectJSON.ngvge.source).toBe('serialize-files');
        expect(Object.keys(files)).toEqual(expect.arrayContaining([
            'a.svg',
            'project-extra.bin',
            'project.json'
        ]));
    });

    test('fails visibly when an async hook attempts to mutate a synchronous serialization path', () => {
        const {vm} = createFixture();
        const host = installProjectLifecycleHost(vm);
        host.registerHook({
            id: 'test.invalid-async-hook',
            afterSerializeProjectJSON: async (context, serialized) => serialized
        });

        expect(() => vm.toJSON()).toThrow(expect.objectContaining({
            code: 'PROJECT_LIFECYCLE_ASYNC_SYNC_HOOK'
        }));
    });

    test('does not commit a project generation when load fails', async () => {
        const runtime = {};
        const failure = new Error('load failed');
        const vm = {
            loadProject: jest.fn(() => Promise.reject(failure)),
            runtime
        };
        const host = installProjectLifecycleHost(vm);
        const loadError = jest.fn();
        host.registerHook({id: 'test.load-error', loadError});

        await expect(vm.loadProject('bad')).rejects.toBe(failure);
        expect(loadError).toHaveBeenCalledTimes(1);
        expect(host.getState()).toEqual(expect.objectContaining({
            failedOperationCount: 1,
            projectGeneration: 0
        }));
    });
});
