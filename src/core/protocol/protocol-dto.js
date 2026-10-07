'use strict';

const {cloneProtocolValue, validateProtocolValue} = require('./portable-value');

const ENGINE_PROTOCOL_ID = 'ngvge.engine-protocol';
const ENGINE_PROTOCOL_VERSION = 1;
const PROTOCOL_DTO_SCHEMA = 'ngvge-engine-protocol-dto/v1';
const PROTOCOL_DTO_VALIDATION_ERROR = 'NGVGE_PROTOCOL_DTO_INVALID';

const PROTOCOL_DTO_KINDS = Object.freeze({
    COMMAND: 'command',
    ERROR: 'error',
    EVENT: 'event',
    QUERY: 'query'
});

const PROTOCOL_DTO_KIND_VALUES = Object.freeze(Object.values(PROTOCOL_DTO_KINDS));
const TYPE_TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9._:/-]{0,127}$/;
const ERROR_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const MESSAGE_FIELDS = new Set(['kind', 'payload', 'protocol', 'protocolVersion', 'type']);
const ERROR_FIELDS = new Set(['code', 'details', 'kind', 'message', 'protocol', 'protocolVersion']);

class ProtocolDTOValidationError extends TypeError {
    constructor (issues, message = null) {
        const normalizedIssues = Array.isArray(issues) ? issues : [];
        const first = normalizedIssues[0];
        super(message || (first ?
            `Protocol DTO is invalid at ${first.path}: ${first.message}` :
            'Protocol DTO is invalid.'));
        this.code = PROTOCOL_DTO_VALIDATION_ERROR;
        this.issues = normalizedIssues;
        this.name = 'ProtocolDTOValidationError';
    }
}

const createIssue = (code, path, message) => Object.freeze({code, message, path});

const isPlainRecord = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const validateProtocolType = value => typeof value === 'string' && TYPE_TOKEN_PATTERN.test(value.trim());
const validateProtocolErrorCode = value => typeof value === 'string' && ERROR_CODE_PATTERN.test(value.trim());

const validateProtocolDTO = value => {
    const issues = [];
    const addIssue = (code, path, message) => issues.push(createIssue(code, path, message));

    if (!isPlainRecord(value)) {
        addIssue('protocol.dto.non-plain', '$', 'Protocol DTOs must be plain objects.');
        return Object.freeze({
            issues: Object.freeze(issues),
            schema: PROTOCOL_DTO_SCHEMA,
            valid: false
        });
    }

    const kind = value.kind;
    const kindValid = PROTOCOL_DTO_KIND_VALUES.includes(kind);
    if (!kindValid) {
        addIssue('protocol.dto.kind-invalid', '$.kind', 'Protocol DTO kind must be command, query, event, or error.');
    }
    if (value.protocol !== ENGINE_PROTOCOL_ID) {
        addIssue('protocol.dto.protocol-invalid', '$.protocol', `Protocol must be ${ENGINE_PROTOCOL_ID}.`);
    }
    if (value.protocolVersion !== ENGINE_PROTOCOL_VERSION) {
        addIssue('protocol.dto.version-invalid', '$.protocolVersion', `Protocol version must be ${ENGINE_PROTOCOL_VERSION}.`);
    }

    const fields = kind === PROTOCOL_DTO_KINDS.ERROR ? ERROR_FIELDS : MESSAGE_FIELDS;
    Object.keys(value).forEach(key => {
        if (!fields.has(key)) {
            addIssue('protocol.dto.field-unknown', `$.${key}`, `Unsupported ${String(kind || 'protocol')} DTO field.`);
        }
    });

    if (kind === PROTOCOL_DTO_KINDS.ERROR) {
        if (!validateProtocolErrorCode(value.code)) {
            addIssue('protocol.error.code-invalid', '$.code', 'Protocol error code must be a portable token.');
        }
        if (typeof value.message !== 'string' || value.message.length === 0 || value.message.length > 2048) {
            addIssue('protocol.error.message-invalid', '$.message', 'Protocol error message must contain 1-2048 characters.');
        }
        if (!Object.prototype.hasOwnProperty.call(value, 'details')) {
            addIssue('protocol.error.details-missing', '$.details', 'Protocol error DTOs must contain a details field; use null when absent.');
        } else {
            const detailsResult = validateProtocolValue(value.details, {path: '$.details'});
            issues.push(...detailsResult.issues);
        }
    } else if (kindValid) {
        if (!validateProtocolType(value.type)) {
            addIssue('protocol.dto.type-invalid', '$.type', 'Protocol message type must be a portable semantic token.');
        }
        if (!Object.prototype.hasOwnProperty.call(value, 'payload')) {
            addIssue('protocol.dto.payload-missing', '$.payload', 'Protocol messages must contain a payload field.');
        } else {
            const payloadResult = validateProtocolValue(value.payload, {path: '$.payload'});
            issues.push(...payloadResult.issues);
        }
    }

    return Object.freeze({
        issues: Object.freeze(issues.slice()),
        schema: PROTOCOL_DTO_SCHEMA,
        valid: issues.length === 0
    });
};

const assertProtocolDTO = value => {
    const result = validateProtocolDTO(value);
    if (!result.valid) throw new ProtocolDTOValidationError(result.issues);
    return value;
};

const normalizeProtocolDTO = value => {
    assertProtocolDTO(value);
    if (value.kind === PROTOCOL_DTO_KINDS.ERROR) {
        return Object.freeze({
            code: value.code.trim(),
            details: cloneProtocolValue(value.details),
            kind: PROTOCOL_DTO_KINDS.ERROR,
            message: value.message,
            protocol: ENGINE_PROTOCOL_ID,
            protocolVersion: ENGINE_PROTOCOL_VERSION
        });
    }
    return Object.freeze({
        kind: value.kind,
        payload: cloneProtocolValue(value.payload),
        protocol: ENGINE_PROTOCOL_ID,
        protocolVersion: ENGINE_PROTOCOL_VERSION,
        type: value.type.trim()
    });
};

const createProtocolMessage = (kind, type, payload = {}) => normalizeProtocolDTO({
    kind,
    payload,
    protocol: ENGINE_PROTOCOL_ID,
    protocolVersion: ENGINE_PROTOCOL_VERSION,
    type
});

const createEngineCommand = (type, payload = {}) => createProtocolMessage(PROTOCOL_DTO_KINDS.COMMAND, type, payload);
const createEngineQuery = (type, payload = {}) => createProtocolMessage(PROTOCOL_DTO_KINDS.QUERY, type, payload);
const createEngineEvent = (type, payload = {}) => createProtocolMessage(PROTOCOL_DTO_KINDS.EVENT, type, payload);

const createProtocolError = (code, message, details = null) => normalizeProtocolDTO({
    code,
    details,
    kind: PROTOCOL_DTO_KINDS.ERROR,
    message,
    protocol: ENGINE_PROTOCOL_ID,
    protocolVersion: ENGINE_PROTOCOL_VERSION
});

const createQuerySnapshot = value => cloneProtocolValue(value, {path: '$'});

module.exports = {
    ENGINE_PROTOCOL_ID,
    ENGINE_PROTOCOL_VERSION,
    PROTOCOL_DTO_KINDS,
    PROTOCOL_DTO_SCHEMA,
    PROTOCOL_DTO_VALIDATION_ERROR,
    ProtocolDTOValidationError,
    assertProtocolDTO,
    createEngineCommand,
    createEngineEvent,
    createEngineQuery,
    createProtocolError,
    createQuerySnapshot,
    normalizeProtocolDTO,
    validateProtocolDTO
};
