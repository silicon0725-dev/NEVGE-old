#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    SCRATCH_TRANSFORM_PROJECTION_CONTRACT,
    readScratchTargetTransform,
    scratchDirectionToTransformRotation,
    wrapDegrees180
} = require('../../src/lib/scratch-sprite-adapter');

const cases = [];
const run = (name, callback) => {
    callback();
    cases.push(name);
};

run('direction-contract', () => {
    assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.direction, 'Scratch -> NGVGE');
});
run('scratch-right-is-ngvge-zero', () => {
    assert.strictEqual(scratchDirectionToTransformRotation(90), 0);
});
run('scratch-up-is-positive-quarter-turn', () => {
    assert.strictEqual(scratchDirectionToTransformRotation(0), 90);
});
run('angle-wrap-is-canonical', () => {
    assert.strictEqual(wrapDegrees180(270), -90);
    assert.strictEqual(wrapDegrees180(-270), 90);
});
run('uniform-size-projection', () => {
    assert.deepStrictEqual(readScratchTargetTransform({
        direction: 90,
        id: 'target',
        isOriginal: true,
        isStage: false,
        size: 125,
        x: 1,
        y: 2
    }), {position: [1, 2], rotation: 0, scale: [1.25, 1.25]});
});
run('stage-rejected', () => {
    assert.throws(() => readScratchTargetTransform({isStage: true}),
        error => error && error.code === 'SCRATCH_TRANSFORM_TARGET_INVALID');
});
run('non-finite-rejected', () => {
    assert.throws(() => readScratchTargetTransform({
        direction: 90,
        isStage: false,
        size: 100,
        x: Infinity,
        y: 0
    }), error => error && error.code === 'SCRATCH_TRANSFORM_TARGET_NON_FINITE');
});
run('renderer-data-not-projected', () => {
    const result = readScratchTargetTransform({
        direction: 45,
        drawableID: 10,
        isStage: false,
        renderer: {_allDrawables: {}},
        rotationStyle: 'left-right',
        size: 90,
        x: 3,
        y: 4
    });
    assert.deepStrictEqual(Object.keys(result).sort(), ['position', 'rotation', 'scale']);
});
run('high-frequency-persistence-contract', () => {
    assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.highFrequency.runtimeWrite, true);
    assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.highFrequency.persistentWrite, false);
});

process.stdout.write(`0009-C Scratch Transform Projection self-test PASS (${cases.length}/${cases.length}).\n`);
