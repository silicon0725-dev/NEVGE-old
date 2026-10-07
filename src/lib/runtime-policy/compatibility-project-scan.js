/* eslint-disable import/no-commonjs, strict */
'use strict';

const COMPATIBILITY_PROJECT_SCAN_ID = 'ngvge.compatibility-project-scan@1';
const COMPATIBILITY_PROJECT_SNAPSHOT_SCHEMA = 'ngvge.compatibility-project-snapshot/v1';

const VISUAL_DOMAIN_IDS = Object.freeze({
    SCRATCH_PEN: 'scratch.pen',
    SCRATCH_STAMP: 'scratch.stamp',
    SCRATCH_TRANSFORM: 'scratch.sprite.transform'
});

const SCRATCH_STAGE_DEFAULT = Object.freeze({height: 360, width: 480});
const DEFAULT_SCAN_THRESHOLDS = Object.freeze({
    broadcastHeavyBlockCount: 8,
    cloneHeavyBlockCount: 8,
    highRenderLoadBlockCount: 1000,
    highRenderLoadTargetCount: 100
});

const BUILTIN_EXTENSION_IDS = new Set([
    'boost',
    'ev3',
    'makeymakey',
    'microbit',
    'music',
    'pen',
    'text2speech',
    'translate',
    'videoSensing',
    'wedo2'
]);
const CORE_OPCODE_PREFIXES = new Set([
    'argument',
    'control',
    'data',
    'event',
    'looks',
    'motion',
    'operator',
    'procedures',
    'sensing',
    'sound'
]);

const TIMER_SENSITIVE_OPCODES = new Set([
    'control_wait',
    'control_wait_until',
    'event_broadcastandwait',
    'sensing_resettimer',
    'sensing_timer'
]);
const BROADCAST_OPCODES = new Set([
    'event_broadcast',
    'event_broadcastandwait',
    'event_whenbroadcastreceived'
]);
const SCRATCH_TRANSFORM_OPCODES = new Set([
    'looks_changeeffectby',
    'looks_changesizeby',
    'looks_cleargraphiceffects',
    'looks_seteffectto',
    'looks_setsizeto'
]);

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    const result = {};
    Object.keys(value).forEach(key => {
        result[key] = clone(value[key]);
    });
    return result;
};

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
};

const normalizeExtensionDescriptors = descriptors => {
    const result = new Map();
    (Array.isArray(descriptors) ? descriptors : []).forEach(descriptor => {
        if (!descriptor || typeof descriptor.extensionId !== 'string' || !descriptor.extensionId.trim()) return;
        const extensionId = descriptor.extensionId.trim();
        result.set(extensionId, Object.freeze({
            exactTickSensitive: Boolean(descriptor.exactTickSensitive),
            extensionId,
            rendererPrivate: Boolean(descriptor.rendererPrivate),
            visualDomains: Object.freeze(
                Array.isArray(descriptor.visualDomains) ? descriptor.visualDomains.filter(Boolean).slice() : []
            )
        }));
    });
    return result;
};

const getLoadedExtensionIds = runtime => {
    const ids = new Set();
    const loaded = runtime && runtime.extensionManager && runtime.extensionManager._loadedExtensions;
    if (loaded && typeof loaded.forEach === 'function') {
        loaded.forEach((value, key) => {
            if (typeof key === 'string' && key.trim()) ids.add(key.trim());
        });
    }
    return Array.from(ids).sort((a, b) => b.length - a.length);
};

const resolveExtensionId = (opcode, loadedExtensionIds) => {
    if (typeof opcode !== 'string' || !opcode.includes('_')) return null;
    const loadedMatch = loadedExtensionIds.find(extensionId => opcode.startsWith(`${extensionId}_`));
    if (loadedMatch) return loadedMatch;
    const prefix = opcode.slice(0, opcode.indexOf('_'));
    if (CORE_OPCODE_PREFIXES.has(prefix)) return null;
    return prefix || null;
};

const collectTargetBlocks = target => {
    if (!target || !target.blocks || !isPlainObject(target.blocks._blocks)) return [];
    return Object.values(target.blocks._blocks).filter(block => block && typeof block.opcode === 'string');
};

const normalizeRuntime = vmOrRuntime => {
    if (!vmOrRuntime) throw new TypeError('Compatibility project scan requires a Scratch VM or runtime.');
    if (vmOrRuntime.runtime) return vmOrRuntime.runtime;
    return vmOrRuntime;
};

