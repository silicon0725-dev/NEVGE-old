#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {EventEmitter} = require('events');
const {
    AUTHORITY_MODES,
    PROJECTION_DIRECTIONS,
    createAuthorityRegistry
} = require('../../src/core/authority');
const {validatePersistentDTO} = require('../../src/core/persistent');
const {validateProtocolDTO} = require('../../src/core/protocol');
const {createSchemaRegistry} = require('../../src/core/schema');
const {
    TRANSFORM2D_SCHEMA_VERSION,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    TRANSFORM2D_SEMANTIC_PROJECTION_ID,
    TRANSFORM2D_STATE_DOMAIN,
    TRANSFORM2D_TYPE_ID,
    createTransform2DPatchComponentCommand,
    registerTransform2DAuthority,
    registerTransform2DSchema
} = require('../../src/core/transform2d');
const {
    SCRATCH_TRANSFORM_PROJECTION_CONTRACT,
    createScratchSpriteNodeAdapterService,
    createScratchTransformCommandBridge,
    createScratchTransformProjectionService,
    readScratchTargetTransform
} = require('../../src/lib/scratch-sprite-adapter');
const {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} = require('../../src/lib/runtime-nodes');
const {
    TRANSFORM2D_COMMAND_CONTRACT,
    TRANSFORM2D_RUNTIME_CONTRACT,
    createTransform2DCommandCapability,
    createTransform2DEditorClient,
    createTransform2DRuntimeStoreForModel
} = require('../../src/lib/transform-system');

const ROOT = path.resolve(__dirname, '../..');
const clone = value => JSON.parse(JSON.stringify(value));

const REQUIREMENTS = Object.freeze([
    Object.freeze({id: '0009-DOD-01', title: 'Transform2D has a versioned Schema'}),
    Object.freeze({id: '0009-DOD-02', title: 'Transform2D uses stable NodeId'}),
    Object.freeze({id: '0009-DOD-03', title: 'Scratch Target does not enter component records'}),
    Object.freeze({id: '0009-DOD-04', title: 'Authority is Scratch Compatibility Authority'}),
    Object.freeze({id: '0009-DOD-05', title: 'Projection Direction is Scratch -> NGVGE'}),
    Object.freeze({id: '0009-DOD-06', title: 'Editor mutation is expressible as PatchComponent'}),
    Object.freeze({id: '0009-DOD-07', title: 'Persistent DTO passes serialization gate'}),
    Object.freeze({id: '0009-DOD-08', title: 'Scratch Adapter Boundary remains enforceable'}),
    Object.freeze({id: '0009-DOD-09', title: 'No Scratch Renderer private objects enter Transform layers'}),
    Object.freeze({id: '0009-DOD-10', title: 'Future Authority reversal retains a one-way projection seam'}),
    Object.freeze({id: '0009-DOD-11', title: 'Runtime Transform is separated from Persistent Transform'}),
    Object.freeze({id: '0009-DOD-12', title: 'High-frequency Runtime updates do not frame-write project source'})
]);

const assertNoPatternInFiles = (relativeFiles, pattern, messagePrefix) => {
    relativeFiles.forEach(relativeFile => {
        const source = fs.readFileSync(path.join(ROOT, relativeFile), 'utf8');
        assert.doesNotMatch(source, pattern, `${messagePrefix}: ${relativeFile}`);
    });
};

