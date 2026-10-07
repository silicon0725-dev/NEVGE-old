/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    LEGACY_RUNTIME_SOURCE_IDS,
    installLegacyRuntimeSettingsCompatibilityService
} = require('./legacy-runtime-settings-compatibility');

const LEGACY_ADVANCED_SETTINGS_BRIDGE_ID = 'ngvge.legacy-advanced-settings-bridge@1';
const LEGACY_RUNTIME_QUARANTINE_ID = 'ngvge.legacy-runtime-settings-quarantine@1';

const createLegacyAdvancedSettingsBridge = vm => {
    if (!vm || !vm.runtime) throw new TypeError('Legacy Advanced Settings bridge requires a Scratch VM runtime.');
    const compatibility = installLegacyRuntimeSettingsCompatibilityService(vm);
    if (!compatibility) throw new Error('Legacy Runtime Settings compatibility service is unavailable.');
    const sourceId = LEGACY_RUNTIME_SOURCE_IDS.ADVANCED_SETTINGS;

    return Object.freeze({
        id: LEGACY_ADVANCED_SETTINGS_BRIDGE_ID,
        quarantineId: LEGACY_RUNTIME_QUARANTINE_ID,
        setCloneLimit: value => compatibility.setCloneLimit(value, sourceId),
        setDisableCompiler: disabled => compatibility.setDisableCompiler(disabled, sourceId),
        setFencing: enabled => compatibility.setFencing(enabled, sourceId),
        setFramerate: value => compatibility.setFramerate(value, sourceId),
        setHighQualityPen: enabled => compatibility.setHighQualityPen(enabled, sourceId),
        setInfiniteClones: enabled => compatibility.setCloneLimit(enabled ? Infinity : 300, sourceId),
        setInterpolation: enabled => compatibility.setInterpolation(enabled, sourceId),
        setOffscreenDrawableCulling: enabled => compatibility.setOffscreenDrawableCulling(enabled, sourceId),
        setOpsPerFrame: value => compatibility.setOpsPerFrame(value, sourceId),
        setRemoveLimits: removeLimits => compatibility.setRemoveLimits(removeLimits, sourceId),
        setStageSize: (width, height) => compatibility.setStageSize(width, height, sourceId),
        setTurbo: enabled => compatibility.setTurbo(enabled, sourceId),
        setWarpTimer: enabled => compatibility.setWarpTimer(enabled, sourceId),
        storeLegacyProjectOptions: () => compatibility.exportLegacyProjectOptionsToProject()
    });
};

module.exports = {
    LEGACY_ADVANCED_SETTINGS_BRIDGE_ID,
    LEGACY_RUNTIME_QUARANTINE_ID,
    createLegacyAdvancedSettingsBridge
};
