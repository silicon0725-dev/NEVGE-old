const NATIVE_PAINT_HOST_ID = 'ngvge.native-paint-host@1';
const NATIVE_PAINT_PRESENTATION_ID = 'ngvge.paint-presentation.costume-tab@1';
const NATIVE_PAINT_HOST_SCHEMA_VERSION = 1;

const NATIVE_PAINT_MODES = Object.freeze({
    VECTOR: 'vector',
    BITMAP: 'bitmap',
    LEGACY_RASTER: 'legacy-raster'
});

const NATIVE_PAINT_EDITOR_MODES = Object.freeze({
    AUTO: 'auto',
    VECTOR: 'vector',
    BITMAP: 'bitmap',
    PIXEL: 'pixel',
    COMPATIBILITY: 'compatibility'
});

const BITMAP_DATA_FORMATS = new Set(['png', 'jpg', 'jpeg']);
const KNOWN_EDITOR_MODES = new Set(Object.values(NATIVE_PAINT_EDITOR_MODES));

const makeNativePaintHostError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const getCostumes = target => (
    target && typeof target.getCostumes === 'function' ?
        target.getCostumes() :
        (target && target.sprite && Array.isArray(target.sprite.costumes) ? target.sprite.costumes : [])
);

const normalizeDataFormatCandidate = value => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!normalized) return '';
    return normalized === 'jpeg' ? 'jpg' : normalized;
};

const readExtension = value => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    const dot = trimmed.lastIndexOf('.');
    if (dot < 0 || dot === trimmed.length - 1) return '';
    return normalizeDataFormatCandidate(trimmed.slice(dot + 1));
};

const resolveCostumeDataFormat = costume => {
    if (!costume || typeof costume !== 'object') return '';
    const directCandidates = [
        costume.dataFormat,
        costume.asset && costume.asset.dataFormat,
        costume.broken && costume.broken.asset && costume.broken.asset.dataFormat
    ];
    for (let index = 0; index < directCandidates.length; index++) {
        const format = normalizeDataFormatCandidate(directCandidates[index]);
        if (format) return format;
    }
    const extensionCandidates = [costume.md5, costume.md5ext, costume.assetId];
    for (let index = 0; index < extensionCandidates.length; index++) {
        const format = readExtension(extensionCandidates[index]);
        if (format) return format;
    }
    return '';
};

const resolveSourceMode = dataFormat => {
    if (dataFormat === 'svg') return NATIVE_PAINT_MODES.VECTOR;
    if (BITMAP_DATA_FORMATS.has(dataFormat)) return NATIVE_PAINT_MODES.BITMAP;
    return NATIVE_PAINT_MODES.LEGACY_RASTER;
};

const normalizeRequestedMode = requestedMode => {
    const normalized = typeof requestedMode === 'string' ? requestedMode.trim().toLowerCase() : '';
    if (!normalized) return NATIVE_PAINT_EDITOR_MODES.AUTO;
    if (!KNOWN_EDITOR_MODES.has(normalized)) {
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_EDITOR_MODE_INVALID',
            `Unknown Native Paint editor mode: ${normalized}`,
            TypeError
        );
    }
    return normalized;
};

const resolveRequestedPaintMode = (sourceMode, requestedMode) => {
    const requested = normalizeRequestedMode(requestedMode);
    if (requested === NATIVE_PAINT_EDITOR_MODES.AUTO) return sourceMode;
    if (requested === NATIVE_PAINT_EDITOR_MODES.COMPATIBILITY) return NATIVE_PAINT_MODES.LEGACY_RASTER;
    if (requested === NATIVE_PAINT_EDITOR_MODES.PIXEL) {
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_PIXEL_BACKEND_PENDING',
            'Pixel mode is reserved for the next Shared Raster Core stage and is not active yet.'
        );
    }
    if (requested === NATIVE_PAINT_EDITOR_MODES.VECTOR && sourceMode !== NATIVE_PAINT_MODES.VECTOR) {
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_MODE_INCOMPATIBLE',
            'Vector mode requires an SVG source. Convert the costume to vector content before opening the Vector backend.'
        );
    }
    if (requested === NATIVE_PAINT_EDITOR_MODES.BITMAP && sourceMode !== NATIVE_PAINT_MODES.BITMAP) {
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_MODE_INCOMPATIBLE',
            'Bitmap mode requires PNG/JPG source content. Convert the costume to bitmap content before opening Raster Core.'
        );
    }
    return requested;
};

const getModeAvailability = dataFormat => Object.freeze({
    vector: dataFormat === 'svg',
    bitmap: BITMAP_DATA_FORMATS.has(dataFormat),
    pixel: false,
    compatibility: true
});

const requireSession = session => {
    if (!session || typeof session.getState !== 'function' || typeof session.selectResource !== 'function') {
        throw new TypeError('Native Paint host requires an admitted Workspace Paint session.');
    }
    return session;
};

const requireAssetDatabase = assetDatabase => {
    if (!assetDatabase || typeof assetDatabase.getCostumeResourceId !== 'function' ||
        typeof assetDatabase.ensureCostumeResource !== 'function') {
        throw new TypeError('Native Paint host requires canonical costume Resource adoption support.');
    }
    return assetDatabase;
};

