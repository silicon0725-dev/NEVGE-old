/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    SCRATCH_TRANSFORM_PRESENTER_CAPABILITY,
    createPresenterCapability
} = require('./presenter-capability');
const {VISUAL_DOMAIN_IDS} = require('./compatibility-project-scan');

const PRESENTER_CAPABILITY_REGISTRY_ID = 'ngvge.presenter-capability-registry@1';

const SCRATCH_PEN_PRESENTER_CAPABILITY = createPresenterCapability({
    diagnostics: [
        'Scratch Pen commits drawing output at simulation time and has no general interpolation/resampling presenter.'
    ],
    domainId: VISUAL_DOMAIN_IDS.SCRATCH_PEN,
    requiresExactTickPresentation: true,
    supportsInterpolation: false,
    supportsResampling: false
});

const SCRATCH_STAMP_PRESENTER_CAPABILITY = createPresenterCapability({
    diagnostics: [
        [
            'Scratch Stamp commits rasterized output at simulation time and cannot be reconstructed',
            'by sprite interpolation.'
        ].join(' ')
    ],
    domainId: VISUAL_DOMAIN_IDS.SCRATCH_STAMP,
    requiresExactTickPresentation: true,
    supportsInterpolation: false,
    supportsResampling: false
});

const BUILT_IN_PRESENTER_CAPABILITIES = Object.freeze([
    SCRATCH_TRANSFORM_PRESENTER_CAPABILITY,
    SCRATCH_PEN_PRESENTER_CAPABILITY,
    SCRATCH_STAMP_PRESENTER_CAPABILITY
]);

class PresenterCapabilityRegistry {
    constructor (capabilities = BUILT_IN_PRESENTER_CAPABILITIES) {
        this.id = PRESENTER_CAPABILITY_REGISTRY_ID;
        this._capabilities = new Map();
        capabilities.forEach(capability => this.register(capability));
        Object.seal(this);
    }

    register (capability) {
        const normalized = createPresenterCapability(capability);
        if (this._capabilities.has(normalized.domainId)) {
            throw new Error(`Presenter capability already exists for domain: ${normalized.domainId}`);
        }
        this._capabilities.set(normalized.domainId, normalized);
        return normalized;
    }

    get (domainId) {
        return this._capabilities.get(domainId) || null;
    }

    list () {
        return Object.freeze(Array.from(this._capabilities.values()));
    }
}

const createPresenterCapabilityRegistry = capabilities => new PresenterCapabilityRegistry(capabilities);

module.exports = {
    BUILT_IN_PRESENTER_CAPABILITIES,
    PRESENTER_CAPABILITY_REGISTRY_ID,
    PresenterCapabilityRegistry,
    SCRATCH_PEN_PRESENTER_CAPABILITY,
    SCRATCH_STAMP_PRESENTER_CAPABILITY,
    createPresenterCapabilityRegistry
};
