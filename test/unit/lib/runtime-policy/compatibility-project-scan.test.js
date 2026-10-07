'use strict';

const corpus = require('../../../fixtures/runtime-compatibility/lrc4-corpus');
const {
    COMPATIBILITY_PROJECT_SCAN_ID,
    createScratchProjectCompatibilitySnapshot
} = require('../../../../src/lib/runtime-policy');

const createVMFromCorpus = record => {
    const blocks = {};
    record.opcodes.forEach((opcode, index) => {
        blocks[`block-${index}`] = {opcode};
    });
    const loaded = new Map();
    (record.loadedExtensions || []).forEach(extensionId => loaded.set(extensionId, `service.${extensionId}`));
    return {
        runtime: {
            extensionManager: {_loadedExtensions: loaded},
            stageHeight: record.stage ? record.stage.height : 360,
            stageWidth: record.stage ? record.stage.width : 480,
            targets: [{
                blocks: {_blocks: blocks},
                isStage: false
            }]
        }
    };
};

const assertExpected = (snapshot, expected) => {
    if (Object.prototype.hasOwnProperty.call(expected, 'broadcastHeavy')) {
        expect(snapshot.features.broadcastHeavy).toBe(expected.broadcastHeavy);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'cloneHeavy')) {
        expect(snapshot.features.cloneHeavy).toBe(expected.cloneHeavy);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'customStageGeometry')) {
        expect(snapshot.features.customStageGeometry).toBe(expected.customStageGeometry);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'exactTickSensitive')) {
        expect(snapshot.features.exactTickSensitive).toBe(expected.exactTickSensitive);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'highRenderLoad')) {
        expect(snapshot.features.highRenderLoad).toBe(expected.highRenderLoad);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'usesCustomExtensions')) {
        expect(snapshot.features.usesCustomExtensions).toBe(expected.usesCustomExtensions);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'usesPen')) {
        expect(snapshot.features.usesPen).toBe(expected.usesPen);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'usesRendererPrivateExtension')) {
        expect(snapshot.features.usesRendererPrivateExtension).toBe(expected.usesRendererPrivateExtension);
    }
    if (Object.prototype.hasOwnProperty.call(expected, 'usesStamp')) {
        expect(snapshot.features.usesStamp).toBe(expected.usesStamp);
    }
    if (expected.unknownExtensionIds) {
        expect(snapshot.unknownExtensionIds).toEqual(expect.arrayContaining(expected.unknownExtensionIds));
    }
    if (expected.visualDomains) {
        expect(snapshot.visualDomains).toEqual(expect.arrayContaining(expected.visualDomains));
    }
};

describe('LRC-4 Scratch project compatibility scan', () => {
    test('establishes the representative C01-C17 compatibility corpus', () => {
        expect(corpus).toHaveLength(17);
        expect(corpus.map(record => record.id)).toEqual(
            Array.from({length: 17}, (value, index) => `C${String(index + 1).padStart(2, '0')}`)
        );
    });

    test.each(corpus)('$id $title produces the expected static compatibility evidence', record => {
        const snapshot = createScratchProjectCompatibilitySnapshot(createVMFromCorpus(record), {
            extensionDescriptors: record.extensionDescriptors
        });
        expect(snapshot.scannerId).toBe(COMPATIBILITY_PROJECT_SCAN_ID);
        expect(Object.isFrozen(snapshot)).toBe(true);
        assertExpected(snapshot, record.expected);
    });

    test('does not classify normal core opcodes as custom extensions', () => {
        const record = corpus.find(item => item.id === 'C01');
        const snapshot = createScratchProjectCompatibilitySnapshot(createVMFromCorpus(record));
        expect(snapshot.customExtensionIds).toEqual([]);
        expect(snapshot.unknownExtensionIds).toEqual([]);
    });
});
