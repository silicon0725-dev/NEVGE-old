const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_MANIFEST_VERSION,
    SB3_COMPATIBILITY_LEVELS
} = require('./constants');

const cloneSerializable = value => {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
};

const uniqueStrings = value => Array.from(new Set(
    (Array.isArray(value) ? value : [])
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
));

const normalizeDependency = dependency => {
    if (typeof dependency === 'string') {
        return Object.freeze({id: dependency, optional: false, version: null});
    }
    if (!dependency || typeof dependency.id !== 'string' || !dependency.id.trim()) {
        throw new TypeError('Module dependency must provide a non-empty id.');
    }
    return Object.freeze({
        id: dependency.id.trim(),
        optional: Boolean(dependency.optional),
        version: typeof dependency.version === 'string' && dependency.version.trim() ? dependency.version.trim() : null
    });
};

const normalizeSB3Compatibility = compatibility => {
    const source = compatibility && compatibility.sb3 ? compatibility.sb3 : compatibility || {};
    const level = Object.values(SB3_COMPATIBILITY_LEVELS).includes(source.level) ?
        source.level : SB3_COMPATIBILITY_LEVELS.FULL;
    return Object.freeze({
        description: typeof source.description === 'string' ? source.description : '',
        level,
        strategy: typeof source.strategy === 'string' && source.strategy ? source.strategy : 'preserve-metadata'
    });
};

const validateModuleManifest = manifest => {
    if (!manifest || typeof manifest !== 'object') {
        throw new TypeError('Module manifest must be an object.');
    }
    if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
        throw new TypeError('Module manifest must provide a non-empty id.');
    }
    if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
        throw new TypeError(`Module "${manifest.id}" must provide a name.`);
    }
    if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
        throw new TypeError(`Module "${manifest.id}" must provide a version.`);
    }
    if (typeof manifest.apiVersion !== 'string' || !manifest.apiVersion.trim()) {
        throw new TypeError(`Module "${manifest.id}" must provide an apiVersion.`);
    }
};

const normalizeModuleManifest = manifest => {
    validateModuleManifest(manifest);
    const availability = Object.values(MODULE_AVAILABILITY).includes(manifest.availability) ?
        manifest.availability : MODULE_AVAILABILITY.AVAILABLE;
    const kind = Object.values(MODULE_KINDS).includes(manifest.kind) ?
        manifest.kind : MODULE_KINDS.FIRST_PARTY;
    const dependencies = (Array.isArray(manifest.dependencies) ? manifest.dependencies : [])
        .map(normalizeDependency);
    const normalized = {
        apiVersion: manifest.apiVersion.trim(),
        author: typeof manifest.author === 'string' ? manifest.author : 'NGVGE Team',
        availability,
        capabilities: Object.freeze(uniqueStrings(manifest.capabilities)),
        compatibility: Object.freeze({
            sb3: normalizeSB3Compatibility(manifest.compatibility)
        }),
        defaultEnabled: Boolean(manifest.defaultEnabled),
        dependencies: Object.freeze(dependencies),
        description: typeof manifest.description === 'string' ? manifest.description : '',
        id: manifest.id.trim(),
        kind,
        manifestVersion: MODULE_MANIFEST_VERSION,
        name: manifest.name.trim(),
        permissions: Object.freeze(uniqueStrings(manifest.permissions)),
        required: Boolean(manifest.required),
        version: manifest.version.trim()
    };
    return Object.freeze(normalized);
};

module.exports = {
    cloneSerializable,
    normalizeDependency,
    normalizeModuleManifest,
    normalizeSB3Compatibility,
    validateModuleManifest
};
