const {
    SCENE_DATA_MODEL_CAPABILITY_ID,
    SCENE_DATA_SCHEMA_VERSION,
    VARIABLE_SCOPES,
    VARIABLE_TYPES
} = require('./constants');
const {
    UnsupportedSceneDataVersionError,
    cloneSerializable,
    createScene,
    createSceneProject,
    createSceneVariable,
    getSceneById,
    migrateSceneProject,
    normalizeSceneProject,
    validateSceneProject
} = require('./scene-data-model');
const {validatePersistentData} = require('../persistence/persistent-data');

const hasOwnData = value => Boolean(value) && typeof value === 'object' && Object.keys(value).length > 0;

const createSceneDataModelService = context => {
    const listeners = new Set();
    let status = {
        error: null,
        readOnly: false,
        schemaVersion: SCENE_DATA_SCHEMA_VERSION
    };

    const emit = change => listeners.forEach(listener => listener(change));
    const subscribeData = context && context.data && typeof context.data.subscribe === 'function' ?
        context.data.subscribe.bind(context.data) :
        context && context.manager && context.manager.moduleData &&
        typeof context.manager.moduleData.subscribe === 'function' ?
            context.manager.moduleData.subscribe.bind(context.manager.moduleData) : null;
    const unsubscribeData = subscribeData ? subscribeData(change => {
        if (change.moduleId !== context.moduleId) return;
        emit({change, type: 'data'});
    }) : () => {};

    const setStatus = patch => {
        const nextStatus = Object.assign({}, status, patch);
        const changed = Object.keys(nextStatus).some(key => nextStatus[key] !== status[key]) ||
            Object.keys(status).some(key => !Object.prototype.hasOwnProperty.call(nextStatus, key));
        if (!changed) return false;
        status = nextStatus;
        emit({status: cloneSerializable(status), type: 'status'});
        return true;
    };

    const readRawProject = () => context.data.get(null);

    const normalizeStoredProject = raw => {
        try {
            const normalized = normalizeSceneProject(raw);
            setStatus({error: null, readOnly: false, schemaVersion: SCENE_DATA_SCHEMA_VERSION});
            return normalized;
        } catch (error) {
            if (error instanceof UnsupportedSceneDataVersionError) {
                setStatus({
                    error: error.message,
                    readOnly: true,
                    schemaVersion: error.version
                });
                return null;
            }
            throw error;
        }
    };

    const ensureProject = () => {
        const raw = readRawProject();
        if (!hasOwnData(raw)) {
            const created = createSceneProject();
            context.data.set(created);
            setStatus({error: null, readOnly: false, schemaVersion: SCENE_DATA_SCHEMA_VERSION});
            return created;
        }
        const normalized = normalizeStoredProject(raw);
        if (!normalized) return null;
        if (JSON.stringify(raw) !== JSON.stringify(normalized)) context.data.set(normalized);
        return normalized;
    };

    const readProject = () => {
        const normalized = normalizeStoredProject(readRawProject());
        if (!normalized) {
            throw new UnsupportedSceneDataVersionError(status.schemaVersion);
        }
        return cloneSerializable(normalized);
    };

    const writeProject = value => {
        if (status.readOnly) {
            throw new Error('Scene data is read-only because it was created by a newer NGVGE version.');
        }
        const persistenceValidation = validatePersistentData(value);
        if (!persistenceValidation.valid) {
            const error = new Error(`Invalid persistent scene data: ${persistenceValidation.issues[0].message}`);
            error.code = 'SCENE_PERSISTENT_DATA_INVALID';
            error.validation = persistenceValidation;
            throw error;
        }
        const normalized = normalizeSceneProject(value);
        const validation = validateSceneProject(normalized);
        if (!validation.valid) {
            const error = new Error(`Invalid scene project: ${validation.errors[0].message}`);
            error.code = 'SCENE_DATA_VALIDATION_FAILED';
            error.validation = validation;
            throw error;
        }
        context.data.set(normalized);
        setStatus({error: null, readOnly: false, schemaVersion: SCENE_DATA_SCHEMA_VERSION});
        return cloneSerializable(normalized);
    };

    return Object.freeze({
        capabilityId: SCENE_DATA_MODEL_CAPABILITY_ID,
        constants: Object.freeze({
            schemaVersion: SCENE_DATA_SCHEMA_VERSION,
            variableScopes: VARIABLE_SCOPES,
            variableTypes: VARIABLE_TYPES
        }),
        createProject: createSceneProject,
        createScene,
        createVariable: createSceneVariable,
        dispose: () => {
            unsubscribeData();
            listeners.clear();
        },
        ensureProject,
        getSceneById,
        getStatus: () => cloneSerializable(status),
        migrateProject: migrateSceneProject,
        normalizeProject: normalizeSceneProject,
        readProject,
        readRawProject,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        validatePersistentProject: value => {
            const persistent = validatePersistentData(value);
            if (!persistent.valid) {
                return Object.freeze({
                    errors: persistent.issues,
                    persistentDataValid: false,
                    valid: false,
                    warnings: Object.freeze([])
                });
            }
            const validation = validateSceneProject(normalizeSceneProject(value));
            return Object.freeze(Object.assign({}, validation, {
                persistentDataValid: true
            }));
        },
        validateProject: validateSceneProject,
        writeProject
    });
};

module.exports = {
    createSceneDataModelService
};
