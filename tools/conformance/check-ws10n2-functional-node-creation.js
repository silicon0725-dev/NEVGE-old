#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const {
    CREATION_KINDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_CREATION_CONTRACT,
    createFunctionalNodeCreationPlan,
    listCreatableFunctionalNodeArchetypes
} = require('../../src/core/functional-node');
const {TRANSFORM2D_TYPE_ID} = require('../../src/core/transform2d');
const {
    FUNCTIONAL_NODE_CREATION_CAPABILITY_ID,
    createFunctionalNodeCreationService
} = require('../../src/lib/functional-node');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('Functional Node creation contract is archetype-to-runtime-type-plus-components', () => {
    assert.strictEqual(FUNCTIONAL_NODE_CREATION_CONTRACT.creationBoundary, 'archetype-to-runtime-type-plus-components');
    assert.strictEqual(FUNCTIONAL_NODE_CREATION_CONTRACT.archetypeIdentityPersistsOnCreatedNode, false);
});

check('Scratch backend identity is forbidden from the creation plan', () => {
    assert.strictEqual(FUNCTIONAL_NODE_CREATION_CONTRACT.scratchTargetIdentityMayCrossCreationPlan, false);
});

check('Without Scratch compatibility Node2D remains available and later native archetypes may graduate independently', () => {
    const ids = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: false}).map(item => item.id);
    assert.strictEqual(ids[0], FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D);
    assert.strictEqual(ids.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D), false);
});

check('With Scratch compatibility Node2D and Sprite2D remain available while later native archetypes may graduate', () => {
    const ids = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: true}).map(item => item.id);
    assert.strictEqual(ids.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D), true);
    assert.strictEqual(ids.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D), true);
});

check('Later native archetypes may graduate while still-planned archetypes remain hidden', () => {
    const ids = new Set(listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: true}).map(item => item.id));
    assert.strictEqual(ids.has(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D), true);
    assert.strictEqual(ids.has(FUNCTIONAL_NODE_ARCHETYPE_IDS.AUDIO_SOURCE_2D), false);
});

check('Node2D plan provisions certified Transform2D instead of node-property duplicates', () => {
    const plan = createFunctionalNodeCreationPlan(
        FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
        {scratchCompatibilityAvailable: false}
    );
    assert.strictEqual(plan.runtimeTypeId, 'ngvge.node2d');
    assert.strictEqual(plan.creationKind, CREATION_KINDS.NATIVE);
    assert.deepStrictEqual(plan.options.components, [{
        data: {position: [0, 0], rotation: 0, scale: [1, 1]},
        enabled: true,
        schemaVersion: 1,
        typeId: TRANSFORM2D_TYPE_ID
    }]);
});

check('Sprite2D plan targets semantic Sprite runtime type, not a VM target', () => {
    const plan = createFunctionalNodeCreationPlan(
        FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
        {scratchCompatibilityAvailable: true}
    );
    assert.strictEqual(plan.runtimeTypeId, 'ngvge.sprite-node');
    assert.strictEqual(plan.creationKind, CREATION_KINDS.SCRATCH_COMPATIBILITY);
    assert.strictEqual(plan.options.targetRuntimeId, undefined);
});

check('Creation service is published as a stable capability', () => {
    assert.strictEqual(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID, 'ngvge.functional-node-creation');
});

check('Creation service fails closed when a mapped runtime type is absent', () => {
    const service = createFunctionalNodeCreationService({
        runtimeNodeModel: {
            getNodeType: typeId => typeId === 'ngvge.node2d' ? {
                abstract: false,
                allowedScopes: ['scene'],
                id: typeId
            } : null
        },
        scratchSpriteAdapter: {
            getBindingByNodeId: () => null,
            reconcileActiveScene: () => ({})
        }
    });
    assert.deepStrictEqual(service.listArchetypes({scope: 'scene'}).map(item => item.id), [
        FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D
    ]);
});

check('Functional archetype authoring remains scene-scoped', () => {
    const service = createFunctionalNodeCreationService({
        runtimeNodeModel: {
            getNodeType: () => ({abstract: false, allowedScopes: ['scene']})
        }
    });
    assert.deepStrictEqual(service.listArchetypes({scope: 'global'}), []);
});

