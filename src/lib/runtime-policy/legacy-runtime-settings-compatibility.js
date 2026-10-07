/* eslint-disable import/no-commonjs, strict */
'use strict';

const ExtendedJSON = require('@turbowarp/json');

const {
    BACKEND_HINT_VALUES,
    CLONE_BUDGET_MODES,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    RUNTIME_POLICY_DOMAIN_IDS,
    SCRATCH_COMPATIBILITY_TOKENS,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN
} = require('./constants');
const {unwrapRuntimePolicyCommandResult} = require('./runtime-policy-command-capability');
const {getRuntimePolicyClient, installRuntimePolicyService} = require('./runtime-policy-runtime-integration');

const LEGACY_RUNTIME_SETTINGS_COMPATIBILITY_SERVICE_ID = 'ngvge.legacy-runtime-settings-compatibility@1';
const LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID = 'ngvge.legacy-scratch-project-options-adapter@1';
const LEGACY_RUNTIME_PRECEDENCE_ID = 'ngvge.legacy-runtime-precedence@1';
const LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID = 'ngvge.project-scene-viewport-compatibility@1';
const LEGACY_TWCONFIG_MAGIC = ' // _twconfig_';
const LEGACY_RUNTIME_PROPERTY = 'ngvgeLegacyRuntimeSettingsCompatibility';

const LEGACY_RUNTIME_PRECEDENCE = Object.freeze({
    BACKEND_AUTOMATIC: 100,
    WORKSPACE_DEVICE: 200,
    EXPLICIT_SESSION_OVERRIDE: 300,
    LEGACY_PROJECT_IMPORT: 400,
    NATIVE_PROJECT: 500
});

const LEGACY_RUNTIME_SOURCE_IDS = Object.freeze({
    BACKEND_AUTOMATIC: 'legacy-runtime.backend-automatic',
    BLOCKS_MOUNT: 'legacy-runtime.blocks-mount',
    ADVANCED_SETTINGS: 'legacy-runtime.advanced-settings',
    URL_SESSION: 'legacy-runtime.url-session',
    GREEN_FLAG_GESTURE: 'legacy-runtime.green-flag-gesture',
    FRAMERATE_CHANGER: 'legacy-runtime.framerate-changer',
    TURBO_CONTROL: 'legacy-runtime.turbo-control',
    LEGACY_PROJECT_IMPORT: 'legacy-runtime.project-import',
    NATIVE_PROJECT: 'ngvge.runtime-policy.native-project'
});

const SOURCE_DEFINITIONS = Object.freeze({
    [LEGACY_RUNTIME_SOURCE_IDS.BACKEND_AUTOMATIC]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.BACKEND_AUTOMATIC,
        precedence: LEGACY_RUNTIME_PRECEDENCE.BACKEND_AUTOMATIC,
        scope: 'backend'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.BLOCKS_MOUNT]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.BLOCKS_MOUNT,
        precedence: LEGACY_RUNTIME_PRECEDENCE.WORKSPACE_DEVICE,
        scope: 'workspace-device'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.ADVANCED_SETTINGS]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.ADVANCED_SETTINGS,
        precedence: LEGACY_RUNTIME_PRECEDENCE.EXPLICIT_SESSION_OVERRIDE,
        scope: 'session'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION,
        precedence: LEGACY_RUNTIME_PRECEDENCE.EXPLICIT_SESSION_OVERRIDE,
        scope: 'session'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.GREEN_FLAG_GESTURE]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.GREEN_FLAG_GESTURE,
        precedence: LEGACY_RUNTIME_PRECEDENCE.EXPLICIT_SESSION_OVERRIDE,
        scope: 'session'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.FRAMERATE_CHANGER]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.FRAMERATE_CHANGER,
        precedence: LEGACY_RUNTIME_PRECEDENCE.EXPLICIT_SESSION_OVERRIDE,
        scope: 'session'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.TURBO_CONTROL]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.TURBO_CONTROL,
        precedence: LEGACY_RUNTIME_PRECEDENCE.EXPLICIT_SESSION_OVERRIDE,
        scope: 'session'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.LEGACY_PROJECT_IMPORT]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.LEGACY_PROJECT_IMPORT,
        precedence: LEGACY_RUNTIME_PRECEDENCE.LEGACY_PROJECT_IMPORT,
        scope: 'project-import'
    }),
    [LEGACY_RUNTIME_SOURCE_IDS.NATIVE_PROJECT]: Object.freeze({
        id: LEGACY_RUNTIME_SOURCE_IDS.NATIVE_PROJECT,
        precedence: LEGACY_RUNTIME_PRECEDENCE.NATIVE_PROJECT,
        scope: 'project'
    })
});

const SEMANTIC_KEYS = Object.freeze({
    SIMULATION_TICK_RATE: 'execution.simulationTickRate',
    LEGACY_SCRATCH_TURBO_MODE: 'execution.legacyScratchTurboMode',
    SCRATCH_TRANSFORM_INTERPOLATION: 'presentation.scratchTransformInterpolation',
    PRESENTATION_REFRESH_POLICY: 'presentation.refreshPolicy',
    RENDER_QUALITY: 'presentation.renderQuality',
    CLONE_BUDGET_INTENT: 'safety.cloneBudgetIntent',
    FENCING: 'scratchCompatibility.fencing',
    SOUND_EFFECT_LIMITS: 'scratchCompatibility.soundEffectLimits',
    SOUND_YIELD_SEMANTICS: 'scratchCompatibility.soundYieldSemantics',
    PEN_SIZE_LIMITS: 'scratchCompatibility.penSizeLimits',
    MUSIC_CONCURRENCY: 'scratchCompatibility.musicConcurrency',
    MOUSE_PRECISION: 'scratchCompatibility.mousePrecision',
    EXECUTION_BACKEND_MODE: 'executionBackend.mode',
    OFFSCREEN_DRAWABLE_CULLING: 'backendHints.offscreenDrawableCulling',
    OPS_PER_FRAME: 'legacy.scheduler.opsPerFrame',
    WARP_TIMER: 'legacy.safety.warpTimer',
    VIEWPORT_WIDTH: 'project.viewport.width',
    VIEWPORT_HEIGHT: 'project.viewport.height'
});

const SOURCE_VALUES_UNSET = Symbol('legacy-runtime-source-value-unset');
const servicesByRuntime = new WeakMap();

const clone = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    const result = {};
    Object.keys(value).forEach(key => {
        result[key] = clone(value[key]);
    });
    return result;
};

const deepEqual = (left, right) => {
    if (left === right) return true;
    if (typeof left !== typeof right || left === null || right === null) return false;
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
        return left.every((value, index) => deepEqual(value, right[index]));
    }
    if (typeof left === 'object') {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) return false;
        return leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) &&
            deepEqual(left[key], right[key]));
    }
    return false;
};

const createDiagnostic = (code, message, details = {}) => Object.freeze({
    code,
    details: Object.freeze(clone(details)),
    message,
    severity: details.severity || 'warning'
});

