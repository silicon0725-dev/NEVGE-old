/* eslint-disable import/no-commonjs, strict */
'use strict';

const {validatePersistentDTO} = require('../../core/persistent');
const {
    BACKEND_HINT_VALUES,
    CLONE_BUDGET_MODES,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    RUNTIME_POLICY_PROFILE_IDS,
    RUNTIME_POLICY_SET_SCHEMA_VERSION,
    SCHEDULER_MODES,
    SCRIPT_WATCHDOG_POLICIES
} = require('./constants');

const RUNTIME_POLICY_VALIDATION_ERROR = 'NGVGE_RUNTIME_POLICY_VALIDATION_FAILED';
const FORBIDDEN_NATIVE_FIELDS = new Set([
    'opsPerFrame',
    'miscLimits',
    'stageWidth',
    'stageHeight',
    '_twconfig_',
    'vm',
    'renderer',
    'scratchTarget',
    'backendHandle',
    'privateBackendHandle'
]);
const TOP_LEVEL_FIELDS = new Set([
    'schemaVersion',
    'profileId',
    'execution',
    'presentation',
    'safety',
    'scratchCompatibility',
    'executionBackend',
    'backendHints'
]);
const DOMAIN_FIELDS = Object.freeze({
    execution: new Set(['simulationTickRate', 'schedulerMode', 'legacyScratchTurboMode', 'deterministicProfile']),
    presentation: new Set(['refreshPolicy', 'targetRefreshRate', 'renderQuality', 'domainPolicies']),
    safety: new Set([
        'scriptWatchdog',
        'executionBudget',
        'cloneBudget',
        'resourceBudgets',
        'hangDetection',
        'hostHardCeilings'
    ]),
    scratchCompatibility: new Set([
        'fencing',
        'soundEffectLimits',
        'soundYieldSemantics',
        'penSizeLimits',
        'musicConcurrency',
        'mousePrecision',
        'legacyTurboSemantics'
    ]),
    executionBackend: new Set(['mode', 'diagnosticOverride']),
    backendHints: new Set(['offscreenDrawableCulling'])
});

class RuntimePolicyValidationError extends TypeError {
    constructor (issues) {
        const normalized = Array.isArray(issues) ? issues : [];
        const first = normalized[0];
        super(first ? `Runtime Policy is invalid at ${first.path}: ${first.message}` : 'Runtime Policy is invalid.');
        this.code = RUNTIME_POLICY_VALIDATION_ERROR;
        this.issues = normalized;
        this.name = 'RuntimePolicyValidationError';
    }
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const issue = (code, path, message) => Object.freeze({code, message, path});
const enumValues = object => Object.values(object);

const visitForbiddenFields = (value, path, issues) => {
    if (Array.isArray(value)) {
        value.forEach((item, index) => visitForbiddenFields(item, `${path}[${index}]`, issues));
        return;
    }
    if (!isPlainObject(value)) return;
    Object.keys(value).forEach(key => {
        if (FORBIDDEN_NATIVE_FIELDS.has(key)) {
            issues.push(issue(
                'runtime-policy.field.forbidden',
                `${path}.${key}`,
                `${key} is not a Native Runtime Policy field.`
            ));
        }
        visitForbiddenFields(value[key], `${path}.${key}`, issues);
    });
};

const validateExactObject = (value, path, allowedFields, issues) => {
    if (!isPlainObject(value)) {
        issues.push(issue('runtime-policy.domain.non-plain', path, 'Policy domain must be a plain object.'));
        return false;
    }
    Object.keys(value).forEach(key => {
        if (!allowedFields.has(key)) {
            issues.push(issue(
                'runtime-policy.domain.unknown-field',
                `${path}.${key}`,
                `Unknown Runtime Policy field: ${key}.`
            ));
        }
    });
    return true;
};

const validateFinitePositive = (value, path, issues, nullable = false) => {
    if (nullable && value === null) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        issues.push(issue('runtime-policy.number.invalid', path, 'Value must be a finite number greater than zero.'));
    }
};

const validateEnum = (value, values, path, issues) => {
    if (!values.includes(value)) {
        issues.push(issue('runtime-policy.enum.invalid', path, `Value must be one of: ${values.join(', ')}.`));
    }
};

const validateBoolean = (value, path, issues) => {
    if (typeof value !== 'boolean') {
        issues.push(issue('runtime-policy.boolean.invalid', path, 'Value must be boolean.'));
    }
};

