import VM from 'scratch-vm';

import {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} from '../../src/lib/first-party-modules';
import {createVMProjectIOService} from '../../src/lib/first-party-modules/vm-project-io-service';
import {createBlankSceneProjectJSON} from '../../src/lib/scene-system/blank-scene-project';

describe('R8 smoke: application runtime bootstrap', () => {
    test('boots first-party modules and round-trips a minimal Scratch project', async () => {
        const vm = new VM();
        const manager = createModuleManager({
            services: {
                runtime: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm.runtime},
                vm: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm},
                'vm-project-io': {
                    permission: MODULE_PERMISSIONS.RUNTIME,
                    value: createVMProjectIOService(vm)
                }
            }
        });

        registerBuiltInModules(manager);
        expect(() => manager.initializeAll()).not.toThrow();
        expect(() => manager.enableDefaults({silent: true})).not.toThrow();

        await vm.loadProject(createBlankSceneProjectJSON({stageName: 'R8 Stage'}));
        expect(vm.runtime.targets).toHaveLength(1);
        expect(vm.runtime.targets[0].getName()).toBe('Stage');

        const serialized = JSON.parse(vm.toJSON());
        expect(serialized.targets).toHaveLength(1);
        expect(serialized.targets[0].name).toBe('Stage');

        const archive = await vm.saveProjectSb3('arraybuffer');
        expect(archive.byteLength).toBeGreaterThan(100);
    });
});