const createMigrationRecord = (legacyPath, owner, status, details = {}) => Object.freeze({
    legacyPath,
    owner,
    status,
    target: details.target || null,
    value: Object.prototype.hasOwnProperty.call(details, 'value') ? clone(details.value) : null
});

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isFinitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

const getScratchInterpolationEnabled = policy => policy.presentation.domainPolicies.some(entry => (
    entry.domainId === SCRATCH_TRANSFORM_PRESENTATION_DOMAIN &&
    entry.interpolation === PRESENTATION_DOMAIN_MODES.IF_SUPPORTED
));

const createBackendBaselineValues = (vm, policy) => {
    const runtime = vm.runtime;
    const frameLoop = runtime.frameLoop || {};
    const compilerOptions = runtime.compilerOptions || {};
    const values = {
        [SEMANTIC_KEYS.SIMULATION_TICK_RATE]: policy.execution.simulationTickRate,
        [SEMANTIC_KEYS.LEGACY_SCRATCH_TURBO_MODE]: policy.execution.legacyScratchTurboMode,
        [SEMANTIC_KEYS.SCRATCH_TRANSFORM_INTERPOLATION]: getScratchInterpolationEnabled(policy),
        [SEMANTIC_KEYS.PRESENTATION_REFRESH_POLICY]: policy.presentation.refreshPolicy,
        [SEMANTIC_KEYS.RENDER_QUALITY]: policy.presentation.renderQuality,
        [SEMANTIC_KEYS.CLONE_BUDGET_INTENT]: {
            mode: policy.safety.cloneBudget.mode,
            requestedLimit: policy.safety.cloneBudget.requestedLimit
        },
        [SEMANTIC_KEYS.FENCING]: policy.scratchCompatibility.fencing,
        [SEMANTIC_KEYS.SOUND_EFFECT_LIMITS]: policy.scratchCompatibility.soundEffectLimits,
        [SEMANTIC_KEYS.SOUND_YIELD_SEMANTICS]: policy.scratchCompatibility.soundYieldSemantics,
        [SEMANTIC_KEYS.PEN_SIZE_LIMITS]: policy.scratchCompatibility.penSizeLimits,
        [SEMANTIC_KEYS.MUSIC_CONCURRENCY]: policy.scratchCompatibility.musicConcurrency,
        [SEMANTIC_KEYS.MOUSE_PRECISION]: policy.scratchCompatibility.mousePrecision,
        [SEMANTIC_KEYS.EXECUTION_BACKEND_MODE]: policy.executionBackend.mode,
        [SEMANTIC_KEYS.OFFSCREEN_DRAWABLE_CULLING]: policy.backendHints.offscreenDrawableCulling,
        [SEMANTIC_KEYS.OPS_PER_FRAME]: isFinitePositive(frameLoop.opsPerFrame) ? frameLoop.opsPerFrame : 1,
        [SEMANTIC_KEYS.WARP_TIMER]: Boolean(compilerOptions.warpTimer),
        [SEMANTIC_KEYS.VIEWPORT_WIDTH]: isFinitePositive(runtime.stageWidth) ? runtime.stageWidth : 480,
        [SEMANTIC_KEYS.VIEWPORT_HEIGHT]: isFinitePositive(runtime.stageHeight) ? runtime.stageHeight : 360
    };
    return values;
};

const normalizeSourceDefinition = sourceId => {
    const definition = SOURCE_DEFINITIONS[sourceId];
    if (!definition) throw new TypeError(`Unknown Legacy Runtime source: ${sourceId}`);
    return definition;
};

const parseLegacyProjectOptionsCommentText = text => {
    if (typeof text !== 'string' || !text.includes(LEGACY_TWCONFIG_MAGIC)) {
        return Object.freeze({diagnostics: Object.freeze([]), found: false, options: null});
    }
    const lines = text.split('\n');
    const matching = lines.filter(line => line.endsWith(LEGACY_TWCONFIG_MAGIC));
    if (!matching.length) {
        return Object.freeze({
            diagnostics: Object.freeze([
                createDiagnostic(
                    'legacy-runtime.twconfig.invalid-magic-line',
                    'Legacy _twconfig_ marker exists but no valid configuration line ends with the marker.'
                )
            ]),
            found: true,
            options: null
        });
    }
    const diagnostics = [];
    if (matching.length > 1) {
        diagnostics.push(createDiagnostic(
            'legacy-runtime.twconfig.multiple-lines',
            'Multiple _twconfig_ lines were found; only the first line is imported.',
            {count: matching.length}
        ));
    }
    const line = matching[0];
    const jsonText = line.slice(0, line.length - LEGACY_TWCONFIG_MAGIC.length);
    try {
        const options = ExtendedJSON.parse(jsonText);
        if (!isPlainObject(options)) throw new TypeError('Legacy project options must be a plain object.');
        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            found: true,
            options: Object.freeze(clone(options))
        });
    } catch (error) {
        diagnostics.push(createDiagnostic(
            'legacy-runtime.twconfig.invalid-json',
            'Legacy _twconfig_ payload could not be parsed.',
            {error: error && error.message ? error.message : String(error), severity: 'error'}
        ));
        return Object.freeze({diagnostics: Object.freeze(diagnostics), found: true, options: null});
    }
};

const getLegacyProjectOptionsCommentText = runtime => {
    if (!runtime || typeof runtime.getTargetForStage !== 'function') return null;
    const stage = runtime.getTargetForStage();
    if (!stage || !stage.comments || typeof stage.comments !== 'object') return null;
    const comment = Object.values(stage.comments).find(entry => (
        entry && typeof entry.text === 'string' && entry.text.includes(LEGACY_TWCONFIG_MAGIC)
    ));
    return comment ? comment.text : null;
};

const buildRelaxedCompatibilityValues = () => ({
    [SEMANTIC_KEYS.SOUND_EFFECT_LIMITS]: false,
    [SEMANTIC_KEYS.SOUND_YIELD_SEMANTICS]: SCRATCH_COMPATIBILITY_TOKENS.RELAXED,
    [SEMANTIC_KEYS.PEN_SIZE_LIMITS]: false,
    [SEMANTIC_KEYS.MUSIC_CONCURRENCY]: SCRATCH_COMPATIBILITY_TOKENS.RELAXED,
    [SEMANTIC_KEYS.MOUSE_PRECISION]: SCRATCH_COMPATIBILITY_TOKENS.HIGH_PRECISION
});

const buildScratchCompatibleValues = () => ({
    [SEMANTIC_KEYS.SOUND_EFFECT_LIMITS]: true,
    [SEMANTIC_KEYS.SOUND_YIELD_SEMANTICS]: SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE,
    [SEMANTIC_KEYS.PEN_SIZE_LIMITS]: true,
    [SEMANTIC_KEYS.MUSIC_CONCURRENCY]: SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE,
    [SEMANTIC_KEYS.MOUSE_PRECISION]: SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE
});

