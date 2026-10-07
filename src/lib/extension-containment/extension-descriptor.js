/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    EXTENSION_EXECUTION_MODES,
    EXTENSION_HOST_KINDS,
    EXTENSION_TRUST_LEVELS
} = require('./constants');

const uniqueStrings = value => Object.freeze(Array.from(new Set(
    (Array.isArray(value) ? value : [])
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
)).sort());

const normalizeSource = source => {
    const value = source && typeof source === 'object' ? source : {};
    return Object.freeze({
        kind: typeof value.kind === 'string' && value.kind.trim() ? value.kind.trim() : 'unknown',
        value: typeof value.value === 'string' && value.value ? value.value : null
    });
};

const normalizeTrust = trust => {
    const value = trust && typeof trust === 'object' ? trust : {};
    const levels = Object.values(EXTENSION_TRUST_LEVELS);
    const modes = Object.values(EXTENSION_EXECUTION_MODES);
    return Object.freeze({
        effectiveExecutionMode: modes.includes(value.effectiveExecutionMode) ?
            value.effectiveExecutionMode : EXTENSION_EXECUTION_MODES.BACKEND_MANAGED,
        level: levels.includes(value.level) ? value.level : EXTENSION_TRUST_LEVELS.UNTRUSTED,
        requestedExecutionMode: typeof value.requestedExecutionMode === 'string' ?
            value.requestedExecutionMode : 'backend-default'
    });
};

const normalizeExtensionDescriptor = descriptor => {
    if (!descriptor || typeof descriptor !== 'object') {
        throw new TypeError('Extension containment descriptor must be an object.');
    }
    if (typeof descriptor.extensionId !== 'string' || !descriptor.extensionId.trim()) {
        throw new TypeError('Extension containment descriptor requires a non-empty extensionId.');
    }
    if (!Object.values(EXTENSION_HOST_KINDS).includes(descriptor.hostKind)) {
        throw new TypeError(`Unknown extension host kind: ${descriptor.hostKind}`);
    }
    const extensionId = descriptor.extensionId.trim();
    const descriptorId = `${descriptor.hostKind}:${extensionId}`;
    return Object.freeze({
        capabilities: uniqueStrings(descriptor.capabilities),
        compatibility: Object.freeze({
            legacy: Boolean(descriptor.compatibility && descriptor.compatibility.legacy),
            quarantine: Boolean(descriptor.compatibility && descriptor.compatibility.quarantine)
        }),
        descriptorId,
        displayName: typeof descriptor.displayName === 'string' && descriptor.displayName.trim() ?
            descriptor.displayName.trim() : extensionId,
        extensionId,
        hostKind: descriptor.hostKind,
        permissions: uniqueStrings(descriptor.permissions),
        source: normalizeSource(descriptor.source),
        trust: normalizeTrust(descriptor.trust)
    });
};

module.exports = {
    normalizeExtensionDescriptor,
    uniqueStrings
};