const createScratchProjectCompatibilitySnapshot = (vmOrRuntime, options = {}) => {
    const runtime = normalizeRuntime(vmOrRuntime);
    const thresholds = Object.assign({}, DEFAULT_SCAN_THRESHOLDS, options.thresholds || {});
    const extensionDescriptors = normalizeExtensionDescriptors(options.extensionDescriptors);
    const loadedExtensionIds = getLoadedExtensionIds(runtime);
    const targets = Array.isArray(runtime.targets) ? runtime.targets.filter(Boolean) : [];
    const extensionIds = new Set();
    const customExtensionIds = new Set();
    const rendererPrivateExtensionIds = new Set();
    const visualDomains = new Set();
    const unknownExtensionIds = new Set();
    const opcodes = {};
    let blockCount = 0;
    let broadcastBlockCount = 0;
    let cloneCreateBlockCount = 0;
    let penBlockCount = 0;
    let stampBlockCount = 0;
    let timerSensitiveBlockCount = 0;
    let transformBlockCount = 0;

    targets.forEach(target => {
        collectTargetBlocks(target).forEach(block => {
            const opcode = block.opcode;
            blockCount += 1;
            opcodes[opcode] = (opcodes[opcode] || 0) + 1;

            if (opcode === 'control_create_clone_of') cloneCreateBlockCount += 1;
            if (TIMER_SENSITIVE_OPCODES.has(opcode)) timerSensitiveBlockCount += 1;
            if (BROADCAST_OPCODES.has(opcode)) broadcastBlockCount += 1;
            if (opcode.startsWith('motion_') || SCRATCH_TRANSFORM_OPCODES.has(opcode)) {
                transformBlockCount += 1;
                visualDomains.add(VISUAL_DOMAIN_IDS.SCRATCH_TRANSFORM);
            }
            if (opcode === 'pen_stamp') {
                stampBlockCount += 1;
                visualDomains.add(VISUAL_DOMAIN_IDS.SCRATCH_STAMP);
            } else if (opcode.startsWith('pen_')) {
                penBlockCount += 1;
                visualDomains.add(VISUAL_DOMAIN_IDS.SCRATCH_PEN);
            }

            const extensionId = resolveExtensionId(opcode, loadedExtensionIds);
            if (!extensionId) return;
            extensionIds.add(extensionId);
            if (!BUILTIN_EXTENSION_IDS.has(extensionId)) customExtensionIds.add(extensionId);
            const descriptor = extensionDescriptors.get(extensionId);
            if (!descriptor) {
                if (!BUILTIN_EXTENSION_IDS.has(extensionId)) unknownExtensionIds.add(extensionId);
                return;
            }
            descriptor.visualDomains.forEach(domainId => visualDomains.add(domainId));
            if (descriptor.rendererPrivate) rendererPrivateExtensionIds.add(extensionId);
        });
    });

    const stageWidth = Number.isFinite(runtime.stageWidth) ? runtime.stageWidth : SCRATCH_STAGE_DEFAULT.width;
    const stageHeight = Number.isFinite(runtime.stageHeight) ? runtime.stageHeight : SCRATCH_STAGE_DEFAULT.height;
    const customStageGeometry = (
        stageWidth !== SCRATCH_STAGE_DEFAULT.width ||
        stageHeight !== SCRATCH_STAGE_DEFAULT.height
    );
    const exactTickSensitiveExtension = Array.from(extensionIds).some(extensionId => {
        const descriptor = extensionDescriptors.get(extensionId);
        return descriptor ? descriptor.exactTickSensitive : false;
    });

    return deepFreeze({
        blockCount,
        counts: {
            broadcastBlockCount,
            cloneCreateBlockCount,
            penBlockCount,
            stampBlockCount,
            timerSensitiveBlockCount,
            transformBlockCount
        },
        customExtensionIds: Array.from(customExtensionIds).sort(),
        extensionIds: Array.from(extensionIds).sort(),
        features: {
            broadcastHeavy: broadcastBlockCount >= thresholds.broadcastHeavyBlockCount,
            cloneHeavy: cloneCreateBlockCount >= thresholds.cloneHeavyBlockCount,
            customStageGeometry,
            exactTickSensitive: timerSensitiveBlockCount > 0 || exactTickSensitiveExtension,
            highRenderLoad: blockCount >= thresholds.highRenderLoadBlockCount ||
                targets.length >= thresholds.highRenderLoadTargetCount,
            usesClones: cloneCreateBlockCount > 0,
            usesCustomExtensions: customExtensionIds.size > 0,
            usesPen: penBlockCount > 0,
            usesRendererPrivateExtension: rendererPrivateExtensionIds.size > 0,
            usesStamp: stampBlockCount > 0,
            usesTimerSensitiveLogic: timerSensitiveBlockCount > 0
        },
        opcodes: clone(opcodes),
        rendererPrivateExtensionIds: Array.from(rendererPrivateExtensionIds).sort(),
        scannerId: COMPATIBILITY_PROJECT_SCAN_ID,
        schema: COMPATIBILITY_PROJECT_SNAPSHOT_SCHEMA,
        stage: {height: stageHeight, width: stageWidth},
        targetCount: targets.length,
        unknownExtensionIds: Array.from(unknownExtensionIds).sort(),
        visualDomains: Array.from(visualDomains).sort()
    });
};

module.exports = {
    COMPATIBILITY_PROJECT_SCAN_ID,
    COMPATIBILITY_PROJECT_SNAPSHOT_SCHEMA,
    DEFAULT_SCAN_THRESHOLDS,
    SCRATCH_STAGE_DEFAULT,
    VISUAL_DOMAIN_IDS,
    createScratchProjectCompatibilitySnapshot
};
