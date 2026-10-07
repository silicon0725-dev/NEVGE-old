#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    AUTHORITY_MODES,
    PROJECTION_DIRECTIONS,
    createAuthorityRegistry
} = require('../../src/core/authority');
const {validatePersistentDTO} = require('../../src/core/persistent');
const {validateProtocolDTO} = require('../../src/core/protocol');
const {createSchemaRegistry, validateSchemaDescriptor} = require('../../src/core/schema');
const {
    TRANSFORM2D_SCHEMA_DESCRIPTOR,
    TRANSFORM2D_SCHEMA_VERSION,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    TRANSFORM2D_SEMANTIC_PROJECTION_ID,
    TRANSFORM2D_STATE_DOMAIN,
    TRANSFORM2D_TYPE_ID,
    createTransform2DPatchComponentCommand,
    normalizeTransform2D,
    registerTransform2DAuthority,
    registerTransform2DSchema,
    validateTransform2D
} = require('../../src/core/transform2d');

const ROOT = path.resolve(__dirname, '../..');
const transformRoot = path.join(ROOT, 'src/core/transform2d');

assert.strictEqual(TRANSFORM2D_TYPE_ID, 'ngvge.transform2d');
assert.strictEqual(TRANSFORM2D_SCHEMA_VERSION, 1);
assert.strictEqual(validateSchemaDescriptor(TRANSFORM2D_SCHEMA_DESCRIPTOR).valid, true,
    'Transform2D must expose a valid versioned Core Schema descriptor.');

const schemaRegistry = createSchemaRegistry();
registerTransform2DSchema(schemaRegistry);
assert.strictEqual(schemaRegistry.get(TRANSFORM2D_TYPE_ID, 1).version, 1,
    'Transform2D schema version 1 must register in the generic Schema Registry.');

const authorityRegistry = createAuthorityRegistry();
registerTransform2DAuthority(authorityRegistry);
const writer = authorityRegistry.getWriter(TRANSFORM2D_STATE_DOMAIN);
assert(writer, 'Transform2D must have one Writer Authority.');
assert.strictEqual(writer.authorityId, TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    '0009 initial Transform2D Writer must be Scratch Compatibility Authority.');
assert.strictEqual(writer.mode, AUTHORITY_MODES.WRITER);
const projection = authorityRegistry.get(TRANSFORM2D_STATE_DOMAIN, TRANSFORM2D_SEMANTIC_PROJECTION_ID);
assert(projection, 'Transform2D must declare the NGVGE semantic projection.');
assert.strictEqual(projection.mode, AUTHORITY_MODES.PROJECTION);
assert.strictEqual(projection.projectionDirection, PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION,
    '0009 initial projection direction must be Scratch Authority → NGVGE semantic projection.');

const value = normalizeTransform2D({position: [10, -5], rotation: 30, scale: [1.5, 0.75]});
assert.strictEqual(validatePersistentDTO(value).valid, true,
    'Transform2D persistent values must pass the Core Persistent DTO gate.');
assert(Object.isFrozen(value) && Object.isFrozen(value.position) && Object.isFrozen(value.scale),
    'Normalized Transform2D values must be immutable snapshots.');

const leakedTarget = validateTransform2D({
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    targetRuntimeId: 'scratch-target-a'
});
assert.strictEqual(leakedTarget.valid, false, 'Scratch Target identity must not enter Transform2D component data.');

const command = createTransform2DPatchComponentCommand({
    componentId: 'runtime-component:transform:abcdefgh',
    nodeId: 'ngvge:node:abcdefgh',
    patch: {position: [12, 34], rotation: 45}
});
assert.strictEqual(command.type, 'PatchComponent', 'Editor transform mutation must be expressible as PatchComponent.');
assert.strictEqual(validateProtocolDTO(command).valid, true, 'Transform2D PatchComponent must be a portable protocol DTO.');

const sourceFiles = fs.readdirSync(transformRoot)
    .filter(name => name.endsWith('.js'))
    .map(name => path.join(transformRoot, name));
const backendLeakPattern = /scratch-vm|scratch-render|targetRuntimeId|_allDrawables|_allSkins|_drawThese|BitmapSkin|Drawable|WebGLRenderingContext|GPUDevice/;
sourceFiles.forEach(file => {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, backendLeakPattern,
        `Core Transform2D semantic contract must not contain runtime/backend representation leakage: ${path.relative(ROOT, file)}`);
});

process.stdout.write('0009-A Transform2D Semantic Contract Conformance PASS.\n');