const createLegacyProjectOptionsMigrationPlan = options => {
    const values = {};
    const diagnostics = [];
    const records = [];
    if (!isPlainObject(options)) {
        diagnostics.push(createDiagnostic(
            'legacy-runtime.project-options.non-object',
            'Legacy project options must be an object.',
            {severity: 'error'}
        ));
        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            records: Object.freeze(records),
            sourceValues: Object.freeze(values)
        });
    }

    const knownTopLevel = new Set([
        'framerate',
        'opsPerFrame',
        'runtimeOptions',
        'interpolation',
        'turbo',
        'hq',
        'width',
        'height'
    ]);
    Object.keys(options)
        .filter(key => !knownTopLevel.has(key))
        .forEach(key => {
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.unknown-field',
                `Unknown Legacy project option was not imported: ${key}`,
                {legacyPath: key, severity: 'error'}
            ));
            records.push(createMigrationRecord(key, 'unresolved', 'unsupported', {value: options[key]}));
        });

    if (Object.prototype.hasOwnProperty.call(options, 'framerate')) {
        if (isFinitePositive(options.framerate)) {
            values[SEMANTIC_KEYS.SIMULATION_TICK_RATE] = options.framerate;
            records.push(createMigrationRecord('framerate', RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, 'mapped', {
                target: SEMANTIC_KEYS.SIMULATION_TICK_RATE,
                value: options.framerate
            }));
            if (options.framerate !== 30) {
                diagnostics.push(createDiagnostic(
                    'legacy-runtime.project-options.non-default-framerate',
                    'Legacy non-30 Hz simulation rate is imported as an explicit compatibility override.',
                    {value: options.framerate}
                ));
            }
        } else {
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.framerate-unrepresentable',
                'Legacy framerate is not representable by Runtime Policy v1 and was not imported.',
                {severity: 'error', value: options.framerate}
            ));
            records.push(createMigrationRecord('framerate', RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, 'unsupported', {
                value: options.framerate
            }));
        }
    }

    if (Object.prototype.hasOwnProperty.call(options, 'opsPerFrame')) {
        if (options.opsPerFrame === 1) {
            records.push(createMigrationRecord('opsPerFrame', 'legacy-scheduler-quarantine', 'dropped-default', {
                value: 1
            }));
        } else if (isFinitePositive(options.opsPerFrame)) {
            values[SEMANTIC_KEYS.OPS_PER_FRAME] = options.opsPerFrame;
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.ops-per-frame-quarantined',
                'Legacy OpsPerFrame is quarantined and is not a Native Runtime Policy field.',
                {value: options.opsPerFrame}
            ));
            records.push(createMigrationRecord('opsPerFrame', 'legacy-scheduler-quarantine', 'quarantined', {
                target: SEMANTIC_KEYS.OPS_PER_FRAME,
                value: options.opsPerFrame
            }));
        } else {
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.ops-per-frame-invalid',
                'Invalid OpsPerFrame value was not imported.',
                {severity: 'error', value: options.opsPerFrame}
            ));
            records.push(createMigrationRecord('opsPerFrame', 'legacy-scheduler-quarantine', 'unsupported', {
                value: options.opsPerFrame
            }));
        }
    }

    if (Object.prototype.hasOwnProperty.call(options, 'turbo')) {
        if (typeof options.turbo === 'boolean') {
            values[SEMANTIC_KEYS.LEGACY_SCRATCH_TURBO_MODE] = options.turbo;
            records.push(createMigrationRecord('turbo', RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, 'mapped', {
                target: SEMANTIC_KEYS.LEGACY_SCRATCH_TURBO_MODE,
                value: options.turbo
            }));
        } else {
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.turbo-invalid',
                'Legacy turbo value must be boolean.',
                {severity: 'error', value: options.turbo}
            ));
            records.push(createMigrationRecord('turbo', RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, 'unsupported', {
                value: options.turbo
            }));
        }
    }

    if (Object.prototype.hasOwnProperty.call(options, 'interpolation')) {
        if (typeof options.interpolation === 'boolean') {
            values[SEMANTIC_KEYS.SCRATCH_TRANSFORM_INTERPOLATION] = options.interpolation;
            if (options.interpolation) {
                values[SEMANTIC_KEYS.PRESENTATION_REFRESH_POLICY] = PRESENTATION_REFRESH_POLICIES.DISPLAY;
            }
            records.push(createMigrationRecord('interpolation', RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION, 'mapped', {
                target: 'scratch.sprite.transform',
                value: options.interpolation
            }));
        } else {
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.interpolation-invalid',
                'Legacy interpolation value must be boolean.',
                {severity: 'error', value: options.interpolation}
            ));
            records.push(createMigrationRecord('interpolation', RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION, 'unsupported', {
                value: options.interpolation
            }));
        }
    }

    const runtimeOptions = options.runtimeOptions;
    if (Object.prototype.hasOwnProperty.call(options, 'runtimeOptions')) {
        if (isPlainObject(runtimeOptions)) {
            const knownRuntimeOptions = new Set(['maxClones', 'fencing', 'miscLimits', 'offscreenDrawableCulling']);
            Object.keys(runtimeOptions)
                .filter(key => !knownRuntimeOptions.has(key))
                .forEach(key => {
                    const legacyPath = `runtimeOptions.${key}`;
                    diagnostics.push(createDiagnostic(
                        'legacy-runtime.project-options.unknown-runtime-option',
                        `Unknown Legacy runtime option was not imported: ${legacyPath}`,
                        {legacyPath, severity: 'error'}
                    ));
                    records.push(createMigrationRecord(legacyPath, 'unresolved', 'unsupported', {
                        value: runtimeOptions[key]
                    }));
                });

            if (Object.prototype.hasOwnProperty.call(runtimeOptions, 'maxClones')) {
                const maxClones = runtimeOptions.maxClones;
                if (maxClones === Infinity) {
                    values[SEMANTIC_KEYS.CLONE_BUDGET_INTENT] = {
                        mode: CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST,
                        requestedLimit: null
                    };
                    records.push(createMigrationRecord(
                        'runtimeOptions.maxClones',
                        RUNTIME_POLICY_DOMAIN_IDS.SAFETY,
                        'mapped-bounded-compatibility-request',
                        {target: SEMANTIC_KEYS.CLONE_BUDGET_INTENT, value: 'Infinity'}
                    ));
                } else if (isFinitePositive(maxClones)) {
                    values[SEMANTIC_KEYS.CLONE_BUDGET_INTENT] = {
                        mode: CLONE_BUDGET_MODES.FINITE,
                        requestedLimit: maxClones
                    };
                    records.push(createMigrationRecord(
                        'runtimeOptions.maxClones',
                        RUNTIME_POLICY_DOMAIN_IDS.SAFETY,
                        'mapped',
                        {target: SEMANTIC_KEYS.CLONE_BUDGET_INTENT, value: maxClones}
                    ));
                } else {
                    diagnostics.push(createDiagnostic(
                        'legacy-runtime.project-options.max-clones-unrepresentable',
                        'Legacy clone limit is not representable by Runtime Policy v1 and was not imported.',
                        {severity: 'error', value: maxClones}
                    ));
                    records.push(createMigrationRecord(
                        'runtimeOptions.maxClones',
                        RUNTIME_POLICY_DOMAIN_IDS.SAFETY,
                        'unsupported',
                        {value: maxClones}
                    ));
                }
            }

            if (Object.prototype.hasOwnProperty.call(runtimeOptions, 'fencing')) {
                if (typeof runtimeOptions.fencing === 'boolean') {
                    values[SEMANTIC_KEYS.FENCING] = runtimeOptions.fencing;
                    records.push(createMigrationRecord(
                        'runtimeOptions.fencing',
                        RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY,
                        'mapped',
                        {target: SEMANTIC_KEYS.FENCING, value: runtimeOptions.fencing}
                    ));
                } else {
                    diagnostics.push(createDiagnostic(
                        'legacy-runtime.project-options.fencing-invalid',
                        'Legacy fencing value must be boolean.',
                        {severity: 'error', value: runtimeOptions.fencing}
                    ));
                    records.push(createMigrationRecord(
                        'runtimeOptions.fencing',
                        RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY,
                        'unsupported',
                        {value: runtimeOptions.fencing}
                    ));
                }
            }

            if (Object.prototype.hasOwnProperty.call(runtimeOptions, 'miscLimits')) {
                if (typeof runtimeOptions.miscLimits === 'boolean') {
                    Object.assign(
                        values,
                        runtimeOptions.miscLimits ? buildScratchCompatibleValues() : buildRelaxedCompatibilityValues()
                    );
                    records.push(createMigrationRecord(
                        'runtimeOptions.miscLimits',
                        RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY,
                        'expanded-explicit-bundle',
                        {value: runtimeOptions.miscLimits}
                    ));
                } else {
                    diagnostics.push(createDiagnostic(
                        'legacy-runtime.project-options.misc-limits-invalid',
                        'Legacy miscLimits value must be boolean.',
                        {severity: 'error', value: runtimeOptions.miscLimits}
                    ));
                    records.push(createMigrationRecord(
                        'runtimeOptions.miscLimits',
                        RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY,
                        'unsupported',
                        {value: runtimeOptions.miscLimits}
                    ));
                }
            }

            if (Object.prototype.hasOwnProperty.call(runtimeOptions, 'offscreenDrawableCulling')) {
                if (typeof runtimeOptions.offscreenDrawableCulling === 'boolean') {
                    values[SEMANTIC_KEYS.OFFSCREEN_DRAWABLE_CULLING] = runtimeOptions.offscreenDrawableCulling ?
                        BACKEND_HINT_VALUES.ON : BACKEND_HINT_VALUES.OFF;
                    records.push(createMigrationRecord(
                        'runtimeOptions.offscreenDrawableCulling',
                        RUNTIME_POLICY_DOMAIN_IDS.BACKEND_HINTS,
                        'mapped-runtime-only-hint',
                        {
                            target: SEMANTIC_KEYS.OFFSCREEN_DRAWABLE_CULLING,
                            value: runtimeOptions.offscreenDrawableCulling
                        }
                    ));
                } else {
                    diagnostics.push(createDiagnostic(
                        'legacy-runtime.project-options.offscreen-culling-invalid',
                        'Legacy offscreen drawable culling value must be boolean.',
                        {severity: 'error', value: runtimeOptions.offscreenDrawableCulling}
                    ));
                    records.push(createMigrationRecord(
                        'runtimeOptions.offscreenDrawableCulling',
                        RUNTIME_POLICY_DOMAIN_IDS.BACKEND_HINTS,
                        'unsupported',
                        {value: runtimeOptions.offscreenDrawableCulling}
                    ));
                }
            }
        } else {
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.runtime-options-invalid',
                'Legacy runtimeOptions must be an object.',
                {severity: 'error'}
            ));
            records.push(createMigrationRecord('runtimeOptions', 'unresolved', 'unsupported', {value: runtimeOptions}));
        }
    }

    if (Object.prototype.hasOwnProperty.call(options, 'hq')) {
        if (typeof options.hq === 'boolean') {
            values[SEMANTIC_KEYS.RENDER_QUALITY] = options.hq ?
                RENDER_QUALITY_POLICIES.HIGH : RENDER_QUALITY_POLICIES.COMPATIBILITY;
            if (options.hq) {
                values[SEMANTIC_KEYS.PEN_SIZE_LIMITS] = false;
            } else if (!runtimeOptions || !Object.prototype.hasOwnProperty.call(runtimeOptions, 'miscLimits')) {
                values[SEMANTIC_KEYS.PEN_SIZE_LIMITS] = true;
            }
            records.push(createMigrationRecord('hq', RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION, 'split-domains', {
                target: `${SEMANTIC_KEYS.RENDER_QUALITY} + ${SEMANTIC_KEYS.PEN_SIZE_LIMITS}`,
                value: options.hq
            }));
        } else {
            diagnostics.push(createDiagnostic(
                'legacy-runtime.project-options.hq-invalid',
                'Legacy high-quality render value must be boolean.',
                {severity: 'error', value: options.hq}
            ));
            records.push(createMigrationRecord('hq', RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION, 'unsupported', {
                value: options.hq
            }));
        }
    }

    ['width', 'height'].forEach(field => {
        if (!Object.prototype.hasOwnProperty.call(options, field)) return;
        const value = options[field];
        if (isFinitePositive(value)) {
            const semanticKey = field === 'width' ? SEMANTIC_KEYS.VIEWPORT_WIDTH : SEMANTIC_KEYS.VIEWPORT_HEIGHT;
            values[semanticKey] = value;
            records.push(createMigrationRecord(field, LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID, 'mapped', {
                target: semanticKey,
                value
            }));
        } else {
            diagnostics.push(createDiagnostic(
                `legacy-runtime.project-options.${field}-invalid`,
                `Legacy stage ${field} must be a finite number greater than zero.`,
                {severity: 'error', value}
            ));
            records.push(createMigrationRecord(field, LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID, 'unsupported', {
                value
            }));
        }
    });

    return Object.freeze({
        diagnostics: Object.freeze(diagnostics),
        records: Object.freeze(records),
        sourceValues: Object.freeze(clone(values))
    });
};

