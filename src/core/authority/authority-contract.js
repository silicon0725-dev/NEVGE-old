'use strict';

const AUTHORITY_REGISTRATION_SCHEMA = 'ngvge-authority-registration/v1';
const AUTHORITY_REGISTRATION_VALIDATION_ERROR = 'NGVGE_AUTHORITY_REGISTRATION_VALIDATION_FAILED';
const STATE_DOMAIN_ID_INVALID = 'NGVGE_STATE_DOMAIN_ID_INVALID';
const AUTHORITY_ID_INVALID = 'NGVGE_AUTHORITY_ID_INVALID';

const AUTHORITY_MODES = Object.freeze({
    OBSERVER: 'observer',
    PROJECTION: 'projection',
    WRITER: 'writer'
});

const PROJECTION_DIRECTIONS = Object.freeze({
    AUTHORITY_TO_PROJECTION: 'authority-to-projection',
    PROJECTION_TO_AUTHORITY: 'projection-to-authority'
});

const AUTHORITY_MODE_VALUES = Object.freeze(Object.values(AUTHORITY_MODES));
const PROJECTION_DIRECTION_VALUES = Object.freeze(Object.values(PROJECTION_DIRECTIONS));
const DOMAIN_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/~-]{0,127}$/;
const AUTHORITY_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/~-]{0,127}$/;
const REGISTRATION_FIELDS = new Set(['authorityId', 'domain', 'mode', 'projectionDirection']);

class AuthorityRegistrationValidationError extends TypeError {
    constructor (issues, message = null) {
        const normalizedIssues = Array.isArray(issues) ? issues : [];
        const first = normalizedIssues[0];
        super(message || (first ?
            `Authority registration is invalid at ${first.path}: ${first.message}` :
            'Authority registration is invalid.'));
        this.code = AUTHORITY_REGISTRATION_VALIDATION_ERROR;
        this.issues = normalizedIssues;
        this.name = 'AuthorityRegistrationValidationError';
    }
}

const createIssue = (code, path, message) => Object.freeze({code, message, path});

const normalizeToken = (value, pattern, code, label) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!pattern.test(normalized)) {
        const error = new TypeError(`${label} must be a non-empty portable token no longer than 128 characters.`);
        error.code = code;
        error.value = value;
        throw error;
    }
    return normalized;
};

const normalizeStateDomainId = value => normalizeToken(
    value,
    DOMAIN_TOKEN_PATTERN,
    STATE_DOMAIN_ID_INVALID,
    'StateDomainId'
);

const normalizeAuthorityId = value => normalizeToken(
    value,
    AUTHORITY_TOKEN_PATTERN,
    AUTHORITY_ID_INVALID,
    'AuthorityId'
);

const validateAuthorityRegistration = value => {
    const issues = [];
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
        return Object.freeze({
            issues: Object.freeze([
                createIssue('authority.registration.shape-invalid', '$', 'Registration must be a plain object.')
            ]),
            schema: AUTHORITY_REGISTRATION_SCHEMA,
            valid: false
        });
    }

    Object.keys(value).forEach(field => {
        if (!REGISTRATION_FIELDS.has(field)) {
            issues.push(createIssue(
                'authority.registration.field-unknown',
                `$.${field}`,
                `Unknown Authority registration field: ${field}`
            ));
        }
    });

    try {
        normalizeStateDomainId(value.domain);
    } catch (error) {
        issues.push(createIssue('authority.domain.invalid', '$.domain', error.message));
    }

    try {
        normalizeAuthorityId(value.authorityId);
    } catch (error) {
        issues.push(createIssue('authority.id.invalid', '$.authorityId', error.message));
    }

    if (!AUTHORITY_MODE_VALUES.includes(value.mode)) {
        issues.push(createIssue(
            'authority.mode.invalid',
            '$.mode',
            `Authority mode must be one of: ${AUTHORITY_MODE_VALUES.join(', ')}.`
        ));
    }

    const hasProjectionDirection = Object.prototype.hasOwnProperty.call(value, 'projectionDirection');
    if (value.mode === AUTHORITY_MODES.PROJECTION) {
        if (!hasProjectionDirection || !PROJECTION_DIRECTION_VALUES.includes(value.projectionDirection)) {
            issues.push(createIssue(
                'authority.projection.direction-invalid',
                '$.projectionDirection',
                `Projection registrations require one of: ${PROJECTION_DIRECTION_VALUES.join(', ')}.`
            ));
        }
    } else if (hasProjectionDirection) {
        issues.push(createIssue(
            'authority.projection.direction-not-applicable',
            '$.projectionDirection',
            'Only projection registrations may declare projectionDirection.'
        ));
    }

    return Object.freeze({
        issues: Object.freeze(issues.slice()),
        schema: AUTHORITY_REGISTRATION_SCHEMA,
        valid: issues.length === 0
    });
};

const assertAuthorityRegistration = value => {
    const result = validateAuthorityRegistration(value);
    if (!result.valid) throw new AuthorityRegistrationValidationError(result.issues);
    return value;
};

const normalizeAuthorityRegistration = value => {
    assertAuthorityRegistration(value);
    const normalized = {
        authorityId: normalizeAuthorityId(value.authorityId),
        domain: normalizeStateDomainId(value.domain),
        mode: value.mode
    };
    if (value.mode === AUTHORITY_MODES.PROJECTION) {
        normalized.projectionDirection = value.projectionDirection;
    }
    return Object.freeze(normalized);
};

module.exports = {
    AUTHORITY_ID_INVALID,
    AUTHORITY_MODES,
    AUTHORITY_REGISTRATION_SCHEMA,
    AUTHORITY_REGISTRATION_VALIDATION_ERROR,
    AuthorityRegistrationValidationError,
    PROJECTION_DIRECTIONS,
    STATE_DOMAIN_ID_INVALID,
    assertAuthorityRegistration,
    normalizeAuthorityId,
    normalizeAuthorityRegistration,
    normalizeStateDomainId,
    validateAuthorityRegistration
};
