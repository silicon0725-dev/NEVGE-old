'use strict';

const PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS = 83;
const PASSIVE_SCRATCH_TARGET_LIST_REFRESH_MS = 250;
const SCRATCH_STAGE_RECT_CACHE_MAX_AGE_MS = 250;

const getTargetName = target => {
    if (!target) return '';
    if (typeof target.getName === 'function') {
        try { return String(target.getName() || ''); } catch { /* fall through */ }
    }
    return target.sprite && typeof target.sprite.name === 'string' ? target.sprite.name : '';
};

const getOriginalTargets = vm => {
    const runtime = vm && vm.runtime;
    const targets = runtime && runtime.targets;
    if (!targets || typeof targets.length !== 'number') return [];
    const result = [];
    for (let index = 0; index < targets.length; index++) {
        const target = targets[index];
        if (!target) continue;
        if (Object.prototype.hasOwnProperty.call(target, 'isOriginal') && !target.isOriginal) continue;
        result.push(target);
    }
    return result;
};

const createScratchTargetTopologySignature = vm => getOriginalTargets(vm)
    .map(target => `${String(target.id || '')}\u0000${target.isStage ? '1' : '0'}\u0000${getTargetName(target)}`)
    .join('\u0001');

const hasActiveScratchThreads = vm => {
    const threads = vm && vm.runtime && vm.runtime.threads;
    return Boolean(threads && typeof threads.length === 'number' && threads.length > 0);
};

module.exports = {
    PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS,
    PASSIVE_SCRATCH_TARGET_LIST_REFRESH_MS,
    SCRATCH_STAGE_RECT_CACHE_MAX_AGE_MS,
    createScratchTargetTopologySignature,
    hasActiveScratchThreads
};