const validateDomainPolicy = (value, index, issues) => {
    const path = `$.presentation.domainPolicies[${index}]`;
    const allowed = new Set(['domainId', 'interpolation', 'resampling', 'requiresExactTickPresentation']);
    if (!validateExactObject(value, path, allowed, issues)) return;
    if (typeof value.domainId !== 'string' || !value.domainId.trim()) {
        issues.push(issue(
            'runtime-policy.presentation.domain-id.invalid',
            `${path}.domainId`,
            'domainId must be non-empty.'
        ));
    }
    validateEnum(value.interpolation, enumValues(PRESENTATION_DOMAIN_MODES), `${path}.interpolation`, issues);
    validateEnum(value.resampling, enumValues(PRESENTATION_DOMAIN_MODES), `${path}.resampling`, issues);
    validateBoolean(value.requiresExactTickPresentation, `${path}.requiresExactTickPresentation`, issues);
};

const validateCloneBudget = (value, issues) => {
    const path = '$.safety.cloneBudget';
    const allowed = new Set(['mode', 'requestedLimit', 'hostHardCeiling']);
    if (!validateExactObject(value, path, allowed, issues)) return;
    validateEnum(value.mode, enumValues(CLONE_BUDGET_MODES), `${path}.mode`, issues);
    if (value.requestedLimit !== null) {
        validateFinitePositive(value.requestedLimit, `${path}.requestedLimit`, issues);
    }
    validateFinitePositive(value.hostHardCeiling, `${path}.hostHardCeiling`, issues);
    if (typeof value.requestedLimit === 'number' && Number.isFinite(value.requestedLimit) &&
        typeof value.hostHardCeiling === 'number' && Number.isFinite(value.hostHardCeiling) &&
        value.requestedLimit > value.hostHardCeiling) {
        issues.push(issue(
            'runtime-policy.clone-budget.exceeds-host-ceiling',
            `${path}.requestedLimit`,
            'requestedLimit cannot exceed hostHardCeiling.'
        ));
    }
};

