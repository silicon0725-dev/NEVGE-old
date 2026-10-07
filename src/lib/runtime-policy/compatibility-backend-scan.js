/* eslint-disable import/no-commonjs, strict */
'use strict';

const COMPATIBILITY_BACKEND_SCAN_ID = 'ngvge.compatibility-backend-scan@1';
const COMPATIBILITY_BACKEND_SNAPSHOT_SCHEMA = 'ngvge.compatibility-backend-snapshot/v1';

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
};

const createScratchBackendCapabilitySnapshot = vm => {
    if (!vm || !vm.runtime) throw new TypeError('Scratch backend capability scan requires a Scratch VM.');
    const renderer = vm.renderer || vm.runtime.renderer || null;
    return deepFreeze({
        backendId: 'scratch-compatibility-backend',
        capabilities: {
            compilerControl: typeof vm.setCompilerOptions === 'function',
            highQualityRender: Boolean(renderer && typeof renderer.setUseHighQualityRender === 'function'),
            interpolation: typeof vm.setInterpolation === 'function',
            runtimeOptions: typeof vm.setRuntimeOptions === 'function',
            stageGeometry: typeof vm.setStageSize === 'function',
            turboMode: typeof vm.setTurboMode === 'function'
        },
        scannerId: COMPATIBILITY_BACKEND_SCAN_ID,
        schema: COMPATIBILITY_BACKEND_SNAPSHOT_SCHEMA
    });
};

module.exports = {
    COMPATIBILITY_BACKEND_SCAN_ID,
    COMPATIBILITY_BACKEND_SNAPSHOT_SCHEMA,
    createScratchBackendCapabilitySnapshot
};