const createLegacyRuntimeSettingsCompatibilityService = vm => {
    if (!vm || !vm.runtime) throw new TypeError('Legacy Runtime Settings compatibility requires a Scratch VM runtime.');
    const runtime = vm.runtime;
    const runtimePolicy = getRuntimePolicyClient(runtime) || installRuntimePolicyService(vm);
    if (!runtimePolicy) throw new Error('Runtime Policy service is unavailable.');

    const layers = new Map();
    const migrationRecords = [];
    const diagnostics = [];
    let sequence = 0;
    let lastEffective = new Map();

    const pushDiagnostics = entries => {
        entries.forEach(entry => diagnostics.push(entry));
    };

    const seedLayer = (sourceId, values) => {
        const definition = normalizeSourceDefinition(sourceId);
        const candidates = new Map();
        Object.keys(values).forEach(key => {
            candidates.set(key, {sequence: 0, value: clone(values[key])});
        });
        layers.set(sourceId, {definition, values: candidates});
    };

    seedLayer(
        LEGACY_RUNTIME_SOURCE_IDS.BACKEND_AUTOMATIC,
        createBackendBaselineValues(vm, runtimePolicy.getSnapshot())
    );

    const resolveWinner = key => {
        let winner = null;
        layers.forEach(layer => {
            const candidate = layer.values.get(key);
            if (!candidate) return;
            const current = {
                precedence: layer.definition.precedence,
                scope: layer.definition.scope,
                sequence: candidate.sequence,
                sourceId: layer.definition.id,
                value: clone(candidate.value)
            };
            if (!winner || current.precedence > winner.precedence ||
                (current.precedence === winner.precedence && current.sequence > winner.sequence)) {
                winner = current;
            }
        });
        return winner;
    };

    const getEffectiveValues = () => {
        const keys = new Set();
        layers.forEach(layer => layer.values.forEach((value, key) => keys.add(key)));
        const result = new Map();
        keys.forEach(key => {
            const winner = resolveWinner(key);
            if (winner) result.set(key, winner);
        });
        return result;
    };

    const patchPolicyDomain = (domain, patch) => unwrapRuntimePolicyCommandResult(
        runtimePolicy.patchDomain(domain, patch)
    );

    const buildPresentationPatch = effective => {
        const policy = runtimePolicy.getSnapshot();
        const domainPolicies = policy.presentation.domainPolicies
            .filter(entry => entry.domainId !== SCRATCH_TRANSFORM_PRESENTATION_DOMAIN)
            .map(entry => Object.assign({}, entry));
        const interpolation = effective.get(SEMANTIC_KEYS.SCRATCH_TRANSFORM_INTERPOLATION);
        if (interpolation && interpolation.value) {
            domainPolicies.push({
                domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
                interpolation: PRESENTATION_DOMAIN_MODES.IF_SUPPORTED,
                requiresExactTickPresentation: false,
                resampling: PRESENTATION_DOMAIN_MODES.DISABLED
            });
        }
        return {
            domainPolicies,
            refreshPolicy: effective.get(SEMANTIC_KEYS.PRESENTATION_REFRESH_POLICY).value,
            renderQuality: effective.get(SEMANTIC_KEYS.RENDER_QUALITY).value
        };
    };

    const applyEffective = changedKeys => {
        if (!changedKeys.size) return [];
        const effective = getEffectiveValues();
        const policy = runtimePolicy.getSnapshot();
        const plans = [];
        const changed = key => changedKeys.has(key);

        if (changed(SEMANTIC_KEYS.SIMULATION_TICK_RATE) || changed(SEMANTIC_KEYS.LEGACY_SCRATCH_TURBO_MODE)) {
            plans.push(patchPolicyDomain(RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, {
                legacyScratchTurboMode: effective.get(SEMANTIC_KEYS.LEGACY_SCRATCH_TURBO_MODE).value,
                simulationTickRate: effective.get(SEMANTIC_KEYS.SIMULATION_TICK_RATE).value
            }));
        }

        if (
            changed(SEMANTIC_KEYS.SCRATCH_TRANSFORM_INTERPOLATION) ||
            changed(SEMANTIC_KEYS.PRESENTATION_REFRESH_POLICY) ||
            changed(SEMANTIC_KEYS.RENDER_QUALITY)
        ) {
            plans.push(patchPolicyDomain(RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION, buildPresentationPatch(effective)));
        }

        if (changed(SEMANTIC_KEYS.CLONE_BUDGET_INTENT)) {
            const intent = effective.get(SEMANTIC_KEYS.CLONE_BUDGET_INTENT).value;
            const hostHardCeiling = policy.safety.cloneBudget.hostHardCeiling;
            let requestedLimit = intent.requestedLimit;
            if (typeof requestedLimit === 'number' && requestedLimit > hostHardCeiling) {
                pushDiagnostics([createDiagnostic(
                    'legacy-runtime.clone-budget.clamped',
                    'Legacy clone budget request exceeds the Host hard ceiling and was clamped.',
                    {hostHardCeiling, requestedLimit}
                )]);
                requestedLimit = hostHardCeiling;
            }
            plans.push(patchPolicyDomain(RUNTIME_POLICY_DOMAIN_IDS.SAFETY, {
                cloneBudget: {
                    hostHardCeiling,
                    mode: intent.mode,
                    requestedLimit
                }
            }));
        }

        const compatibilityKeys = [
            SEMANTIC_KEYS.FENCING,
            SEMANTIC_KEYS.SOUND_EFFECT_LIMITS,
            SEMANTIC_KEYS.SOUND_YIELD_SEMANTICS,
            SEMANTIC_KEYS.PEN_SIZE_LIMITS,
            SEMANTIC_KEYS.MUSIC_CONCURRENCY,
            SEMANTIC_KEYS.MOUSE_PRECISION
        ];
        if (compatibilityKeys.some(changed)) {
            plans.push(patchPolicyDomain(RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY, {
                fencing: effective.get(SEMANTIC_KEYS.FENCING).value,
                mousePrecision: effective.get(SEMANTIC_KEYS.MOUSE_PRECISION).value,
                musicConcurrency: effective.get(SEMANTIC_KEYS.MUSIC_CONCURRENCY).value,
                penSizeLimits: effective.get(SEMANTIC_KEYS.PEN_SIZE_LIMITS).value,
                soundEffectLimits: effective.get(SEMANTIC_KEYS.SOUND_EFFECT_LIMITS).value,
                soundYieldSemantics: effective.get(SEMANTIC_KEYS.SOUND_YIELD_SEMANTICS).value
            }));
        }

        if (changed(SEMANTIC_KEYS.EXECUTION_BACKEND_MODE)) {
            plans.push(patchPolicyDomain(RUNTIME_POLICY_DOMAIN_IDS.EXECUTION_BACKEND, {
                mode: effective.get(SEMANTIC_KEYS.EXECUTION_BACKEND_MODE).value
            }));
        }

        if (changed(SEMANTIC_KEYS.OFFSCREEN_DRAWABLE_CULLING)) {
            plans.push(patchPolicyDomain(RUNTIME_POLICY_DOMAIN_IDS.BACKEND_HINTS, {
                offscreenDrawableCulling: effective.get(SEMANTIC_KEYS.OFFSCREEN_DRAWABLE_CULLING).value
            }));
        }

        if (changed(SEMANTIC_KEYS.OPS_PER_FRAME)) {
            if (typeof vm.setOpsPerFrame !== 'function') {
                throw new TypeError('Legacy scheduler quarantine requires vm.setOpsPerFrame().');
            }
            vm.setOpsPerFrame(effective.get(SEMANTIC_KEYS.OPS_PER_FRAME).value);
            plans.push(Object.freeze({owner: 'legacy-scheduler-quarantine', semanticKey: SEMANTIC_KEYS.OPS_PER_FRAME}));
        }

        if (changed(SEMANTIC_KEYS.WARP_TIMER)) {
            if (typeof vm.setCompilerOptions !== 'function') {
                throw new TypeError('Legacy Runtime Safety quarantine requires vm.setCompilerOptions().');
            }
            vm.setCompilerOptions({warpTimer: Boolean(effective.get(SEMANTIC_KEYS.WARP_TIMER).value)});
            plans.push(Object.freeze({
                owner: 'legacy-runtime-safety-quarantine',
                semanticKey: SEMANTIC_KEYS.WARP_TIMER
            }));
        }

        if (changed(SEMANTIC_KEYS.VIEWPORT_WIDTH) || changed(SEMANTIC_KEYS.VIEWPORT_HEIGHT)) {
            if (typeof vm.setStageSize !== 'function') {
                throw new TypeError('Project viewport compatibility owner requires vm.setStageSize().');
            }
            const width = effective.get(SEMANTIC_KEYS.VIEWPORT_WIDTH).value;
            const height = effective.get(SEMANTIC_KEYS.VIEWPORT_HEIGHT).value;
            vm.setStageSize(width, height);
            plans.push(Object.freeze({
                owner: LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID,
                schemaVersion: 1,
                viewport: Object.freeze({height, width})
            }));
        }

        lastEffective = effective;
        return plans;
    };

    lastEffective = getEffectiveValues();

    const updateSource = (sourceId, valuePatch, options = {}) => {
        const definition = normalizeSourceDefinition(sourceId);
        const previousLayer = layers.get(sourceId);
        const previousValues = previousLayer ? new Map(previousLayer.values) : new Map();
        const nextValues = options.replace ? new Map() : new Map(previousValues);
        const touchedKeys = new Set(options.replace ? Array.from(previousValues.keys()) : []);

        Object.keys(valuePatch || {}).forEach(key => {
            touchedKeys.add(key);
            const value = valuePatch[key];
            if (value === SOURCE_VALUES_UNSET) {
                nextValues.delete(key);
            } else {
                sequence += 1;
                nextValues.set(key, {sequence, value: clone(value)});
            }
        });
        if (options.replace) {
            nextValues.forEach((value, key) => touchedKeys.add(key));
        }
        layers.set(sourceId, {definition, values: nextValues});

        const nextEffective = getEffectiveValues();
        const changedKeys = new Set();
        touchedKeys.forEach(key => {
            const before = lastEffective.get(key);
            const after = nextEffective.get(key);
            if (!before || !after || before.sourceId !== after.sourceId || !deepEqual(before.value, after.value)) {
                changedKeys.add(key);
            }
        });

        try {
            const plans = applyEffective(changedKeys);
            const blocked = [];
            Object.keys(valuePatch || {}).forEach(key => {
                const winner = resolveWinner(key);
                if (winner && winner.sourceId !== sourceId) {
                    blocked.push(Object.freeze({
                        key,
                        sourceId,
                        winnerPrecedence: winner.precedence,
                        winnerSourceId: winner.sourceId
                    }));
                }
            });
            if (blocked.length) {
                pushDiagnostics(blocked.map(item => createDiagnostic(
                    'legacy-runtime.precedence.override-blocked',
                    `Legacy source ${item.sourceId} is lower precedence than ${item.winnerSourceId} for ${item.key}.`,
                    item
                )));
            }
            return Object.freeze({
                appliedKeys: Object.freeze(Array.from(changedKeys)),
                blocked: Object.freeze(blocked),
                plans: Object.freeze(plans),
                sourceId
            });
        } catch (error) {
            if (previousLayer) {
                layers.set(sourceId, {definition: previousLayer.definition, values: previousValues});
            } else {
                layers.delete(sourceId);
            }
            try {
                const rollbackEffective = getEffectiveValues();
                const rollbackKeys = new Set(touchedKeys);
                lastEffective = nextEffective;
                applyEffective(rollbackKeys);
                lastEffective = rollbackEffective;
            } catch (rollbackError) {
                // Original failure is authoritative; compatibility rollback is best effort.
            }
            throw error;
        }
    };

    const setFramerate = (value, sourceId) => {
        if (!isFinitePositive(value)) {
            const diagnostic = createDiagnostic(
                'legacy-runtime.framerate.unrepresentable',
                'Legacy framerate must be a finite number greater than zero for Runtime Policy v1.',
                {severity: 'error', sourceId, value}
            );
            pushDiagnostics([diagnostic]);
            return Object.freeze({diagnostics: Object.freeze([diagnostic]), sourceId});
        }
        return updateSource(sourceId, {[SEMANTIC_KEYS.SIMULATION_TICK_RATE]: value});
    };

    const setInterpolation = (enabled, sourceId) => updateSource(sourceId, {
        [SEMANTIC_KEYS.SCRATCH_TRANSFORM_INTERPOLATION]: Boolean(enabled),
        [SEMANTIC_KEYS.PRESENTATION_REFRESH_POLICY]: enabled ?
            PRESENTATION_REFRESH_POLICIES.DISPLAY : SOURCE_VALUES_UNSET
    });

    const setHighQualityPen = (enabled, sourceId) => {
        const effective = getEffectiveValues();
        const otherCompatibilityRelaxed = (
            effective.get(SEMANTIC_KEYS.SOUND_EFFECT_LIMITS).value === false ||
            effective.get(SEMANTIC_KEYS.SOUND_YIELD_SEMANTICS).value === SCRATCH_COMPATIBILITY_TOKENS.RELAXED ||
            effective.get(SEMANTIC_KEYS.MUSIC_CONCURRENCY).value === SCRATCH_COMPATIBILITY_TOKENS.RELAXED ||
            effective.get(SEMANTIC_KEYS.MOUSE_PRECISION).value === SCRATCH_COMPATIBILITY_TOKENS.HIGH_PRECISION
        );
        return updateSource(sourceId, {
            [SEMANTIC_KEYS.RENDER_QUALITY]: enabled ?
                RENDER_QUALITY_POLICIES.HIGH : RENDER_QUALITY_POLICIES.COMPATIBILITY,
            [SEMANTIC_KEYS.PEN_SIZE_LIMITS]: !(enabled || otherCompatibilityRelaxed)
        });
    };

    const setTurbo = (enabled, sourceId) => updateSource(sourceId, {
        [SEMANTIC_KEYS.LEGACY_SCRATCH_TURBO_MODE]: Boolean(enabled)
    });

    const setCloneLimit = (value, sourceId) => {
        if (value === Infinity) {
            return updateSource(sourceId, {
                [SEMANTIC_KEYS.CLONE_BUDGET_INTENT]: {
                    mode: CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST,
                    requestedLimit: null
                }
            });
        }
        if (!isFinitePositive(value)) {
            const diagnostic = createDiagnostic(
                'legacy-runtime.clone-budget.unrepresentable',
                'Legacy clone limit must be Infinity or a finite number greater than zero.',
                {severity: 'error', sourceId, value}
            );
            pushDiagnostics([diagnostic]);
            return Object.freeze({diagnostics: Object.freeze([diagnostic]), sourceId});
        }
        return updateSource(sourceId, {
            [SEMANTIC_KEYS.CLONE_BUDGET_INTENT]: {
                mode: CLONE_BUDGET_MODES.FINITE,
                requestedLimit: value
            }
        });
    };

    const setFencing = (enabled, sourceId) => updateSource(sourceId, {
        [SEMANTIC_KEYS.FENCING]: Boolean(enabled)
    });

    const setRemoveLimits = (removeLimits, sourceId) => {
        const values = removeLimits ? buildRelaxedCompatibilityValues() : buildScratchCompatibleValues();
        if (!removeLimits) {
            const renderQuality = getEffectiveValues().get(SEMANTIC_KEYS.RENDER_QUALITY);
            if (renderQuality && renderQuality.value === RENDER_QUALITY_POLICIES.HIGH) {
                values[SEMANTIC_KEYS.PEN_SIZE_LIMITS] = false;
            }
        }
        return updateSource(sourceId, values);
    };

    const setOffscreenDrawableCulling = (enabled, sourceId) => updateSource(sourceId, {
        [SEMANTIC_KEYS.OFFSCREEN_DRAWABLE_CULLING]: enabled ? BACKEND_HINT_VALUES.ON : BACKEND_HINT_VALUES.OFF
    });

    const setDisableCompiler = (disabled, sourceId) => updateSource(sourceId, {
        [SEMANTIC_KEYS.EXECUTION_BACKEND_MODE]: disabled ? EXECUTION_BACKEND_MODES.INTERPRETER :
            EXECUTION_BACKEND_MODES.AUTO
    });

    const setOpsPerFrame = (value, sourceId) => {
        if (!isFinitePositive(value)) {
            const diagnostic = createDiagnostic(
                'legacy-runtime.ops-per-frame.invalid',
                'Legacy OpsPerFrame must be a finite number greater than zero.',
                {severity: 'error', sourceId, value}
            );
            pushDiagnostics([diagnostic]);
            return Object.freeze({diagnostics: Object.freeze([diagnostic]), sourceId});
        }
        return updateSource(sourceId, {[SEMANTIC_KEYS.OPS_PER_FRAME]: value});
    };

    const setWarpTimer = (enabled, sourceId) => updateSource(sourceId, {
        [SEMANTIC_KEYS.WARP_TIMER]: Boolean(enabled)
    });

    const setStageSize = (width, height, sourceId) => {
        if (!isFinitePositive(width) || !isFinitePositive(height)) {
            const diagnostic = createDiagnostic(
                'legacy-runtime.viewport.invalid',
                'Legacy project viewport dimensions must be finite numbers greater than zero.',
                {height, severity: 'error', sourceId, width}
            );
            pushDiagnostics([diagnostic]);
            return Object.freeze({diagnostics: Object.freeze([diagnostic]), sourceId});
        }
        return updateSource(sourceId, {
            [SEMANTIC_KEYS.VIEWPORT_HEIGHT]: height,
            [SEMANTIC_KEYS.VIEWPORT_WIDTH]: width
        });
    };

    const importLegacyProjectOptions = options => {
        const plan = createLegacyProjectOptionsMigrationPlan(options);
        pushDiagnostics(plan.diagnostics);
        migrationRecords.push(...plan.records);
        return Object.freeze({
            adapterId: LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID,
            diagnostics: plan.diagnostics,
            records: plan.records,
            result: updateSource(
                LEGACY_RUNTIME_SOURCE_IDS.LEGACY_PROJECT_IMPORT,
                plan.sourceValues,
                {replace: true}
            )
        });
    };

    const importLegacyProjectOptionsFromRuntime = () => {
        const text = getLegacyProjectOptionsCommentText(runtime);
        const parsed = parseLegacyProjectOptionsCommentText(text);
        pushDiagnostics(parsed.diagnostics);
        if (!parsed.found || !parsed.options) {
            const result = updateSource(LEGACY_RUNTIME_SOURCE_IDS.LEGACY_PROJECT_IMPORT, {}, {replace: true});
            return Object.freeze({
                adapterId: LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID,
                diagnostics: parsed.diagnostics,
                found: parsed.found,
                records: Object.freeze([]),
                result
            });
        }
        const imported = importLegacyProjectOptions(parsed.options);
        return Object.freeze(Object.assign({}, imported, {found: true}));
    };

    const getLegacyMiscLimitsExport = policy => {
        const compatibility = policy.scratchCompatibility;
        const scratchCompatible = (
            compatibility.soundEffectLimits === true &&
            compatibility.soundYieldSemantics === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE &&
            compatibility.musicConcurrency === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE &&
            compatibility.mousePrecision === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE
        );
        if (scratchCompatible && compatibility.penSizeLimits === true) return {value: true, exact: true};
        if (scratchCompatible && compatibility.penSizeLimits === false &&
            policy.presentation.renderQuality === RENDER_QUALITY_POLICIES.HIGH) {
            return {value: true, exact: true};
        }
        const relaxed = (
            compatibility.soundEffectLimits === false &&
            compatibility.penSizeLimits === false &&
            compatibility.soundYieldSemantics === SCRATCH_COMPATIBILITY_TOKENS.RELAXED &&
            compatibility.musicConcurrency === SCRATCH_COMPATIBILITY_TOKENS.RELAXED &&
            compatibility.mousePrecision === SCRATCH_COMPATIBILITY_TOKENS.HIGH_PRECISION
        );
        if (relaxed) return {value: false, exact: true};
        return {value: false, exact: false};
    };

    const createLegacyExportOptions = () => {
        const policy = runtimePolicy.getSnapshot();
        const options = {};
        const exportDiagnostics = [];
        if (policy.execution.simulationTickRate !== 30) options.framerate = policy.execution.simulationTickRate;
        const opsPerFrame = runtime.frameLoop && runtime.frameLoop.opsPerFrame;
        if (isFinitePositive(opsPerFrame) && opsPerFrame !== 1) options.opsPerFrame = opsPerFrame;
        if (policy.execution.legacyScratchTurboMode) options.turbo = true;
        if (getScratchInterpolationEnabled(policy)) options.interpolation = true;
        if (policy.presentation.renderQuality === RENDER_QUALITY_POLICIES.HIGH) options.hq = true;

        const runtimeOptions = {};
        const cloneBudget = policy.safety.cloneBudget;
        if (cloneBudget.mode === CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST) {
            runtimeOptions.maxClones = Infinity;
        } else if (cloneBudget.requestedLimit !== null && cloneBudget.requestedLimit !== 300) {
            runtimeOptions.maxClones = cloneBudget.requestedLimit;
        }
        if (!policy.scratchCompatibility.fencing) runtimeOptions.fencing = false;
        const miscLimits = getLegacyMiscLimitsExport(policy);
        if (!miscLimits.exact) {
            exportDiagnostics.push(createDiagnostic(
                'legacy-runtime.export.misc-limits-partial',
                [
                    'Current explicit compatibility fields cannot be represented exactly by Legacy miscLimits;',
                    'export uses relaxed behavior.'
                ].join(' '),
                {severity: 'warning'}
            ));
        }
        if (miscLimits.value === false) runtimeOptions.miscLimits = false;
        if (policy.backendHints.offscreenDrawableCulling === BACKEND_HINT_VALUES.ON) {
            runtimeOptions.offscreenDrawableCulling = true;
        }
        if (policy.backendHints.offscreenDrawableCulling === BACKEND_HINT_VALUES.OFF) {
            runtimeOptions.offscreenDrawableCulling = false;
        }
        if (Object.keys(runtimeOptions).length) options.runtimeOptions = runtimeOptions;

        if (runtime.stageWidth !== 480) options.width = runtime.stageWidth;
        if (runtime.stageHeight !== 360) options.height = runtime.stageHeight;
        return Object.freeze({diagnostics: Object.freeze(exportDiagnostics), options: Object.freeze(clone(options))});
    };

    const exportLegacyProjectOptionsToProject = () => {
        const exported = createLegacyExportOptions();
        pushDiagnostics(exported.diagnostics);
        if (typeof runtime.getTargetForStage !== 'function') {
            throw new TypeError('Legacy project export requires a Stage target.');
        }
        const stage = runtime.getTargetForStage();
        if (!stage) throw new Error('Legacy project export could not find the Stage target.');
        const text = [
            'Configuration for https://turbowarp.org/',
            [
                'You can move, resize, and minimize this comment, but don\'t edit it by hand.',
                'This comment can be deleted to remove the stored settings.'
            ].join(' '),
            `${ExtendedJSON.stringify(exported.options)}${LEGACY_TWCONFIG_MAGIC}`
        ].join('\n');
        const existing = stage.comments && Object.values(stage.comments).find(entry => (
            entry && typeof entry.text === 'string' && entry.text.includes(LEGACY_TWCONFIG_MAGIC)
        ));
        if (existing) {
            existing.text = text;
        } else if (typeof stage.createComment === 'function') {
            const uid = require('scratch-vm/src/util/uid');
            stage.createComment(uid(), null, text, 50, 50, 350, 170, false);
        } else {
            throw new TypeError('Legacy project export requires Stage comment creation support.');
        }
        if (typeof runtime.emitProjectChanged === 'function') runtime.emitProjectChanged();
        if (vm.editingTarget && vm.editingTarget.isStage && typeof vm.emitWorkspaceUpdate === 'function') {
            vm.emitWorkspaceUpdate();
        }
        return Object.freeze({
            adapterId: LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID,
            diagnostics: exported.diagnostics,
            explicitLegacyExport: true,
            options: exported.options
        });
    };

    const service = Object.freeze({
        adapterId: LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID,
        id: LEGACY_RUNTIME_SETTINGS_COMPATIBILITY_SERVICE_ID,
        importLegacyProjectOptions,
        importLegacyProjectOptionsFromRuntime,
        exportLegacyProjectOptionsToProject,
        createLegacyExportOptions,
        getDiagnostics: () => Object.freeze(diagnostics.slice()),
        getMigrationRecords: () => Object.freeze(migrationRecords.slice()),
        getPrecedenceSnapshot: () => {
            const effective = getEffectiveValues();
            const snapshot = {};
            effective.forEach((winner, key) => {
                snapshot[key] = Object.freeze({
                    precedence: winner.precedence,
                    scope: winner.scope,
                    sourceId: winner.sourceId,
                    value: clone(winner.value)
                });
            });
            return Object.freeze(snapshot);
        },
        setCloneLimit,
        setDisableCompiler,
        setFencing,
        setFramerate,
        setHighQualityPen,
        setInterpolation,
        setOffscreenDrawableCulling,
        setOpsPerFrame,
        setRemoveLimits,
        setStageSize,
        setTurbo,
        setWarpTimer,
        updateSource
    });
    return service;
};

