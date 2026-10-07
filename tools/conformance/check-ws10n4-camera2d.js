#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {EventEmitter} = require('events');
const twgl = require('twgl.js');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const {
    CAMERA2D_CONTRACT,
    CAMERA2D_TYPE_ID,
    normalizeCamera2D
} = require('../../src/core/camera2d');
const {
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('../../src/core/functional-node');
const {
    CAMERA2D_COMMAND_CAPABILITY_ID,
    CAMERA2D_RENDER_ADAPTER_ID,
    CAMERA2D_RUNTIME_CAPABILITY_ID,
    createScratchRenderCamera2DAdapter
} = require('../../src/lib/camera-system');
const {createFunctionalNodeCreationService} = require('../../src/lib/functional-node');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

const coreSource = read('src/core/camera2d/camera2d-contract.js');
const foundationSource = read('src/core/functional-node/functional-node-foundation.js');
const creationSource = read('src/core/functional-node/functional-node-creation.js');
const creationServiceSource = read('src/lib/functional-node/functional-node-creation-service.js');
const runtimeSource = read('src/lib/camera-system/camera2d-runtime-service.js');
const renderSource = read('src/lib/camera-system/scratch-render-camera2d-adapter.js');
const commandSource = read('src/lib/camera-system/camera2d-command-capability.js');
const blocksSource = read('src/lib/camera-system/camera2d-scratch-blocks.js');
const sceneModuleSource = read('src/lib/scene-system/module-definition.js');
const runtimeIntegrationSource = read('src/lib/first-party-modules/runtime-integration.js');
const inspectorSource = read('src/components/project-inspector/project-inspector.jsx');
const architectureDoc = read('docs/architecture/WS-10N4-CAMERA2D.md');
const verificationDoc = read('docs/validation/WS-10N4-CAMERA2D-VERIFICATION.md');

check('Camera2D owns a stable backend-independent native component contract', () => {
    assert.strictEqual(CAMERA2D_CONTRACT.typeId, CAMERA2D_TYPE_ID);
    assert.strictEqual(CAMERA2D_CONTRACT.schemaVersion, 1);
    assert.strictEqual(CAMERA2D_CONTRACT.persistence.nativeProject, '.ne');
    assert.strictEqual(CAMERA2D_CONTRACT.persistence.scratchProjection, 'native-only');
    assert.strictEqual(CAMERA2D_CONTRACT.runtimeAuthority.backendHandlePersistent, false);
});

check('Transform2D remains the sole Camera position/rotation semantic source', () => {
    assert.strictEqual(CAMERA2D_CONTRACT.coordinateSpace.cameraPositionSource, 'Transform2D.position');
    assert.strictEqual(CAMERA2D_CONTRACT.coordinateSpace.cameraRotationSource, 'Transform2D.rotation');
    assert.doesNotMatch(coreSource, /cameraPosition\s*:/);
    assert.doesNotMatch(coreSource, /cameraRotation\s*:/);
});

check('Camera2D P0 data is portable and contains no renderer/backend identity', () => {
    assert.deepStrictEqual(normalizeCamera2D(), {enabled: true, offset: [0, 0], priority: 0, zoom: [1, 1]});
    assert.doesNotMatch(coreSource, /drawableId|targetRuntimeId|rendererHandle/);
});

check('Camera2D archetype is implemented as native Node2D plus Transform2D and Camera2D', () => {
    const camera = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D);
    assert(camera);
    assert.strictEqual(camera.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.strictEqual(camera.baseRuntimeTypeId, 'ngvge.node2d');
    assert.deepStrictEqual(camera.components.map(component => component.typeId), ['ngvge.transform2d', 'ngvge.camera2d']);
    assert.match(foundationSource, /scratchProjectionRole:\s*SCRATCH_PROJECTION_ROLES\.NATIVE_ONLY/);
});

check('Functional creation provisions real Transform2D and Camera2D components', () => {
    assert.match(creationSource, /createCamera2DComponent/);
    assert.match(creationSource, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.CAMERA_2D/);
    assert.match(creationSource, /FUNCTIONAL_COMPONENT_TYPE_IDS\.CAMERA_2D/);
});

check('Functional creation hides Camera2D when the viewport provider is unavailable', () => {
    assert.match(creationServiceSource, /camera2DAvailable/);
    const runtimeNodeModel = {getNodeType: () => ({abstract: false, allowedScopes: ['scene']})};
    const service = createFunctionalNodeCreationService({runtimeNodeModel, scratchSpriteAdapter: null});
    assert.strictEqual(service.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D), null);
});

check('Scene System publishes Camera runtime and command capabilities only after renderer admission', () => {
    assert.match(sceneModuleSource, /CAMERA2D_RUNTIME_CAPABILITY_ID/);
    assert.match(sceneModuleSource, /CAMERA2D_COMMAND_CAPABILITY_ID/);
    assert.match(sceneModuleSource, /vm && vm\.renderer && vm\.renderer\.exports && vm\.renderer\.exports\.twgl/);
    assert.match(sceneModuleSource, /camera2DAvailable:\s*Boolean\(cameraRuntimeService\)/);
});

check('Camera runtime registers one semantic component type and owns active viewport state', () => {
    assert.match(runtimeSource, /COMPONENT_CARDINALITIES\.ONE/);
    assert.match(runtimeSource, /viewportState/);
    assert.match(runtimeSource, /chooseActiveCamera/);
    assert.strictEqual(CAMERA2D_RUNTIME_CAPABILITY_ID, 'ngvge.camera2d-runtime');
});

