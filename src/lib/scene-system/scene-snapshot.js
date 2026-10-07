const {
    FIRST_PARTY_MODULE_PROJECT_SECTION_ID,
    LEGACY_SCENE_SNAPSHOT_ENCODING,
    LEGACY_SCENE_SNAPSHOT_FORMAT,
    LEGACY_SCENE_SNAPSHOT_SCHEMA_VERSION,
    SCENE_SNAPSHOT_ENCODING,
    SCENE_SNAPSHOT_FORMAT,
    SCENE_SNAPSHOT_SCHEMA_VERSION
} = require('./constants');
const {cloneSerializable} = require('./scene-data-model');

class UnsupportedSceneSnapshotVersionError extends Error {
    constructor (version) {
        super(
            `Scene snapshot schema version ${version} is newer than supported version ` +
            `${SCENE_SNAPSHOT_SCHEMA_VERSION}.`
        );
        this.code = 'SCENE_SNAPSHOT_VERSION_UNSUPPORTED';
        this.name = 'UnsupportedSceneSnapshotVersionError';
        this.version = version;
    }
}

class SceneSnapshotValidationError extends Error {
    constructor (validation) {
        const first = validation && validation.errors && validation.errors[0];
        super(first ? first.message : 'Invalid scene snapshot.');
        this.code = 'SCENE_SNAPSHOT_VALIDATION_FAILED';
        this.name = 'SceneSnapshotValidationError';
        this.validation = validation;
    }
}

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const addIssue = (issues, code, path, message) => issues.push({code, message, path});

