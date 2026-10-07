'use strict';

const {EventEmitter} = require('events');
const VM = require('scratch-vm');
const twgl = require('twgl.js');

const {FUNCTIONAL_NODE_ARCHETYPE_IDS} = require('../../src/core/functional-node');
const {TILEMAP_LAYER2D_TYPE_ID} = require('../../src/core/tilemap-layer2d');
const {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../../src/lib/first-party-modules');
const {materializePortableCapabilityValue} = require('../../src/lib/first-party-modules/materialize-portable-capability-value');
const {createVMProjectIOService} = require('../../src/lib/first-party-modules/vm-project-io-service');
const {createPortableProjectPayload, encodeBase64Bytes, toUint8Array} = require('../../src/lib/first-party-modules/portable-project-files');
const {FUNCTIONAL_NODE_CREATION_CAPABILITY_ID} = require('../../src/lib/functional-node');
const {RUNTIME_NODE_COMMAND_CAPABILITY_ID, createRuntimeNodeEditorClient, unwrapRuntimeNodeCommandResultAsync} = require('../../src/lib/runtime-nodes');
const {COLLIDER2D_RUNTIME_CAPABILITY_ID} = require('../../src/lib/collision-system');
const {
    TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
    TILESET_RESOURCE_CAPABILITY_ID
} = require('../../src/lib/tilemap-system');
const {createBlankSceneFiles} = require('../../src/lib/scene-system/blank-scene-project');
const {RUNTIME_NODE_MODEL_CAPABILITY_ID, SCENE_SYSTEM_MODULE_ID} = require('../../src/lib/scene-system/constants');

const createPortablePayloadFromFiles = async files => {
    const records = [];
    for (const name of Object.keys(files).sort()) {
        records.push({data: encodeBase64Bytes(await toUint8Array(files[name], name)), name});
    }
    return createPortableProjectPayload(records);
};

const makeRenderer = () => {
    const renderer = new EventEmitter();
    renderer.exports = {twgl};
    renderer._nativeSize = [480, 360];
    renderer._xLeft = -240; renderer._xRight = 240; renderer._yBottom = -180; renderer._yTop = 180;
    renderer._projection = twgl.m4.ortho(-240, 240, -180, 180, -1, 1);
    renderer.offscreenDrawableCulling = true;
    renderer.setLayerGroupOrdering = jest.fn();
    return renderer;
};

const componentOf = (node, typeId) => node.components.find(component => component.typeId === typeId);

describe('WS-10N7 TileSet Resource + TileMapLayer2D integration', () => {
    test('creates a native TileMap with a global TileSet and projects painted tile collision through the shared Collider runtime', async () => {
        const vm = new VM();
        const projectIO = createVMProjectIOService(vm);
        await projectIO.restorePortableProject(await createPortablePayloadFromFiles(createBlankSceneFiles({stageName: 'Stage'})), {
            emitProjectLoaded: false,
            stopRuntime: false
        });
        vm.attachRenderer(makeRenderer());
        const targetCountBefore = vm.runtime.targets.length;
        const manager = createModuleManager({services: {
            runtime: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm.runtime},
            vm: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm},
            'vm-project-io': {permission: MODULE_PERMISSIONS.RUNTIME, value: projectIO}
        }});
        try {
            registerBuiltInModules(manager);
            manager.initializeAll();
            manager.enableDefaults({silent: true});
            manager.client.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

            const creation = manager.client.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID);
            const model = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const nodeClient = createRuntimeNodeEditorClient(manager.client.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID));
            const tileMapRuntime = manager.client.getCapability(TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID);
            const tileSets = manager.client.getCapability(TILESET_RESOURCE_CAPABILITY_ID);
            const colliderRuntime = manager.client.getCapability(COLLIDER2D_RUNTIME_CAPABILITY_ID);
            const project = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const root = model.getSceneRoot(project.activeSceneId);

            const ids = materializePortableCapabilityValue(creation.listArchetypes({scope: 'scene'})).map(item => item.id);
            expect(ids).toContain(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D);
            expect(ids).not.toContain(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);

            const plan = materializePortableCapabilityValue(creation.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D, {
                name: 'World', sceneId: project.activeSceneId, scope: 'scene'
            }));
            const created = await unwrapRuntimeNodeCommandResultAsync(nodeClient.createNode({
                options: Object.assign({}, plan.options, {parentId: root.id}),
                typeId: plan.runtimeTypeId
            }));
            expect(vm.runtime.targets).toHaveLength(targetCountBefore);
            expect(created.node.components.map(component => component.typeId)).toEqual(['ngvge.transform2d', TILEMAP_LAYER2D_TYPE_ID]);
            const component = componentOf(created.node, TILEMAP_LAYER2D_TYPE_ID);
            expect(component.data.tileSetResourceId).toMatch(/^ngvge:resource:/);
            expect(materializePortableCapabilityValue(tileSets.getTileSet(component.data.tileSetResourceId))).not.toBeNull();

            tileSets.setTileDefinition(component.data.tileSetResourceId, 0, {
                atlas: [0, 0],
                collision: [{id: 'solid', shape: {type: 'rectangle', size: [32, 32]}}],
                customData: {kind: 'ground'},
                navigation: {enabled: true}
            });
            tileMapRuntime.setCell(created.node.id, -1, 0, {tileId: 0});
            tileMapRuntime.setCell(created.node.id, 0, 0, {tileId: 0});
            const layer = materializePortableCapabilityValue(tileMapRuntime.getLayer(created.node.id));
            expect(layer.cells).toHaveLength(2);
            expect(layer.config.chunks.some(chunk => chunk.chunkX === -1)).toBe(true);
            expect(materializePortableCapabilityValue(colliderRuntime.queryPoint([0, 0])).map(hit => hit.nodeId)).toContain(created.node.id);
            expect(materializePortableCapabilityValue(tileMapRuntime.listCollisionProjections())).toHaveLength(2);

            tileMapRuntime.patchPersistentLayer(created.node.id, {navigationEnabled: true});
            expect(materializePortableCapabilityValue(tileMapRuntime.listNavigationProjections())).toHaveLength(2);
        } finally {
            manager.dispose();
        }
    });
});