const installLegacyRuntimeSettingsCompatibilityService = vm => {
    if (!vm || !vm.runtime) return null;
    const runtime = vm.runtime;
    const current = servicesByRuntime.get(runtime) || runtime[LEGACY_RUNTIME_PROPERTY];
    if (current && current.id === LEGACY_RUNTIME_SETTINGS_COMPATIBILITY_SERVICE_ID) return current;

    const service = createLegacyRuntimeSettingsCompatibilityService(vm);
    const compatibilityParser = () => service.importLegacyProjectOptionsFromRuntime();
    const compatibilityExporter = () => service.exportLegacyProjectOptionsToProject();
    Object.defineProperty(runtime, 'parseProjectOptions', {
        configurable: true,
        enumerable: false,
        value: compatibilityParser,
        writable: false
    });
    Object.defineProperty(runtime, 'storeProjectOptions', {
        configurable: true,
        enumerable: false,
        value: compatibilityExporter,
        writable: false
    });

    servicesByRuntime.set(runtime, service);
    if (!Object.prototype.hasOwnProperty.call(runtime, LEGACY_RUNTIME_PROPERTY)) {
        Object.defineProperty(runtime, LEGACY_RUNTIME_PROPERTY, {
            configurable: false,
            enumerable: false,
            value: service,
            writable: false
        });
    }
    return service;
};

const getLegacyRuntimeSettingsCompatibilityService = runtime => (
    runtime ? servicesByRuntime.get(runtime) || runtime[LEGACY_RUNTIME_PROPERTY] || null : null
);

module.exports = {
    LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID,
    LEGACY_RUNTIME_PRECEDENCE,
    LEGACY_RUNTIME_PRECEDENCE_ID,
    LEGACY_RUNTIME_PROPERTY,
    LEGACY_RUNTIME_SETTINGS_COMPATIBILITY_SERVICE_ID,
    LEGACY_RUNTIME_SOURCE_IDS,
    LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID,
    LEGACY_TWCONFIG_MAGIC,
    SEMANTIC_KEYS,
    SOURCE_DEFINITIONS,
    createLegacyProjectOptionsMigrationPlan,
    createLegacyRuntimeSettingsCompatibilityService,
    getLegacyProjectOptionsCommentText,
    getLegacyRuntimeSettingsCompatibilityService,
    installLegacyRuntimeSettingsCompatibilityService,
    parseLegacyProjectOptionsCommentText
};
