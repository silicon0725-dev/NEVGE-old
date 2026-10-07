/* eslint-disable import/no-commonjs, strict */
'use strict';

const {SCRATCH_TRANSFORM_PRESENTATION_DOMAIN} = require('./constants');

const PRESENTER_CAPABILITY_SCHEMA = 'ngvge.presenter-capability/v1';

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const createPresenterCapability = value => {
    if (!isPlainObject(value)) throw new TypeError('PresenterCapability must be a plain object.');
    if (typeof value.domainId !== 'string' || !value.domainId.trim()) {
        throw new TypeError('PresenterCapability.domainId must be a non-empty string.');
    }
    ['supportsInterpolation', 'supportsResampling', 'requiresExactTickPresentation'].forEach(field => {
        if (typeof value[field] !== 'boolean') throw new TypeError(`PresenterCapability.${field} must be boolean.`);
    });
    if (!Array.isArray(value.diagnostics) || value.diagnostics.some(item => typeof item !== 'string')) {
        throw new TypeError('PresenterCapability.diagnostics must be an array of strings.');
    }
    return Object.freeze({
        diagnostics: Object.freeze(value.diagnostics.slice()),
        domainId: value.domainId.trim(),
        requiresExactTickPresentation: value.requiresExactTickPresentation,
        schema: PRESENTER_CAPABILITY_SCHEMA,
        supportsInterpolation: value.supportsInterpolation,
        supportsResampling: value.supportsResampling
    });
};

const SCRATCH_TRANSFORM_PRESENTER_CAPABILITY = createPresenterCapability({
    diagnostics: [
        [
            'Legacy Scratch interpolation covers sprite transform/render state only;',
            'it does not imply project-wide resampling.'
        ].join(' ')
    ],
    domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
    requiresExactTickPresentation: false,
    supportsInterpolation: true,
    supportsResampling: false
});

module.exports = {
    PRESENTER_CAPABILITY_SCHEMA,
    SCRATCH_TRANSFORM_PRESENTER_CAPABILITY,
    createPresenterCapability
};
