'use strict';

const VM = require('scratch-vm');

const {installGlobalAssetDatabase} = require('../../src/lib/project-assets/global-asset-database');
const {installProjectPersistence} = require('../../src/lib/project-inspector/project-persistence');
const {installProjectLifecycleHost} = require('../../src/lib/project-lifecycle');
const {installNodeDatabase} = require('../../src/lib/project-nodes/node-database');
const {createBlankSceneProjectJSON} = require('../../src/lib/scene-system/blank-scene-project');

describe('LPL-1 Project Lifecycle Host integration', () => {
    test('real Scratch VM load and serialization converge through one Host pipeline', async () => {
        const vm = new VM();
        const host = installProjectLifecycleHost(vm);
        installGlobalAssetDatabase(vm);
        installNodeDatabase(vm);
        installProjectPersistence(vm);

        const events = [];
        const unsubscribe = host.subscribe(event => events.push(event.type));

        await vm.loadProject(createBlankSceneProjectJSON({stageName: 'LPL Stage'}));
        expect(vm.runtime.targets).toHaveLength(1);
        expect(vm.runtime.targets[0].getName()).toBe('Stage');
        expect(host.getState().projectGeneration).toBe(1);

        const projectJSON = JSON.parse(vm.toJSON());
        expect(projectJSON.targets).toHaveLength(1);
        expect(projectJSON.ngvge).toBeTruthy();

        const files = vm.saveProjectSb3DontZip();
        expect(files['project.json']).toBeTruthy();
        expect(host.getState().phase).toBe('idle');
        expect(events.filter(type => type === 'operation:start').length).toBeGreaterThanOrEqual(5);
        expect(events.filter(type => type === 'operation:error')).toHaveLength(0);

        unsubscribe();
    });
});
