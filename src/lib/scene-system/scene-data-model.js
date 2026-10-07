const {
    SCENE_DATA_SCHEMA_VERSION,
    SCENE_ID_PREFIX,
    SCENE_SNAPSHOT_ENCODING,
    SCENE_SNAPSHOT_FORMAT,
    SCENE_SNAPSHOT_SCHEMA_VERSION,
    SCENE_VARIABLE_ID_PREFIX,
    SCENE_VARIABLE_SCHEMA_VERSION,
    VARIABLE_TYPES
} = require('./constants');
const {clonePersistentData} = require('../persistence/persistent-data');
const {createId} = require('./id');

const DEFAULT_SCENE_NAME = 'Scene 1';
const DEFAULT_VARIABLE_NAME = 'Variable';

class UnsupportedSceneDataVersionError extends Error {
    constructor (version) {
        super(`Scene data schema version ${version} is newer than supported version ${SCENE_DATA_SCHEMA_VERSION}.`);
        this.code = 'SCENE_DATA_VERSION_UNSUPPORTED';
        this.name = 'UnsupportedSceneDataVersionError';
        this.version = version;
    }
}

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneSerializable = value => {
    if (value === null || typeof value === 'undefined') return value;
    return clonePersistentData(value);
};

const createFactoryValue = (factory, prefix) => {
    const generated = typeof factory === 'function' ? factory() : createId(prefix);
    if (typeof generated !== 'string' || !generated.trim()) {
        throw new TypeError('Scene data id factories must return a non-empty string.');
    }
    return generated.trim();
};

const normalizeName = (name, fallback) => (
    typeof name === 'string' && name.trim() ? name.trim() : fallback
);

const normalizeExtensionData = value => (
    isObject(value) ? cloneSerializable(value) : {}
);

const normalizeTimestamp = value => (
    typeof value === 'string' && value.trim() && !Number.isNaN(Date.parse(value)) ? value.trim() : null
);

const normalizeVariableValue = (type, value) => {
    if (type === VARIABLE_TYPES.LIST) {
        return Array.isArray(value) ? cloneSerializable(value) : [];
    }
    if (Array.isArray(value) || isObject(value) || typeof value === 'undefined') return '';
    return value;
};

const createSceneVariable = (options = {}) => {
    const type = Object.values(VARIABLE_TYPES).includes(options.type) ?
        options.type : VARIABLE_TYPES.SCALAR;
    return {
        extensionData: normalizeExtensionData(options.extensionData),
        id: typeof options.id === 'string' && options.id.trim() ?
            options.id.trim() : createFactoryValue(options.idFactory, SCENE_VARIABLE_ID_PREFIX),
        name: normalizeName(options.name, DEFAULT_VARIABLE_NAME),
        type,
        value: normalizeVariableValue(type, options.value)
    };
};

const normalizeSceneVariables = (value, options = {}) => {
    const source = isObject(value) ? value : {};
    const sourceItems = Array.isArray(source.items) ? source.items : (
        Array.isArray(value) ? value : []
    );
    const ids = new Set();
    const items = sourceItems.map((item, index) => {
        const sourceItem = isObject(item) ? item : {};
        let variable = createSceneVariable(Object.assign({}, sourceItem, {
            idFactory: options.variableIdFactory,
            name: normalizeName(sourceItem.name, `Variable ${index + 1}`)
        }));
        if (ids.has(variable.id)) {
            variable = Object.assign({}, variable, {
                id: createFactoryValue(options.variableIdFactory, SCENE_VARIABLE_ID_PREFIX)
            });
        }
        ids.add(variable.id);
        return variable;
    });
    return {
        items,
        schemaVersion: SCENE_VARIABLE_SCHEMA_VERSION
    };
};

const createScene = (options = {}) => ({
    extensionData: normalizeExtensionData(options.extensionData),
    id: typeof options.id === 'string' && options.id.trim() ?
        options.id.trim() : createFactoryValue(options.idFactory, SCENE_ID_PREFIX),
    metadata: {
        color: options.metadata && typeof options.metadata.color === 'string' ? options.metadata.color : null,
        createdAt: normalizeTimestamp(options.metadata && options.metadata.createdAt),
        tags: options.metadata && Array.isArray(options.metadata.tags) ?
            options.metadata.tags.filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean) : [],
        thumbnailAssetId: options.metadata && typeof options.metadata.thumbnailAssetId === 'string' ?
            options.metadata.thumbnailAssetId : null,
        updatedAt: normalizeTimestamp(options.metadata && options.metadata.updatedAt)
    },
    name: normalizeName(options.name, DEFAULT_SCENE_NAME),
    snapshot: isObject(options.snapshot) ? cloneSerializable(options.snapshot) : null,
    variables: normalizeSceneVariables(options.variables, options)
});

const getInputVersion = value => {
    if (!isObject(value)) return 0;
    if (Number.isInteger(value.schemaVersion)) return value.schemaVersion;
    if (Number.isInteger(value.version)) return value.version;
    return 0;
};