const sceneModuleSource = read('src/lib/scene-system/module-definition.js');
const lifecycleSource = read('src/lib/scratch-sprite-adapter/scratch-sprite-lifecycle-command-bridge.js');
const explorerSource = read('src/components/project-explorer/project-explorer.jsx');
const inspectorSource = read('src/components/project-inspector/project-inspector.jsx');

check('Scene System declares and publishes the Functional Node creation capability', () => {
    assert.match(sceneModuleSource, /FUNCTIONAL_NODE_CREATION_CAPABILITY_ID/);
    assert.match(sceneModuleSource, /createFunctionalNodeCreationService\(/);
    assert.match(sceneModuleSource, /context\.capabilities\.provide\(\s*FUNCTIONAL_NODE_CREATION_CAPABILITY_ID/);
});

check('Functional creation service is created after Transform2D runtime registration', () => {
    const transformProvide = sceneModuleSource.indexOf('TRANSFORM2D_RUNTIME_CAPABILITY_ID');
    const functionalCreate = sceneModuleSource.indexOf('functionalNodeCreation = createFunctionalNodeCreationService');
    assert(transformProvide >= 0 && functionalCreate > transformProvide);
});

check('Node Explorer consumes functional archetype descriptors', () => {
    assert.match(explorerSource, /functionalNodeCreation\.listArchetypes\(\{scope: createNodeRequest\.scope\}\)/);
    assert.match(explorerSource, /functionalNodeCreation\.createPlan\(nodeTypeId, createOptions\)/);
});

check('Node Explorer suppresses replaced raw core runtime types but retains other runtime/plugin types', () => {
    assert.match(explorerSource, /replacedRuntimeTypeIds/);
    assert.match(explorerSource, /runtimeTypes\s*\.filter\(nodeType => !replacedRuntimeTypeIds\.has\(nodeType\.id\)\)/);
});

check('Node Explorer submits the plan runtime type and semantic component options', () => {
    assert.match(explorerSource, /runtimeTypeId = plan\.runtimeTypeId/);
    assert.match(explorerSource, /createOptions = plan\.options/);
    const planStart = explorerSource.indexOf('const plan = functionalNodeCreation.createPlan');
    const commandStart = explorerSource.indexOf('workspaceNodeCommandClient.createNode', planStart);
    const creationProjection = explorerSource.slice(planStart, commandStart);
    assert.doesNotMatch(creationProjection, /targetRuntimeId|targetId|bindingId/);
});

check('Scratch Sprite lifecycle provisions semantic components only after stable binding reconciliation', () => {
    const reconcileIndex = lifecycleSource.indexOf('reconcileAndResolveBinding(');
    const provisionIndex = lifecycleSource.indexOf('node = provisionSemanticComponents(node, options.components)');
    assert(reconcileIndex >= 0 && provisionIndex > reconcileIndex);
});

check('Scratch Sprite component provisioning goes through Runtime Node Model mutation authority', () => {
    assert.match(lifecycleSource, /model\.addComponent\(current\.id, component/);
    assert.match(lifecycleSource, /assertRuntimeNodeMutationResult/);
});

check('Failed post-target semantic provisioning has an explicit Scratch target rollback path', () => {
    assert.match(lifecycleSource, /cleanupFailedCreatedSprite/);
    assert.match(lifecycleSource, /runtime-node-command-create-sprite-rollback/);
});

check('Native Runtime Inspector exposes XY scale while Scratch-backed nodes retain uniform scale', () => {
    assert.match(inspectorSource, /label="Scale X"/);
    assert.match(inspectorSource, /label="Scale Y"/);
    assert.match(inspectorSource, /selectedRuntimeScratchBinding \? 'Scratch Compatibility' : 'NGVGE Native'/);
});

check('Native Runtime Inspector resolves Scratch ownership from stable semantic NodeId binding', () => {
    assert.match(inspectorSource, /scratchSpriteAdapter\.getBindingByNodeId\(selectedRuntimeNode\.id/);
    assert.doesNotMatch(inspectorSource, /getBindingByTargetRuntimeId\(selectedRuntimeNode/);
});

process.stdout.write(`WS-10N2 Functional Node Creation + Scratch Target Binding Conformance PASS (${checks.length}/${checks.length}).\n`);
