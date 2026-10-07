const PAINT_MODULE_REGISTRY_ID = 'ngvge.scratch-paint.module-registry@1';
const PAINT_MODULE_REGISTRY_VERSION = 1;

const PAINT_MODULE_SLOTS = Object.freeze([
    'fixedToolbar',
    'propertiesToolbar',
    'toolRail',
    'workspace',
    'canvasControls',
    'workspaceOverlay',
    'sidePanel',
    'bottomPanel'
]);

const freezeModuleRecord = (slot, value) => {
    if (!value || typeof value !== 'object') {
        throw new TypeError(`Scratch Paint module slot ${slot} requires a module record.`);
    }
    if (typeof value.component !== 'function') {
        throw new TypeError(`Scratch Paint module slot ${slot} requires a React component.`);
    }
    return Object.freeze({
        id: typeof value.id === 'string' && value.id ? value.id : `scratch-paint.${slot}`,
        version: Number.isInteger(value.version) && value.version > 0 ? value.version : 1,
        component: value.component
    });
};

const createPaintModuleRegistry = (baseModules, overrides = {}) => {
    const base = baseModules || {};
    const next = {};
    PAINT_MODULE_SLOTS.forEach(slot => {
        const candidate = Object.prototype.hasOwnProperty.call(overrides, slot) ? overrides[slot] : base[slot];
        if (!candidate) {
            throw new TypeError(`Scratch Paint module registry is missing required slot: ${slot}`);
        }
        next[slot] = freezeModuleRecord(slot, candidate);
    });
    return Object.freeze({
        id: PAINT_MODULE_REGISTRY_ID,
        version: PAINT_MODULE_REGISTRY_VERSION,
        slots: Object.freeze(next)
    });
};

const getPaintModuleComponent = (registry, slot) => {
    if (!registry || registry.id !== PAINT_MODULE_REGISTRY_ID || !registry.slots) {
        throw new TypeError('Scratch Paint requires an admitted Paint module registry.');
    }
    const moduleRecord = registry.slots[slot];
    if (!moduleRecord || typeof moduleRecord.component !== 'function') {
        throw new TypeError(`Scratch Paint module registry has no component for slot: ${slot}`);
    }
    return moduleRecord.component;
};

export {
    PAINT_MODULE_REGISTRY_ID,
    PAINT_MODULE_REGISTRY_VERSION,
    PAINT_MODULE_SLOTS,
    createPaintModuleRegistry,
    getPaintModuleComponent
};