check('Active camera selection is enabled + highest priority + stable NodeId tie-break', () => {
    assert.match(runtimeSource, /camera\.componentEnabled && camera\.config\.enabled/);
    assert.match(runtimeSource, /b\.config\.priority - a\.config\.priority/);
    assert.match(runtimeSource, /a\.nodeId\.localeCompare\(b\.nodeId\)/);
});

check('Camera runtime refreshes on node, Transform and Scene changes', () => {
    assert.match(runtimeSource, /runtimeNodeModel\.subscribe/);
    assert.match(runtimeSource, /transformRuntimeStore\.subscribe/);
    assert.match(runtimeSource, /sceneRuntime\.subscribe/);
});

check('Runtime Camera mutations stay separate from persistent Camera component mutations', () => {
    assert.match(runtimeSource, /const patchRuntimeCamera/);
    assert.match(runtimeSource, /runtimeConfigs\.set\(nodeId, next\)/);
    assert.match(runtimeSource, /const patchPersistentCamera/);
    assert.match(runtimeSource, /runtimeNodeModel\.setComponentData/);
});

check('Scratch run boundaries restore authored Camera and native Camera Transform runtime state', () => {
    assert.match(runtimeSource, /PROJECT_START/);
    assert.match(runtimeSource, /PROJECT_STOP_ALL/);
    assert.match(runtimeSource, /hydrateNodeFromPersistent/);
});

check('World/screen coordinate transforms exist as reversible runtime service operations', () => {
    assert.match(runtimeSource, /const worldToScreen/);
    assert.match(runtimeSource, /const screenToWorld/);
});

check('Camera editor persistence crosses a dedicated semantic command capability', () => {
    assert.strictEqual(CAMERA2D_COMMAND_CAPABILITY_ID, 'ngvge.camera2d-command');
    assert.match(commandSource, /CAMERA2D_PATCH_COMMAND_TYPE/);
    assert.match(commandSource, /patchPersistentCamera/);
    assert.doesNotMatch(inspectorSource, /vm\.renderer\._projection/);
});

check('Scratch renderer adapter changes projection, not Drawable transforms', () => {
    assert.strictEqual(CAMERA2D_RENDER_ADAPTER_ID, 'ngvge.scratch-render.camera2d-adapter');
    assert.match(renderSource, /renderer\._projection = buildProjection/);
    assert.doesNotMatch(renderSource, /Drawable\.prototype|updateDrawablePosition|updateDrawableDirection|updateDrawableScale/);
});

check('Explicit Camera disables native stage culling and baseline view restores it', () => {
    assert.match(renderSource, /renderer\.offscreenDrawableCulling = activeState && activeState\.activeCameraNodeId \? false : originalCulling/);
    const renderer = new EventEmitter();
    renderer.exports = {twgl};
    renderer._nativeSize = [480, 360];
    renderer._xLeft = -240;
    renderer._xRight = 240;
    renderer._yBottom = -180;
    renderer._yTop = 180;
    renderer.offscreenDrawableCulling = true;
    const adapter = createScratchRenderCamera2DAdapter(renderer);
    adapter.applyViewport({activeCameraNodeId: 'camera', offset: [0, 0], position: [10, 0], rotation: 0, zoom: [2, 2]});
    assert.strictEqual(renderer.offscreenDrawableCulling, false);
    adapter.applyViewport({activeCameraNodeId: null, offset: [0, 0], position: [0, 0], rotation: 0, zoom: [1, 1]});
    assert.strictEqual(renderer.offscreenDrawableCulling, true);
    adapter.dispose();
});

check('Scratch Camera blocks use runtime capabilities instead of persistence authority', () => {
    assert.match(blocksSource, /patchRuntimeTransform/);
    assert.match(blocksSource, /patchRuntimeCamera/);
    assert.doesNotMatch(blocksSource, /patchPersistentCamera|setComponentData/);
    assert.match(blocksSource, /mouse world x/);
    assert.match(blocksSource, /mouse world y/);
});

check('Raw VM owns Scratch internal-extension registration outside the portable module service facade', () => {
    assert.match(runtimeIntegrationSource, /installCamera2DScratchBlocks\(vm\)/);
    assert.doesNotMatch(sceneModuleSource, /installCamera2DScratchBlocks/);
});

check('Inspector exposes Camera2D through Camera semantic capabilities', () => {
    assert.match(inspectorSource, /CAMERA2D_RUNTIME_CAPABILITY_ID/);
    assert.match(inspectorSource, /CAMERA2D_COMMAND_CAPABILITY_ID/);
    assert.match(inspectorSource, /id="runtime-node:camera2d"/);
    assert.match(inspectorSource, /label="Zoom X"/);
    assert.match(inspectorSource, /label="Zoom Y"/);
    assert.match(inspectorSource, /label="Priority"/);
});

check('N4 does not fake deferred follow/smoothing/limits authoring fields', () => {
    assert.doesNotMatch(coreSource, /followTarget|smoothing|limitLeft|limitRight|limitTop|limitBottom/);
    assert.match(architectureDoc, /intentionally defers follow-target binding, smoothing and camera limits/);
});

check('Architecture documentation preserves backend isolation and Scratch baseline behavior', () => {
    assert.match(architectureDoc, /projection rather than mutating each Drawable/);
    assert.match(architectureDoc, /When no explicit Camera2D is active/);
    assert.match(architectureDoc, /\.sb3/);
});

check('Browser verification explicitly includes native Scratch picking/dragging under camera transforms', () => {
    assert.match(verificationDoc, /click\/drag\/picking/);
    assert.match(verificationDoc, /translated, zoomed and rotated Camera2D/);
    assert.match(verificationDoc, /FROZEN \/ MACHINE VERIFIED \/ BROWSER VERIFIED/);
});

process.stdout.write(`WS-10N4 Camera2D Conformance PASS (${checks.length}/${checks.length}).\n`);
