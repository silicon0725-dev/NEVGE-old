const WORKSPACE_DOCK_PLACEMENT_MODEL_ID = 'ngvge.workspace-dock-placement-model@1';
const DOCK_PLACEMENT_PREFERENCE_SCHEMA_ID = 'ngvge.workspace-dock-placement-preference@1';
const DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION = 1;

const DOCK_PLACEMENTS = Object.freeze(['top', 'bottom', 'left', 'right']);
const DOCK_ALIGNMENTS = Object.freeze(['start', 'center', 'end']);
const DEFAULT_DOCK_PLACEMENT_PREFERENCE = Object.freeze({
    schemaVersion: DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION,
    placement: 'bottom',
    alignment: 'center',
    offsetX: 0,
    offsetY: 0
});

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freeze = value => Object.freeze(value);

const assertEnum = (value, values, label) => {
    if (!values.includes(value)) {
        throw new TypeError(`${label} must be one of: ${values.join(', ')}.`);
    }
    return value;
};

const assertOffset = (value, label) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number.`);
    }
    return value;
};

const PLACEMENT_PREFERENCE_FIELDS = Object.freeze([
    'schemaVersion',
    'placement',
    'alignment',
    'offsetX',
    'offsetY'
]);

const assertKnownPreferenceFields = (source, label) => {
    const unknown = Object.keys(source).filter(key => !PLACEMENT_PREFERENCE_FIELDS.includes(key));
    if (unknown.length > 0) {
        throw new Error(`${label} contains unsupported field(s): ${unknown.join(', ')}`);
    }
};

const normalizeDockPlacementPreference = value => {
    const source = typeof value === 'undefined' ? DEFAULT_DOCK_PLACEMENT_PREFERENCE : value;
    if (!isPlainObject(source)) {
        throw new TypeError('Dock placement preference must be a plain object.');
    }
    assertKnownPreferenceFields(source, 'Dock placement preference');
    if (typeof source.schemaVersion !== 'undefined' &&
        source.schemaVersion !== DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION) {
        throw new Error(`Unsupported Dock placement preference schemaVersion: ${source.schemaVersion}`);
    }
    return freeze({
        schemaVersion: DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION,
        placement: assertEnum(
            typeof source.placement === 'undefined' ? DEFAULT_DOCK_PLACEMENT_PREFERENCE.placement : source.placement,
            DOCK_PLACEMENTS,
            'Dock placement'
        ),
        alignment: assertEnum(
            typeof source.alignment === 'undefined' ? DEFAULT_DOCK_PLACEMENT_PREFERENCE.alignment : source.alignment,
            DOCK_ALIGNMENTS,
            'Dock alignment'
        ),
        offsetX: assertOffset(
            typeof source.offsetX === 'undefined' ? DEFAULT_DOCK_PLACEMENT_PREFERENCE.offsetX : source.offsetX,
            'Dock offsetX'
        ),
        offsetY: assertOffset(
            typeof source.offsetY === 'undefined' ? DEFAULT_DOCK_PLACEMENT_PREFERENCE.offsetY : source.offsetY,
            'Dock offsetY'
        )
    });
};

const getDockOrientation = placement => (
    placement === 'left' || placement === 'right' ? 'vertical' : 'horizontal'
);

const projectDockGeometry = preference => {
    const normalized = normalizeDockPlacementPreference(preference);
    return freeze({
        modelId: WORKSPACE_DOCK_PLACEMENT_MODEL_ID,
        schemaId: DOCK_PLACEMENT_PREFERENCE_SCHEMA_ID,
        schemaVersion: DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION,
        placement: normalized.placement,
        alignment: normalized.alignment,
        orientation: getDockOrientation(normalized.placement),
        offsetX: normalized.offsetX,
        offsetY: normalized.offsetY,
        cssVariables: freeze({
            '--ngvge-dock-offset-x': `${normalized.offsetX}px`,
            '--ngvge-dock-offset-y': `${normalized.offsetY}px`
        })
    });
};

class DockPlacementModel {
    constructor ({preference = DEFAULT_DOCK_PLACEMENT_PREFERENCE} = {}) {
        this.id = WORKSPACE_DOCK_PLACEMENT_MODEL_ID;
        this.schemaId = DOCK_PLACEMENT_PREFERENCE_SCHEMA_ID;
        this.schemaVersion = DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION;
        this._preference = normalizeDockPlacementPreference(preference);
        this._listeners = new Set();
        this._revision = 0;
    }

    get revision () {
        return this._revision;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Dock Placement Model listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit () {
        this._revision += 1;
        const event = freeze({
            modelId: this.id,
            revision: this._revision,
            type: 'dock:placement-changed',
            preference: this.getPreference()
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    getPreference () {
        return this._preference;
    }

    getProjection () {
        return freeze({
            revision: this._revision,
            ...projectDockGeometry(this._preference)
        });
    }

    setPreference (preference) {
        const next = normalizeDockPlacementPreference(preference);
        const previous = this._preference;
        if (previous.placement === next.placement &&
            previous.alignment === next.alignment &&
            previous.offsetX === next.offsetX &&
            previous.offsetY === next.offsetY) {
            return false;
        }
        this._preference = next;
        this._emit();
        return true;
    }

    patchPreference (patch) {
        if (!isPlainObject(patch)) {
            throw new TypeError('Dock placement preference patch must be a plain object.');
        }
        assertKnownPreferenceFields(patch, 'Dock placement preference patch');
        return this.setPreference({...this._preference, ...patch});
    }

    setPlacement (placement) {
        return this.patchPreference({placement});
    }

    setAlignment (alignment) {
        return this.patchPreference({alignment});
    }

    setOffsets ({offsetX = this._preference.offsetX, offsetY = this._preference.offsetY} = {}) {
        return this.patchPreference({offsetX, offsetY});
    }
}

export {
    WORKSPACE_DOCK_PLACEMENT_MODEL_ID,
    DOCK_PLACEMENT_PREFERENCE_SCHEMA_ID,
    DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION,
    DOCK_PLACEMENTS,
    DOCK_ALIGNMENTS,
    DEFAULT_DOCK_PLACEMENT_PREFERENCE,
    normalizeDockPlacementPreference,
    getDockOrientation,
    projectDockGeometry,
    DockPlacementModel
};