const validateRuntimePolicySet = value => {
    const issues = [];
    if (!isPlainObject(value)) {
        return Object.freeze({valid: false,
            issues: Object.freeze([
                issue('runtime-policy.non-plain', '$', 'RuntimePolicySet must be a plain object.')
            ])});
    }

    const persistent = validatePersistentDTO(value, {path: '$'});
    persistent.issues.forEach(item => issues.push(issue('runtime-policy.dto.invalid', item.path, item.message)));
    visitForbiddenFields(value, '$', issues);

    Object.keys(value).forEach(key => {
        if (!TOP_LEVEL_FIELDS.has(key)) {
            issues.push(issue(
                'runtime-policy.unknown-field',
                `$.${key}`,
                `Unknown RuntimePolicySet field: ${key}.`
            ));
        }
    });

    if (value.schemaVersion !== RUNTIME_POLICY_SET_SCHEMA_VERSION) {
        issues.push(issue('runtime-policy.schema-version.invalid', '$.schemaVersion',
            `schemaVersion must be ${RUNTIME_POLICY_SET_SCHEMA_VERSION}.`));
    }
    if (!enumValues(RUNTIME_POLICY_PROFILE_IDS).includes(value.profileId)) {
        issues.push(issue('runtime-policy.profile.invalid', '$.profileId', 'Unknown Runtime Policy profileId.'));
    }

    if (validateExactObject(value.execution, '$.execution', DOMAIN_FIELDS.execution, issues)) {
        validateFinitePositive(value.execution.simulationTickRate, '$.execution.simulationTickRate', issues);
        validateEnum(
            value.execution.schedulerMode,
            enumValues(SCHEDULER_MODES),
            '$.execution.schedulerMode',
            issues
        );
        validateBoolean(value.execution.legacyScratchTurboMode, '$.execution.legacyScratchTurboMode', issues);
        if (value.execution.deterministicProfile !== null &&
            (typeof value.execution.deterministicProfile !== 'string' ||
             !value.execution.deterministicProfile.trim())) {
            issues.push(issue('runtime-policy.execution.deterministic-profile.invalid',
                '$.execution.deterministicProfile', 'deterministicProfile must be null or a non-empty string.'));
        }
    }

    if (validateExactObject(value.presentation, '$.presentation', DOMAIN_FIELDS.presentation, issues)) {
        validateEnum(value.presentation.refreshPolicy, enumValues(PRESENTATION_REFRESH_POLICIES),
            '$.presentation.refreshPolicy', issues);
        validateFinitePositive(value.presentation.targetRefreshRate, '$.presentation.targetRefreshRate', issues, true);
        validateEnum(value.presentation.renderQuality, enumValues(RENDER_QUALITY_POLICIES),
            '$.presentation.renderQuality', issues);
        if (Array.isArray(value.presentation.domainPolicies)) {
            value.presentation.domainPolicies.forEach((entry, index) => validateDomainPolicy(entry, index, issues));
            const ids = value.presentation.domainPolicies.map(entry => entry && entry.domainId).filter(Boolean);
            if (new Set(ids).size !== ids.length) {
                issues.push(issue(
                    'runtime-policy.presentation.domain-policies.duplicate',
                    '$.presentation.domainPolicies',
                    'domainPolicies cannot contain duplicate domainId values.'
                ));
            }
        } else {
            issues.push(issue(
                'runtime-policy.presentation.domain-policies.invalid',
                '$.presentation.domainPolicies',
                'domainPolicies must be an array.'
            ));
        }
    }

    if (validateExactObject(value.safety, '$.safety', DOMAIN_FIELDS.safety, issues)) {
        validateEnum(
            value.safety.scriptWatchdog,
            enumValues(SCRIPT_WATCHDOG_POLICIES),
            '$.safety.scriptWatchdog',
            issues
        );
        if (!isPlainObject(value.safety.executionBudget)) {
            issues.push(issue('runtime-policy.safety.execution-budget.invalid', '$.safety.executionBudget',
                'executionBudget must be a plain object.'));
        }
        validateCloneBudget(value.safety.cloneBudget, issues);
        if (!isPlainObject(value.safety.resourceBudgets)) {
            issues.push(issue('runtime-policy.safety.resource-budgets.invalid', '$.safety.resourceBudgets',
                'resourceBudgets must be a plain object.'));
        }
        if (!isPlainObject(value.safety.hostHardCeilings)) {
            issues.push(issue('runtime-policy.safety.host-hard-ceilings.invalid', '$.safety.hostHardCeilings',
                'hostHardCeilings must be a plain object.'));
        }
        if (typeof value.safety.hangDetection !== 'string' || !value.safety.hangDetection.trim()) {
            issues.push(issue('runtime-policy.safety.hang-detection.invalid', '$.safety.hangDetection',
                'hangDetection must be a non-empty string.'));
        }
    }

    if (validateExactObject(value.scratchCompatibility, '$.scratchCompatibility',
        DOMAIN_FIELDS.scratchCompatibility, issues)) {
        ['fencing', 'soundEffectLimits', 'penSizeLimits', 'legacyTurboSemantics'].forEach(field =>
            validateBoolean(value.scratchCompatibility[field], `$.scratchCompatibility.${field}`, issues));
        ['soundYieldSemantics', 'musicConcurrency', 'mousePrecision'].forEach(field => {
            if (typeof value.scratchCompatibility[field] !== 'string' || !value.scratchCompatibility[field].trim()) {
                issues.push(issue('runtime-policy.scratch-compatibility.token.invalid',
                    `$.scratchCompatibility.${field}`, `${field} must be a non-empty string.`));
            }
        });
    }

    if (validateExactObject(
        value.executionBackend,
        '$.executionBackend',
        DOMAIN_FIELDS.executionBackend,
        issues
    )) {
        validateEnum(
            value.executionBackend.mode,
            enumValues(EXECUTION_BACKEND_MODES),
            '$.executionBackend.mode',
            issues
        );
        if (value.executionBackend.diagnosticOverride !== null &&
            (typeof value.executionBackend.diagnosticOverride !== 'string' ||
             !value.executionBackend.diagnosticOverride.trim())) {
            issues.push(issue('runtime-policy.execution-backend.diagnostic.invalid',
                '$.executionBackend.diagnosticOverride', 'diagnosticOverride must be null or a non-empty string.'));
        }
    }

    if (validateExactObject(value.backendHints, '$.backendHints', DOMAIN_FIELDS.backendHints, issues)) {
        validateEnum(value.backendHints.offscreenDrawableCulling, enumValues(BACKEND_HINT_VALUES),
            '$.backendHints.offscreenDrawableCulling', issues);
    }

    return Object.freeze({issues: Object.freeze(issues.slice()), valid: issues.length === 0});
};

const deepClone = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(deepClone);
    const result = {};
    Object.keys(value).forEach(key => {
        result[key] = deepClone(value[key]);
    });
    return result;
};
const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
};

const normalizeRuntimePolicySet = value => {
    const result = validateRuntimePolicySet(value);
    if (!result.valid) throw new RuntimePolicyValidationError(result.issues);
    return deepFreeze(deepClone(value));
};

const toProjectRuntimePolicyDTO = value => {
    const normalized = normalizeRuntimePolicySet(value);
    return deepFreeze({
        execution: deepClone(normalized.execution),
        presentation: deepClone(normalized.presentation),
        profileId: normalized.profileId,
        safety: deepClone(normalized.safety),
        schemaVersion: normalized.schemaVersion,
        scratchCompatibility: deepClone(normalized.scratchCompatibility)
    });
};

module.exports = {
    RUNTIME_POLICY_VALIDATION_ERROR,
    RuntimePolicyValidationError,
    normalizeRuntimePolicySet,
    toProjectRuntimePolicyDTO,
    validateRuntimePolicySet
};