const migrateVersionZero = value => {
    const source = isObject(value) ? value : {};
    const scenes = Array.isArray(source.scenes) ? source.scenes : (
        Array.isArray(source.sceneList) ? source.sceneList : []
    );
    return {
        activeSceneId: source.activeSceneId || source.currentSceneId || null,
        extensionData: normalizeExtensionData(source.extensionData),
        scenes: scenes.map(scene => {
            const item = isObject(scene) ? scene : {};
            return {
                extensionData: normalizeExtensionData(item.extensionData),
                id: item.id || item.sceneId || null,
                metadata: item.metadata || {},
                name: item.name,
                snapshot: item.snapshot || null,
                variables: item.variables || item.sceneVariables || []
            };
        }),
        schemaVersion: SCENE_DATA_SCHEMA_VERSION,
        startupSceneId: source.startupSceneId || source.entrySceneId || source.activeSceneId ||
            source.currentSceneId || null
    };
};

const migrateSceneProject = value => {
    const version = getInputVersion(value);
    if (version > SCENE_DATA_SCHEMA_VERSION) throw new UnsupportedSceneDataVersionError(version);
    if (version <= 0) return migrateVersionZero(value);
    return cloneSerializable(value);
};

const normalizeSceneProject = (value, options = {}) => {
    const migrated = migrateSceneProject(value);
    const sourceScenes = Array.isArray(migrated.scenes) ? migrated.scenes : [];
    const sceneIds = new Set();
    const scenes = sourceScenes.map((scene, index) => {
        const sourceScene = isObject(scene) ? scene : {};
        let normalized = createScene(Object.assign({}, sourceScene, {
            idFactory: options.sceneIdFactory,
            name: normalizeName(sourceScene.name, `Scene ${index + 1}`),
            variableIdFactory: options.variableIdFactory
        }));
        if (sceneIds.has(normalized.id)) {
            normalized = Object.assign({}, normalized, {
                id: createFactoryValue(options.sceneIdFactory, SCENE_ID_PREFIX)
            });
        }
        sceneIds.add(normalized.id);
        return normalized;
    });

    if (!scenes.length && options.createDefaultScene !== false) {
        const scene = createScene({
            idFactory: options.sceneIdFactory,
            name: normalizeName(options.defaultSceneName, DEFAULT_SCENE_NAME),
            variableIdFactory: options.variableIdFactory
        });
        scenes.push(scene);
        sceneIds.add(scene.id);
    }

    const firstSceneId = scenes.length ? scenes[0].id : null;
    const activeSceneId = sceneIds.has(migrated.activeSceneId) ? migrated.activeSceneId : firstSceneId;
    const startupSceneId = sceneIds.has(migrated.startupSceneId) ? migrated.startupSceneId : activeSceneId;

    return {
        activeSceneId,
        extensionData: normalizeExtensionData(migrated.extensionData),
        scenes,
        schemaVersion: SCENE_DATA_SCHEMA_VERSION,
        startupSceneId
    };
};

const createSceneProject = (options = {}) => normalizeSceneProject({
    activeSceneId: options.activeSceneId || null,
    extensionData: normalizeExtensionData(options.extensionData),
    scenes: Array.isArray(options.scenes) ? options.scenes : [],
    schemaVersion: SCENE_DATA_SCHEMA_VERSION,
    startupSceneId: options.startupSceneId || null
}, options);

const addIssue = (issues, code, path, message) => {
    issues.push({code, message, path});
};

const validateSceneVariable = (variable, path, errors) => {
    if (!isObject(variable)) {
        addIssue(errors, 'variable.invalid', path, 'Scene variable must be an object.');
        return;
    }
    if (typeof variable.id !== 'string' || !variable.id.trim()) {
        addIssue(errors, 'variable.id.required', `${path}.id`, 'Scene variable id is required.');
    }
    if (typeof variable.name !== 'string' || !variable.name.trim()) {
        addIssue(errors, 'variable.name.required', `${path}.name`, 'Scene variable name is required.');
    }
    if (!Object.values(VARIABLE_TYPES).includes(variable.type)) {
        addIssue(errors, 'variable.type.invalid', `${path}.type`, 'Scene variable type is invalid.');
    } else if (variable.type === VARIABLE_TYPES.LIST && !Array.isArray(variable.value)) {
        addIssue(errors, 'variable.value.list-required', `${path}.value`, 'List variables require an array value.');
    } else if (variable.type === VARIABLE_TYPES.SCALAR && (Array.isArray(variable.value) || isObject(variable.value))) {
        addIssue(errors, 'variable.value.scalar-required', `${path}.value`,
            'Scalar variables require a primitive value.');
    }
};