const normalizeSelection = (target, costumeIndex, requestedMode = NATIVE_PAINT_EDITOR_MODES.AUTO) => {
    if (!target || !target.isOriginal) {
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_TARGET_REQUIRED',
            'Native Paint requires an original Stage or Sprite target.'
        );
    }
    if (!Number.isInteger(costumeIndex) || costumeIndex < 0) {
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_COSTUME_INDEX_INVALID',
            'Native Paint requires a non-negative costume index.',
            TypeError
        );
    }
    const costume = getCostumes(target)[costumeIndex];
    if (!costume) {
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_COSTUME_NOT_FOUND',
            `Native Paint costume is unavailable at index ${costumeIndex}.`
        );
    }
    const dataFormat = resolveCostumeDataFormat(costume);
    const sourceMode = resolveSourceMode(dataFormat);
    const normalizedRequestedMode = normalizeRequestedMode(requestedMode);
    const mode = resolveRequestedPaintMode(sourceMode, normalizedRequestedMode);
    return {
        costume,
        costumeIndex,
        dataFormat,
        mode,
        modeAvailability: getModeAvailability(dataFormat),
        requestedMode: normalizedRequestedMode,
        sourceMode,
        target,
        targetId: target.id
    };
};

const createNativePaintHostBinding = ({paintSession, assetDatabase, onResourceSelectionChange}) => {
    const session = requireSession(paintSession);
    const resources = requireAssetDatabase(assetDatabase);
    const writeResourceSelection = typeof onResourceSelectionChange === 'function' ?
        onResourceSelectionChange : () => {};

    const getCurrentWorkingCopy = () => {
        const state = session.getState();
        return state && state.workingCopy ? state.workingCopy : null;
    };

    const assertSwitchAllowed = nextResourceId => {
        const workingCopy = getCurrentWorkingCopy();
        if (!workingCopy || !workingCopy.loaded || !workingCopy.dirty) return;
        if (nextResourceId && workingCopy.resourceId === nextResourceId) return;
        throw makeNativePaintHostError(
            'NGVGE_NATIVE_PAINT_DIRTY_SWITCH_BLOCKED',
            'Review, commit, or discard the current Paint working copy before switching costumes or editor modes.'
        );
    };

    const describeSelection = (target, costumeIndex, requestedMode = NATIVE_PAINT_EDITOR_MODES.AUTO) => {
        const selection = normalizeSelection(target, costumeIndex, requestedMode);
        const resourceId = selection.mode !== NATIVE_PAINT_MODES.LEGACY_RASTER ?
            resources.getCostumeResourceId(target, costumeIndex) : null;
        return Object.freeze({
            schemaVersion: NATIVE_PAINT_HOST_SCHEMA_VERSION,
            hostId: NATIVE_PAINT_HOST_ID,
            presentationId: NATIVE_PAINT_PRESENTATION_ID,
            targetId: selection.targetId,
            costumeIndex,
            dataFormat: selection.dataFormat,
            mode: selection.mode,
            modeAvailability: selection.modeAvailability,
            requestedMode: selection.requestedMode,
            sourceMode: selection.sourceMode,
            resourceId
        });
    };

    const syncSelection = (target, costumeIndex, requestedMode = NATIVE_PAINT_EDITOR_MODES.AUTO) => {
        const selection = normalizeSelection(target, costumeIndex, requestedMode);

        if (selection.mode === NATIVE_PAINT_MODES.LEGACY_RASTER) {
            assertSwitchAllowed(null);
            const state = session.getState();
            if (state.selectedResourceId) session.selectResource(null);
            writeResourceSelection(null);
            return describeSelection(target, costumeIndex, requestedMode);
        }

        const existingResourceId = resources.getCostumeResourceId(target, costumeIndex);
        assertSwitchAllowed(existingResourceId);
        const resourceId = existingResourceId || resources.ensureCostumeResource(target, costumeIndex);
        writeResourceSelection(resourceId);
        const state = session.getState();
        if (state.selectedResourceId !== resourceId) session.selectResource(resourceId);
        return Object.freeze({
            schemaVersion: NATIVE_PAINT_HOST_SCHEMA_VERSION,
            hostId: NATIVE_PAINT_HOST_ID,
            presentationId: NATIVE_PAINT_PRESENTATION_ID,
            targetId: selection.targetId,
            costumeIndex,
            dataFormat: selection.dataFormat,
            mode: selection.mode,
            modeAvailability: selection.modeAvailability,
            requestedMode: selection.requestedMode,
            sourceMode: selection.sourceMode,
            resourceId
        });
    };

    const canSwitchSelection = (target, costumeIndex, requestedMode = NATIVE_PAINT_EDITOR_MODES.AUTO) => {
        const selection = normalizeSelection(target, costumeIndex, requestedMode);
        const nextResourceId = selection.mode !== NATIVE_PAINT_MODES.LEGACY_RASTER ?
            resources.getCostumeResourceId(target, costumeIndex) : null;
        try {
            assertSwitchAllowed(nextResourceId);
            return true;
        } catch (error) {
            if (error && error.code === 'NGVGE_NATIVE_PAINT_DIRTY_SWITCH_BLOCKED') return false;
            throw error;
        }
    };

    return Object.freeze({
        id: NATIVE_PAINT_HOST_ID,
        schemaVersion: NATIVE_PAINT_HOST_SCHEMA_VERSION,
        presentationId: NATIVE_PAINT_PRESENTATION_ID,
        canSwitchSelection,
        describeSelection,
        syncSelection
    });
};

export {
    BITMAP_DATA_FORMATS,
    NATIVE_PAINT_HOST_ID,
    NATIVE_PAINT_PRESENTATION_ID,
    NATIVE_PAINT_HOST_SCHEMA_VERSION,
    NATIVE_PAINT_MODES,
    NATIVE_PAINT_EDITOR_MODES,
    createNativePaintHostBinding,
    resolveCostumeDataFormat
};