const createFixture = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    let projectWriteCount = 0;
    const listeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: nextProject => {
            projectWriteCount += 1;
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };

    const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    const host = getRuntimeNodeModelHost(runtimeNodeModel);
    const runtime = new EventEmitter();
    const vm = new EventEmitter();
    const target = {
        direction: 90,
        id: 'scratch-target:0009e-certification',
        isOriginal: true,
        isStage: false,
        size: 100,
        sprite: {name: '0009-E Certification Sprite'},
        x: 10,
        y: -20,
        setXY (x, y) {
            this.x = x;
            this.y = y;
        },
        setDirection (direction) {
            this.direction = direction;
        },
        setSize (size) {
            this.size = Math.max(20, size);
        }
    };
    runtime.targets = [
        {id: 'scratch-stage:0009e', isOriginal: true, isStage: true, sprite: {name: 'Stage'}},
        target
    ];
    runtime.getTargetById = id => runtime.targets.find(candidate => candidate && candidate.id === id) || null;
    vm.runtime = runtime;
    const context = {vm};

    const adapter = createScratchSpriteNodeAdapterService(
        context,
        sceneDataModel,
        host.publicCapability,
        {
            bindingIdFactory: () => 'scratch-binding:0009e-certification',
            componentIdFactory: () => 'runtime-component:scratch-binding-0009e-certification',
            nodeIdFactory: () => 'ngvge:node:0009ecertification',
            nodeTypeRegistration: host.typeRegistrationCapability,
            persistenceController: host.persistenceController
        }
    );
    const store = createTransform2DRuntimeStoreForModel(
        host.publicCapability,
        host.typeRegistrationCapability
    );
    const projection = createScratchTransformProjectionService(
        context,
        sceneDataModel,
        host.publicCapability,
        host.typeRegistrationCapability,
        adapter,
        {transformRuntimeStore: store}
    );
    projection.bootstrapActiveScene({reason: '0009-e-certification-bootstrap'});
    const bridge = createScratchTransformCommandBridge(
        context,
        sceneDataModel,
        host.publicCapability,
        adapter,
        projection
    );
    const commandCapability = createTransform2DCommandCapability(bridge);
    const editor = createTransform2DEditorClient(commandCapability);

    return {
        adapter,
        bridge,
        commandCapability,
        editor,
        getProject: () => clone(project),
        getProjectWriteCount: () => projectWriteCount,
        host,
        projection,
        store,
        target
    };
};