const estimateBase64ByteLength = base64 => {
    if (typeof base64 !== 'string' || !base64.length) return 0;
    const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const estimateTextByteLength = text => {
    if (typeof text !== 'string') return 0;
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
    if (typeof globalThis !== 'undefined' && globalThis.Buffer) return globalThis.Buffer.byteLength(text, 'utf8');
    return text.length;
};

const sanitizeProjectJSONForSceneSnapshot = value => {
    const projectJSON = cloneSerializable(value);
    if (!isObject(projectJSON)) return projectJSON;
    const ngvge = projectJSON.ngvge;
    if (!isObject(ngvge) || !isObject(ngvge.projectSections)) return projectJSON;
    delete ngvge.projectSections[FIRST_PARTY_MODULE_PROJECT_SECTION_ID];
    if (!Object.keys(ngvge.projectSections).length) delete ngvge.projectSections;
    const remainingKeys = Object.keys(ngvge).filter(key => key !== 'version');
    if (!remainingKeys.length) delete projectJSON.ngvge;
    return projectJSON;
};

const isLegacySceneSnapshot = value => Boolean(value &&
    value.schemaVersion === LEGACY_SCENE_SNAPSHOT_SCHEMA_VERSION &&
    value.format === LEGACY_SCENE_SNAPSHOT_FORMAT &&
    value.encoding === LEGACY_SCENE_SNAPSHOT_ENCODING);

const createSceneSnapshot = (options = {}) => {
    const payload = typeof options.payload === 'string' ? options.payload : '';
    const metadata = isObject(options.metadata) ? cloneSerializable(options.metadata) : {};
    const snapshot = {
        byteLength: Number.isInteger(options.byteLength) && options.byteLength >= 0 ?
            options.byteLength : estimateTextByteLength(payload),
        encoding: SCENE_SNAPSHOT_ENCODING,
        format: SCENE_SNAPSHOT_FORMAT,
        metadata,
        payload,
        schemaVersion: SCENE_SNAPSHOT_SCHEMA_VERSION
    };
    const validation = validateSceneSnapshot(snapshot);
    if (!validation.valid) throw new SceneSnapshotValidationError(validation);
    return snapshot;
};

const validateSceneSnapshot = value => {
    const errors = [];
    const warnings = [];
    if (!isObject(value)) {
        addIssue(errors, 'snapshot.invalid', '$', 'Scene snapshot must be an object.');
        return {errors, valid: false, warnings};
    }
    if (!Number.isInteger(value.schemaVersion)) {
        addIssue(errors, 'snapshot.version.required', '$.schemaVersion', 'Scene snapshot schemaVersion is required.');
        return {errors, valid: false, warnings};
    }
    if (value.schemaVersion > SCENE_SNAPSHOT_SCHEMA_VERSION) {
        addIssue(errors, 'snapshot.version.unsupported', '$.schemaVersion',
            `Scene snapshot schemaVersion ${value.schemaVersion} is newer than supported version ` +
            `${SCENE_SNAPSHOT_SCHEMA_VERSION}.`);
        return {errors, valid: false, warnings};
    }

    if (isLegacySceneSnapshot(value)) {
        if (typeof value.archive !== 'string' || !value.archive.length) {
            addIssue(errors, 'snapshot.archive.required', '$.archive', 'Legacy scene snapshot archive is required.');
        }
        if (!Number.isInteger(value.byteLength) || value.byteLength < 0) {
            addIssue(errors, 'snapshot.byte-length.invalid', '$.byteLength',
                'Scene snapshot byteLength must be a non-negative integer.');
        }
        if (!isObject(value.metadata)) {
            addIssue(errors, 'snapshot.metadata.invalid', '$.metadata', 'Scene snapshot metadata must be an object.');
        }
        warnings.push({
            code: 'snapshot.legacy',
            message: 'Legacy SB3 archive scene snapshot will be migrated on next capture.',
            path: '$'
        });
        return {errors, valid: errors.length === 0, warnings};
    }

    if (value.schemaVersion !== SCENE_SNAPSHOT_SCHEMA_VERSION) {
        addIssue(errors, 'snapshot.version.invalid', '$.schemaVersion',
            `Scene snapshot schemaVersion must be ${SCENE_SNAPSHOT_SCHEMA_VERSION}.`);
    }
    if (value.format !== SCENE_SNAPSHOT_FORMAT) {
        addIssue(errors, 'snapshot.format.invalid', '$.format',
            `Scene snapshot format must be ${SCENE_SNAPSHOT_FORMAT}.`);
    }
    if (value.encoding !== SCENE_SNAPSHOT_ENCODING) {
        addIssue(errors, 'snapshot.encoding.invalid', '$.encoding',
            `Scene snapshot encoding must be ${SCENE_SNAPSHOT_ENCODING}.`);
    }
    if (typeof value.payload !== 'string' || !value.payload.length) {
        addIssue(errors, 'snapshot.payload.required', '$.payload', 'Scene snapshot portable payload is required.');
    }
    if (!Number.isInteger(value.byteLength) || value.byteLength < 0) {
        addIssue(errors, 'snapshot.byte-length.invalid', '$.byteLength',
            'Scene snapshot byteLength must be a non-negative integer.');
    }
    if (!isObject(value.metadata)) {
        addIssue(errors, 'snapshot.metadata.invalid', '$.metadata', 'Scene snapshot metadata must be an object.');
    }
    return {errors, valid: errors.length === 0, warnings};
};

const assertSupportedSceneSnapshot = value => {
    if (isObject(value) && Number.isInteger(value.schemaVersion) &&
        value.schemaVersion > SCENE_SNAPSHOT_SCHEMA_VERSION) {
        throw new UnsupportedSceneSnapshotVersionError(value.schemaVersion);
    }
    const validation = validateSceneSnapshot(value);
    if (!validation.valid) throw new SceneSnapshotValidationError(validation);
    return cloneSerializable(value);
};

module.exports = {
    SceneSnapshotValidationError,
    UnsupportedSceneSnapshotVersionError,
    assertSupportedSceneSnapshot,
    createSceneSnapshot,
    estimateBase64ByteLength,
    estimateTextByteLength,
    isLegacySceneSnapshot,
    sanitizeProjectJSONForSceneSnapshot,
    validateSceneSnapshot
};
