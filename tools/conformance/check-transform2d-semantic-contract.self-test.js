#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    createAuthorityRegistry
} = require('../../src/core/authority');
const {createSchemaRegistry} = require('../../src/core/schema');
const {
    TRANSFORM2D_VALIDATION_ERROR,
    createTransform2DPatchComponentCommand,
    normalizeTransform2D,
    normalizeTransform2DPatch,
    registerTransform2DAuthority,
    registerTransform2DSchema,
    validateTransform2D
} = require('../../src/core/transform2d');

const cases = [];
const run = (name, callback) => {
    callback();
    cases.push(name);
};

run('default-transform', () => {
    assert.deepStrictEqual(normalizeTransform2D(), {position: [0, 0], rotation: 0, scale: [1, 1]});
});
run('finite-values', () => {
    assert.strictEqual(validateTransform2D({position: [1, 2], rotation: -90, scale: [-1, 2]}).valid, true);
});
run('unknown-field-rejected', () => {
    assert.strictEqual(validateTransform2D({position: [0, 0], rotation: 0, scale: [1, 1], target: {}}).valid, false);
});
run('non-finite-rejected', () => {
    assert.throws(() => normalizeTransform2D({rotation: Infinity}), error => error && error.code === TRANSFORM2D_VALIDATION_ERROR);
});
run('partial-patch', () => {
    assert.deepStrictEqual(normalizeTransform2DPatch({scale: [2, 2]}), {scale: [2, 2]});
});
run('empty-patch-rejected', () => {
    assert.throws(() => normalizeTransform2DPatch({}), error => error && error.code === TRANSFORM2D_VALIDATION_ERROR);
});
run('schema-registration', () => {
    const registry = createSchemaRegistry();
    registerTransform2DSchema(registry);
    assert.strictEqual(registry.get('ngvge.transform2d', 1).version, 1);
});
run('authority-registration', () => {
    const registry = createAuthorityRegistry();
    registerTransform2DAuthority(registry);
    assert.strictEqual(registry.getWriter('Transform2D').authorityId, 'scratch.compat.transform');
});
run('patch-component-command', () => {
    const command = createTransform2DPatchComponentCommand({
        componentId: 'component-transform-abcdefgh',
        nodeId: 'node-transform-abcdefgh',
        patch: {position: [4, 5]}
    });
    assert.strictEqual(command.type, 'PatchComponent');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(command.payload.patch)), {position: [4, 5]});
});

process.stdout.write(`0009-A Transform2D Semantic Contract self-test PASS (${cases.length}/${cases.length}).\n`);