const certifyTransform2DDoD = () => {
    const evidence = [];
    const pass = (requirementId, detail) => evidence.push(Object.freeze({detail, requirementId, status: 'PASS'}));

    const schemaRegistry = createSchemaRegistry();
    registerTransform2DSchema(schemaRegistry);
    const schema = schemaRegistry.get(TRANSFORM2D_TYPE_ID, TRANSFORM2D_SCHEMA_VERSION);
    assert(schema, 'Transform2D versioned Schema must be registered.');
    assert.strictEqual(schema.version, TRANSFORM2D_SCHEMA_VERSION);
    assert.strictEqual(schema.typeId, TRANSFORM2D_TYPE_ID);
    pass('0009-DOD-01', `${TRANSFORM2D_TYPE_ID}@${TRANSFORM2D_SCHEMA_VERSION} registered in Schema Registry.`);

    const authorityRegistry = createAuthorityRegistry();
    registerTransform2DAuthority(authorityRegistry);
    const writer = authorityRegistry.getWriter(TRANSFORM2D_STATE_DOMAIN);
    const semanticProjection = authorityRegistry.get(TRANSFORM2D_STATE_DOMAIN, TRANSFORM2D_SEMANTIC_PROJECTION_ID);
    assert(writer);
    assert.strictEqual(writer.authorityId, TRANSFORM2D_SCRATCH_AUTHORITY_ID);
    assert.strictEqual(writer.mode, AUTHORITY_MODES.WRITER);
    pass('0009-DOD-04', 'Transform2D unique Writer is scratch.compat.transform.');
    assert(semanticProjection);
    assert.strictEqual(semanticProjection.mode, AUTHORITY_MODES.PROJECTION);
    assert.strictEqual(semanticProjection.projectionDirection, PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION);
    assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.direction, 'Scratch -> NGVGE');
    pass('0009-DOD-05', 'Authority Registry and Scratch projection contract agree on Scratch -> NGVGE direction.');

    const fixture = createFixture();
    try {
        const bindings = fixture.adapter.listBindings('scene-a');
        assert.strictEqual(bindings.length, 1, 'Certification fixture must expose one Scratch-bound semantic Node.');
        const nodeId = bindings[0].nodeId;
        assert.strictEqual(nodeId, 'ngvge:node:0009ecertification');
        assert.notStrictEqual(nodeId, fixture.target.id);
        const node = fixture.host.publicCapability.getNodeSnapshot(nodeId);
        assert(node);
        assert.strictEqual(node.id, nodeId);
        pass('0009-DOD-02', 'Runtime/Persistent Transform ownership is keyed by stable semantic NodeId, not target.id.');

        const transformComponent = node.components.find(component => component.typeId === TRANSFORM2D_TYPE_ID);
        assert(transformComponent, 'Scratch-bound semantic Node must own Transform2D.');
        assert.strictEqual(transformComponent.schemaVersion, TRANSFORM2D_SCHEMA_VERSION);
        assert.strictEqual(transformComponent.data.targetRuntimeId, undefined);
        assert.strictEqual(transformComponent.data.target, undefined);
        assert.strictEqual(transformComponent.data.drawableId, undefined);
        assert.doesNotMatch(JSON.stringify(transformComponent), /scratch-target:0009e-certification/);
        assert.doesNotMatch(
            JSON.stringify(fixture.host.publicCapability.exportState()),
            /scratch-target:0009e-certification/,
            'Persistent Runtime Node state must not contain volatile Scratch target identity.'
        );
        pass('0009-DOD-03', 'Transform component and exported persistent Runtime Node state contain no Scratch Target identity/object.');

        const command = createTransform2DPatchComponentCommand({
            componentId: transformComponent.id,
            nodeId,
            patch: {position: [25, 40], rotation: 15}
        });
        assert.strictEqual(command.type, 'PatchComponent');
        assert.strictEqual(validateProtocolDTO(command).valid, true);
        assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.editorIntent.commandType, 'PatchComponent');
        assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.editorIntent.directBackendMutation, false);
        pass('0009-DOD-06', 'Editor Transform intent is a portable PatchComponent Engine Command DTO.');

        assert.strictEqual(validatePersistentDTO(transformComponent.data).valid, true);
        assert.strictEqual(validatePersistentDTO(fixture.host.publicCapability.exportState()).valid, true);
        pass('0009-DOD-07', 'Transform component data and exported Runtime Node persistent state pass Persistent DTO validation.');

        assert.strictEqual(TRANSFORM2D_RUNTIME_CONTRACT.ownership.scratchTargetIsOwner, false);
        assert.strictEqual(TRANSFORM2D_RUNTIME_CONTRACT.separation.runtimeStateStoredInComponentData, false);
        assert.strictEqual(TRANSFORM2D_RUNTIME_CONTRACT.separation.runtimeWritesTouchProjectSource, false);
        assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.representationBoundary.scratchTargetStoredInTransform, false);
        pass('0009-DOD-08', 'Scratch representation remains confined to Compatibility Adapter; semantic Transform ownership stays NodeId-based.');

        const coreTransformFiles = fs.readdirSync(path.join(ROOT, 'src/core/transform2d'))
            .filter(name => name.endsWith('.js'))
            .map(name => `src/core/transform2d/${name}`);
        const runtimeTransformFiles = fs.readdirSync(path.join(ROOT, 'src/lib/transform-system'))
            .filter(name => name.endsWith('.js'))
            .map(name => `src/lib/transform-system/${name}`);
        const rendererPrivatePattern = /scratch-render|_allDrawables|_allSkins|_drawThese|BitmapSkin|WebGLRenderingContext|GPUDevice|drawableId/;
        assertNoPatternInFiles(coreTransformFiles.concat(runtimeTransformFiles), rendererPrivatePattern,
            'Backend-independent Transform layers must remain free of Scratch renderer-private representation');
        const projectionSource = fs.readFileSync(
            path.join(ROOT, 'src/lib/scratch-sprite-adapter/scratch-transform-projection-service.js'),
            'utf8'
        );
        assert.doesNotMatch(projectionSource, rendererPrivatePattern,
            'Scratch Transform projection must not depend on renderer-private objects.');
        pass('0009-DOD-09', 'Static boundary scan finds no Scratch renderer-private representation in Transform semantic/runtime/projection layers.');

        assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority.bridgeImplementationReplaceable, true);
        assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority.authorityReversalImplemented, false);
        assert.doesNotMatch(projectionSource, /\.setXY\s*\(|\.setDirection\s*\(|\.setSize\s*\(/,
            'Scratch -> NGVGE projection must remain one-way and must not write back to Scratch.');
        pass('0009-DOD-10', 'Current projection is one-way and the Editor command executor remains a replaceable Authority bridge seam.');

        const persistentBeforeRuntimeBurst = clone(fixture.host.publicCapability.exportState());
        const projectBeforeRuntimeBurst = fixture.getProject();
        const writesBeforeRuntimeBurst = fixture.getProjectWriteCount();
        const persistentTransformBeforeRuntimeBurst = fixture.store.getPersistentTransform(nodeId);
        for (let index = 0; index < 240; index++) {
            fixture.target.x = 100 + (index * 0.5);
            fixture.target.y = -100 - (index * 0.25);
            fixture.target.direction = ((index * 7) % 360) - 180;
            fixture.target.size = 100 + (index % 50);
            fixture.projection.projectActiveScene({reason: '0009-e-high-frequency-certification'});
        }
        assert.deepStrictEqual(fixture.host.publicCapability.exportState(), persistentBeforeRuntimeBurst);
        assert.deepStrictEqual(fixture.getProject(), projectBeforeRuntimeBurst);
        assert.strictEqual(fixture.getProjectWriteCount(), writesBeforeRuntimeBurst);
        assert.deepStrictEqual(fixture.store.getPersistentTransform(nodeId), persistentTransformBeforeRuntimeBurst);
        assert.deepStrictEqual(fixture.store.getRuntimeTransform(nodeId), readScratchTargetTransform(fixture.target));
        assert.strictEqual(fixture.store.isRuntimeDivergedFromPersistent(nodeId), true);
        pass('0009-DOD-11', '240 runtime projections diverge Runtime Transform from Persistent Transform without mutating component data.');
        pass('0009-DOD-12', '240 high-frequency projections perform zero project-source writes and leave persistent export byte-equivalent.');

        const editorResult = fixture.editor.patchComponent({
            componentId: transformComponent.id,
            nodeId,
            patch: {position: [80, -40], rotation: 45, scale: [0.1, 0.1]}
        });
        assert.strictEqual(validateProtocolDTO(editorResult).valid, true);
        assert.strictEqual(editorResult.kind, 'event');
        assert.strictEqual(editorResult.type, 'PatchComponentApplied');
        assert.strictEqual(editorResult.payload.authorityId, TRANSFORM2D_SCRATCH_AUTHORITY_ID);
        assert.deepStrictEqual(clone(fixture.store.getRuntimeTransform(nodeId)), clone(editorResult.payload.transform));
        assert.deepStrictEqual(clone(fixture.store.getPersistentTransform(nodeId)), clone(editorResult.payload.transform));
        assert.strictEqual(fixture.target.size, 20, 'Scratch Authority clamp must remain canonical on explicit Editor commit.');
    } finally {
        fixture.bridge.dispose();
        fixture.projection.dispose();
        fixture.store.dispose();
        fixture.adapter.dispose();
        fixture.host.dispose();
    }

    const evidenceByRequirement = new Map(evidence.map(item => [item.requirementId, item]));
    REQUIREMENTS.forEach(requirement => {
        assert(evidenceByRequirement.has(requirement.id), `Missing 0009 DoD evidence for ${requirement.id}: ${requirement.title}`);
    });
    assert.strictEqual(evidence.length, REQUIREMENTS.length, '0009 DoD certificate must contain exactly twelve PASS items.');

    return Object.freeze({
        requirements: REQUIREMENTS,
        evidence: Object.freeze(evidence.slice()),
        requirementsChecked: REQUIREMENTS.length,
        requirementsPassed: evidence.length,
        schema: 'ngvge-0009-transform-dod-certificate/v1',
        valid: true
    });
};

if (require.main === module) {
    const result = certifyTransform2DDoD();
    process.stdout.write(`0009-E Transform DoD Certification PASS (${result.requirementsPassed}/${result.requirementsChecked}).\n`);
}

module.exports = {
    REQUIREMENTS,
    certifyTransform2DDoD
};
