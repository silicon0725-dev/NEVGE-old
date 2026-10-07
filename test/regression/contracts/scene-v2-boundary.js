'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const VM = require('scratch-vm');

const {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../../../src/lib/first-party-modules');
const {createVMProjectIOService} = require('../../../src/lib/first-party-modules/vm-project-io-service');
const {
    BLANK_BACKDROP_FILE_NAME,
    BLANK_BACKDROP_SVG,
    createBlankSceneProjectJSON
} = require('../../../src/lib/scene-system/blank-scene-project');
const {
    SCENE_CONTROLLER_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} = require('../../../src/lib/scene-system/constants');

const readSource = relativePath => fs.readFileSync(path.join(__dirname, '..', '..', '..', relativePath), 'utf8');

const assertSceneV2BoundaryContract = async () => {
    const serializerSource = readSource('src/lib/scene-system/scene-snapshot-serializer.js');
    const selectorSource = readSource('src/components/scene-selector/scene-selector.jsx');
    const explorerSource = readSource('src/components/project-explorer/project-explorer.jsx');

    assert.strictEqual(
        serializerSource.includes("require('@turbowarp/jszip')"),
        false,
        'Scene V2 snapshot serializer must not own JSZip; archive/materialization belongs to Host Project I/O.'
    );
    assert.strictEqual(
        selectorSource.includes('SCENE_MANAGER_CAPABILITY_ID'),
        false,
        'SceneSelector must not bind directly to the legacy scene-manager capability.'
    );
    assert.strictEqual(
        selectorSource.includes('SCENE_RUNTIME_CAPABILITY_ID'),
        false,
        'SceneSelector must not bind directly to the legacy scene-runtime capability.'
    );
    assert(
        selectorSource.includes('SCENE_CONTROLLER_CAPABILITY_ID') && selectorSource.includes('getViewStateJSON'),
        'SceneSelector must consume the Scene V2 primitive JSON controller protocol.'
    );
    assert.strictEqual(
        explorerSource.includes('SCENE_RUNTIME_CAPABILITY_ID'),
        false,
        'Project Explorer must not retain the legacy scene-runtime capability.'
    );

    const vm = new VM();
    const projectJSON = createBlankSceneProjectJSON();
    vm.saveProjectSb3DontZip = () => ({
        [BLANK_BACKDROP_FILE_NAME]: new TextEncoder().encode(BLANK_BACKDROP_SVG),
        'project.json': new TextEncoder().encode(JSON.stringify(projectJSON))
    });

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

    try {
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        const controller = manager.client.getCapability(SCENE_CONTROLLER_CAPABILITY_ID);
        assert(controller, 'Scene V2 controller capability must be published when the Scene System is enabled.');

        const initialViewJSON = controller.getViewStateJSON();
        assert.strictEqual(typeof initialViewJSON, 'string', 'Controller view state must cross the boundary as primitive JSON text.');
        const initialView = JSON.parse(initialViewJSON);
        assert(Array.isArray(initialView.scenes));
        assert(initialView.scenes.length >= 1);

        const commandResultJSON = await controller.execute('create', JSON.stringify({name: 'Controller Boundary'}));
        assert.strictEqual(typeof commandResultJSON, 'string', 'Controller command results must cross as primitive JSON text.');
        const created = JSON.parse(commandResultJSON);
        assert(created && typeof created.id === 'string');

        const moduleData = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
        assert(moduleData && Array.isArray(moduleData.scenes), 'Scene UI source data must be available through Host Module Data.');
        assert(moduleData.scenes.some(scene => scene.id === created.id));

        manager.disableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        const disabledState = manager.client.getModuleState(SCENE_SYSTEM_MODULE_ID);
        assert(disabledState && disabledState.enabled === false, 'Scene module must disable without requiring UI-held capability cleanup.');

        return {
            controllerCommandsAreJSON: true,
            controllerViewIsJSON: true,
            legacyUICapabilityBinding: false,
            moduleDataIsUIAuthority: true,
            sceneModuleDisable: true,
            serializerOwnsJSZip: false
        };
    } finally {
        if (manager && typeof manager.dispose === 'function') manager.dispose();
    }
};

module.exports = {
    assertSceneV2BoundaryContract
};
