#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const {
    TRANSFORM2D_NATIVE_AUTHORITY_ID,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    TRANSFORM2D_AUTHORITY_REGISTRATIONS
} = require('../../src/core/transform2d');
const {
    NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT,
    TRANSFORM2D_WRITER_ROUTING_CONTRACT
} = require('../../src/lib/transform-system');
const {TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT} = require('../../src/lib/scene-system/transform2d-writer-route-resolver');
const {FUNCTIONAL_NODE_FOUNDATION} = require('../../src/core/functional-node');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('Native Transform Writer has a stable semantic authority identity', () => {
    assert.strictEqual(TRANSFORM2D_NATIVE_AUTHORITY_ID, 'ngvge.native.transform');
});

check('Frozen global Transform2D Authority Registry remains single-writer Scratch baseline', () => {
    const writers = TRANSFORM2D_AUTHORITY_REGISTRATIONS.filter(item => item.mode === 'writer');
    assert.strictEqual(writers.length, 1);
    assert.strictEqual(writers[0].authorityId, TRANSFORM2D_SCRATCH_AUTHORITY_ID);
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.nativeTransformWriterRequirement.currentGlobalAuthorityRegistryUnchanged, true);
});

check('Writer routing scope is semantic NodeId', () => {
    assert.strictEqual(TRANSFORM2D_WRITER_ROUTING_CONTRACT.scope, 'node');
    assert.strictEqual(TRANSFORM2D_WRITER_ROUTING_CONTRACT.identity.nodeIdIsRoutingKey, true);
    assert.strictEqual(TRANSFORM2D_WRITER_ROUTING_CONTRACT.identity.backendHandleDeterminesRoute, false);
    assert.strictEqual(TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT.identity.targetRuntimeIdIsRoutingKey, false);
});

check('Scratch ownership survives missing/offline runtime Target state', () => {
    assert.strictEqual(TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT.ownership.runtimeDisconnectChangesOwnership, false);
    assert.strictEqual(TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT.ownership.missingScratchRuntimeTargetFallsBackToNative, false);
});

check('Callers cannot select Transform writer authority', () => {
    assert.strictEqual(TRANSFORM2D_WRITER_ROUTING_CONTRACT.resolverBoundary.callerMaySelectAuthority, false);
});

check('Native bridge commits through Transform Runtime Store and persistent component boundary', () => {
    assert.strictEqual(NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT.persistence.editorIntentCommitsPersistentTransform, true);
    assert.strictEqual(
        NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT.persistence.projectPersistenceUsesRuntimeNodeModelMutationBoundary,
        true
    );
});

check('Native bridge requires no Scratch Target representation', () => {
    assert.strictEqual(NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT.representationBoundary.scratchTargetRequired, false);
    assert.strictEqual(NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT.representationBoundary.backendHandleEscapesResult, false);
});

const nativeSource = read('src/lib/transform-system/transform2d-native-command-bridge.js');
const routerSource = read('src/lib/transform-system/transform2d-writer-router.js');
const routeResolverSource = read('src/lib/scene-system/transform2d-writer-route-resolver.js');
const sceneSource = read('src/lib/scene-system/module-definition.js');
const commandCapabilitySource = read('src/lib/transform-system/transform2d-command-capability.js');

check('Native bridge has no Scratch/renderer/private backend dependency', () => {
    assert.doesNotMatch(nativeSource, /scratch-sprite-adapter|scratch-vm|scratch-render|targetRuntimeId|_allDrawables|_allSkins|_drawThese|WebGLRenderingContext|GPUDevice/);
});

check('Native bridge writes Runtime state then explicit Persistent state', () => {
    assert.match(nativeSource, /patchRuntimeTransform\(nodeId, patch\)/);
    assert.match(nativeSource, /commitRuntimeToPersistent\(nodeId/);
});

check('Native bridge validates exact Transform component identity', () => {
    assert.match(nativeSource, /component\.id !== componentId/);
    assert.match(nativeSource, /NATIVE_TRANSFORM_COMMAND_COMPONENT_MISMATCH/);
});

check('Writer Router classifies by stable Node binding rather than volatile Target identity', () => {
    assert.match(routeResolverSource, /getBindingByNodeId\(normalizedNodeId\)/);
    assert.doesNotMatch(routeResolverSource, /getBindingByTargetRuntimeId/);
});

check('Writer Router keeps any Scratch binding record on compatibility writer', () => {
    assert.match(routeResolverSource, /if \(binding\)/);
    assert.match(routeResolverSource, /scratch-binding-owned/);
});

check('Writer Router sends unbound nodes to Native writer', () => {
    assert.match(routeResolverSource, /native-unbound-node/);
    assert.match(routerSource, /writerMap\[route\.authorityId\]\.executeCommand/);
});

check('Scene System publishes semantic Transform capability over the Writer Router', () => {
    assert.match(sceneSource, /createNativeTransformCommandBridge\(/);
    assert.match(sceneSource, /createTransform2DSceneWriterRouteResolver\(scratchSpriteAdapter\)/);
    assert.match(sceneSource, /createTransform2DWriterRouter\(/);
    assert.match(sceneSource, /createTransform2DCommandCapability\(transformWriterRouter\)/);
});

check('Scene System disposes Router and Native bridge before Transform store', () => {
    const routerDispose = sceneSource.indexOf('if (transformWriterRouter) transformWriterRouter.dispose()');
    const nativeDispose = sceneSource.indexOf('if (nativeTransformCommandBridge) nativeTransformCommandBridge.dispose()');
    const storeDispose = sceneSource.indexOf('if (transformRuntimeStore) transformRuntimeStore.dispose()');
    assert(routerDispose >= 0 && nativeDispose >= 0 && storeDispose >= 0);
    assert(routerDispose < storeDispose);
    assert(nativeDispose < storeDispose);
});

check('Editor-facing Transform capability remains backend-independent', () => {
    assert.doesNotMatch(commandCapabilitySource, /scratch-vm|scratch-render|setXY\(|setDirection\(|setSize\(|patchRuntimeTransform\(/);
});

check('Native authority is not silently added as a second global Authority Registry writer', () => {
    const contractSource = read('src/core/transform2d/transform2d-contract.js');
    const registrationBlock = contractSource.slice(
        contractSource.indexOf('const TRANSFORM2D_AUTHORITY_REGISTRATIONS'),
        contractSource.indexOf('class Transform2DValidationError')
    );
    assert.doesNotMatch(registrationBlock, /TRANSFORM2D_NATIVE_AUTHORITY_ID/);
});

process.stdout.write(`WS-10N1 Node-scoped Transform Writer Routing Conformance PASS (${checks.length}/${checks.length}).\n`);