const validateSceneProject = value => {
    const errors = [];
    const warnings = [];
    if (!isObject(value)) {
        addIssue(errors, 'project.invalid', '$', 'Scene project must be an object.');
        return {errors, valid: false, warnings};
    }
    if (value.schemaVersion !== SCENE_DATA_SCHEMA_VERSION) {
        addIssue(errors, 'project.version.invalid', '$.schemaVersion',
            `Scene project schemaVersion must be ${SCENE_DATA_SCHEMA_VERSION}.`);
    }
    if (!Array.isArray(value.scenes) || !value.scenes.length) {
        addIssue(errors, 'project.scenes.required', '$.scenes', 'Scene project must contain at least one scene.');
        return {errors, valid: false, warnings};
    }

    const sceneIds = new Set();
    value.scenes.forEach((scene, sceneIndex) => {
        const path = `$.scenes[${sceneIndex}]`;
        if (!isObject(scene)) {
            addIssue(errors, 'scene.invalid', path, 'Scene must be an object.');
            return;
        }
        if (typeof scene.id !== 'string' || !scene.id.trim()) {
            addIssue(errors, 'scene.id.required', `${path}.id`, 'Scene id is required.');
        } else if (sceneIds.has(scene.id)) {
            addIssue(errors, 'scene.id.duplicate', `${path}.id`, `Duplicate scene id: ${scene.id}`);
        } else {
            sceneIds.add(scene.id);
        }
        if (typeof scene.name !== 'string' || !scene.name.trim()) {
            addIssue(errors, 'scene.name.required', `${path}.name`, 'Scene name is required.');
        }
        if (!isObject(scene.metadata)) {
            addIssue(errors, 'scene.metadata.invalid', `${path}.metadata`, 'Scene metadata must be an object.');
        } else {
            ['createdAt', 'updatedAt'].forEach(field => {
                const timestamp = scene.metadata[field];
                if (timestamp !== null && (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp)))) {
                    addIssue(errors, `scene.metadata.${field}.invalid`, `${path}.metadata.${field}`,
                        `Scene metadata ${field} must be an ISO-compatible timestamp or null.`);
                }
            });
        }
        if (scene.snapshot !== null && !isObject(scene.snapshot)) {
            addIssue(errors, 'scene.snapshot.invalid', `${path}.snapshot`, 'Scene snapshot must be an object or null.');
        } else if (isObject(scene.snapshot)) {
            const legacy = scene.snapshot.schemaVersion === 1 &&
                scene.snapshot.format === 'ngvge-sb3-scene' && scene.snapshot.encoding === 'base64';
            const current = scene.snapshot.schemaVersion === SCENE_SNAPSHOT_SCHEMA_VERSION &&
                scene.snapshot.format === SCENE_SNAPSHOT_FORMAT &&
                scene.snapshot.encoding === SCENE_SNAPSHOT_ENCODING;
            if (!legacy && !current) {
                addIssue(errors, 'scene.snapshot.version.invalid', `${path}.snapshot`,
                    'Scene snapshot is not a supported legacy or current snapshot envelope.');
            } else if (legacy && (typeof scene.snapshot.archive !== 'string' || !scene.snapshot.archive.length)) {
                addIssue(errors, 'scene.snapshot.archive.required', `${path}.snapshot.archive`,
                    'Legacy scene snapshot archive is required.');
            } else if (current && (typeof scene.snapshot.payload !== 'string' || !scene.snapshot.payload.length)) {
                addIssue(errors, 'scene.snapshot.payload.required', `${path}.snapshot.payload`,
                    'Scene snapshot portable payload is required.');
            }
        }
        if (!isObject(scene.variables) || scene.variables.schemaVersion !== SCENE_VARIABLE_SCHEMA_VERSION ||
            !Array.isArray(scene.variables.items)) {
            addIssue(errors, 'scene.variables.invalid', `${path}.variables`, 'Scene variables collection is invalid.');
        } else {
            const variableIds = new Set();
            scene.variables.items.forEach((variable, variableIndex) => {
                const variablePath = `${path}.variables.items[${variableIndex}]`;
                validateSceneVariable(variable, variablePath, errors);
                if (isObject(variable) && typeof variable.id === 'string' && variable.id.trim()) {
                    if (variableIds.has(variable.id)) {
                        addIssue(errors, 'variable.id.duplicate', `${variablePath}.id`,
                            `Duplicate scene variable id: ${variable.id}`);
                    }
                    variableIds.add(variable.id);
                }
            });
        }
    });

    if (!sceneIds.has(value.activeSceneId)) {
        addIssue(errors, 'project.active-scene.missing', '$.activeSceneId',
            'activeSceneId must reference an existing scene.');
    }
    if (!sceneIds.has(value.startupSceneId)) {
        addIssue(errors, 'project.startup-scene.missing', '$.startupSceneId',
            'startupSceneId must reference an existing scene.');
    }
    if (value.activeSceneId !== value.startupSceneId) {
        addIssue(warnings, 'project.startup-scene.different', '$.startupSceneId',
            'The startup scene differs from the scene currently open in the editor.');
    }

    return {
        errors,
        valid: errors.length === 0,
        warnings
    };
};

const getSceneById = (project, sceneId) => {
    if (!project || !Array.isArray(project.scenes)) return null;
    return project.scenes.find(scene => scene.id === sceneId) || null;
};

module.exports = {
    UnsupportedSceneDataVersionError,
    cloneSerializable,
    createScene,
    createSceneProject,
    createSceneVariable,
    getSceneById,
    migrateSceneProject,
    normalizeSceneProject,
    normalizeSceneVariables,
    validateSceneProject
};
