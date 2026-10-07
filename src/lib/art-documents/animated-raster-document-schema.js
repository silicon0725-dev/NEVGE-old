import {assertCanonicalResourceId, assertStableSemanticId} from './art-document-identities';

const ANIMATED_RASTER_DOCUMENT_SCHEMA_ID = 'ngvge.animated-raster-document@1';
const ANIMATED_RASTER_DOCUMENT_SCHEMA_VERSION = 1;
const ANIMATED_RASTER_MODES = Object.freeze(['bitmap', 'pixel']);
const RASTER_COLOR_MODES = Object.freeze(['rgba', 'indexed']);
const RASTER_LAYER_TYPES = Object.freeze(['raster', 'group', 'mask']);
const CEL_CONTENT_KINDS = Object.freeze(['rgba-raster', 'indexed-raster']);
const CLIP_PLAYBACK_MODES = Object.freeze(['once', 'loop', 'ping-pong', 'reverse']);
const MARKER_KINDS = Object.freeze(['event', 'note']);
const SLICE_ROLES = Object.freeze(['generic', 'nine-slice', 'hitbox', 'hurtbox']);

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (isPlainObject(value)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const assertKnownFields = (source, fields, label) => {
    const unknown = Object.keys(source).filter(key => !fields.includes(key));
    if (unknown.length) throw new Error(`${label} contains unsupported field(s): ${unknown.join(', ')}`);
};

const assertEnum = (value, values, label) => {
    if (!values.includes(value)) throw new TypeError(`${label} must be one of: ${values.join(', ')}.`);
    return value;
};

const assertNonEmptyString = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
    return value.trim();
};

const normalizeOpacity = (value, label) => {
    const candidate = typeof value === 'undefined' ? 1 : value;
    if (!Number.isFinite(candidate) || candidate < 0 || candidate > 1) {
        throw new TypeError(`${label} must be a finite number between 0 and 1.`);
    }
    return candidate;
};

const normalizeInteger = (value, label, {min = 0} = {}) => {
    if (!Number.isInteger(value) || value < min) throw new TypeError(`${label} must be an integer >= ${min}.`);
    return value;
};

const normalizeFinite = (value, label) => {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
    return value;
};

const normalizeCanvas = value => {
    if (!isPlainObject(value)) throw new TypeError('Animated raster canvas must be an object.');
    assertKnownFields(value, ['width', 'height', 'colorMode'], 'Animated raster canvas');
    return {
        width: normalizeInteger(value.width, 'canvas.width', {min: 1}),
        height: normalizeInteger(value.height, 'canvas.height', {min: 1}),
        colorMode: assertEnum(value.colorMode, RASTER_COLOR_MODES, 'canvas.colorMode')
    };
};

const normalizeLayer = value => {
    if (!isPlainObject(value)) throw new TypeError('Animated raster layer must be an object.');
    assertKnownFields(
        value,
        ['layerId', 'name', 'type', 'parentLayerId', 'visible', 'locked', 'alphaLocked', 'opacity', 'blendMode', 'clipToLayerId', 'maskTargetLayerId'],
        'Animated raster layer'
    );
    return {
        layerId: assertStableSemanticId(value.layerId, 'layerId'),
        name: assertNonEmptyString(value.name, 'layer.name'),
        type: assertEnum(value.type, RASTER_LAYER_TYPES, 'layer.type'),
        parentLayerId: value.parentLayerId === null || typeof value.parentLayerId === 'undefined' ?
            null : assertStableSemanticId(value.parentLayerId, 'layerId'),
        visible: value.visible !== false,
        locked: Boolean(value.locked),
        alphaLocked: Boolean(value.alphaLocked),
        opacity: normalizeOpacity(value.opacity, 'layer.opacity'),
        blendMode: typeof value.blendMode === 'undefined' ? 'normal' : assertNonEmptyString(value.blendMode, 'layer.blendMode'),
        clipToLayerId: value.clipToLayerId === null || typeof value.clipToLayerId === 'undefined' ?
            null : assertStableSemanticId(value.clipToLayerId, 'layerId'),
        maskTargetLayerId: value.maskTargetLayerId === null || typeof value.maskTargetLayerId === 'undefined' ?
            null : assertStableSemanticId(value.maskTargetLayerId, 'layerId')
    };
};

const normalizeFrame = value => {
    if (!isPlainObject(value)) throw new TypeError('Animation frame must be an object.');
    assertKnownFields(value, ['frameId', 'durationMs'], 'Animation frame');
    return {
        frameId: assertStableSemanticId(value.frameId, 'frameId'),
        durationMs: normalizeInteger(value.durationMs, 'frame.durationMs', {min: 1})
    };
};

const normalizeCelContent = value => {
    if (!isPlainObject(value)) throw new TypeError('Cel content descriptor must be an object.');
    assertKnownFields(value, ['contentId', 'kind'], 'Cel content descriptor');
    return {
        contentId: assertStableSemanticId(value.contentId, 'contentId'),
        kind: assertEnum(value.kind, CEL_CONTENT_KINDS, 'celContent.kind')
    };
};

const normalizeCel = value => {
    if (!isPlainObject(value)) throw new TypeError('Animation cel must be an object.');
    assertKnownFields(value, ['celId', 'layerId', 'frameId', 'contentId', 'x', 'y', 'opacity'], 'Animation cel');
    return {
        celId: assertStableSemanticId(value.celId, 'celId'),
        layerId: assertStableSemanticId(value.layerId, 'layerId'),
        frameId: assertStableSemanticId(value.frameId, 'frameId'),
        contentId: assertStableSemanticId(value.contentId, 'contentId'),
        x: typeof value.x === 'undefined' ? 0 : normalizeFinite(value.x, 'cel.x'),
        y: typeof value.y === 'undefined' ? 0 : normalizeFinite(value.y, 'cel.y'),
        opacity: normalizeOpacity(value.opacity, 'cel.opacity')
    };
};

const normalizeClip = value => {
    if (!isPlainObject(value)) throw new TypeError('Animation clip must be an object.');
    assertKnownFields(
        value,
        ['clipId', 'name', 'startFrameId', 'endFrameId', 'playbackMode', 'loopCount'],
        'Animation clip'
    );
    let loopCount = value.loopCount;
    if (loopCount === null || typeof loopCount === 'undefined') loopCount = null;
    else loopCount = normalizeInteger(loopCount, 'clip.loopCount', {min: 1});
    return {
        clipId: assertStableSemanticId(value.clipId, 'clipId'),
        name: assertNonEmptyString(value.name, 'clip.name'),
        startFrameId: assertStableSemanticId(value.startFrameId, 'frameId'),
        endFrameId: assertStableSemanticId(value.endFrameId, 'frameId'),
        playbackMode: assertEnum(value.playbackMode, CLIP_PLAYBACK_MODES, 'clip.playbackMode'),
        loopCount
    };
};

const normalizePortableJson = (value, label) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError(`${label} numbers must be finite.`);
        return value;
    }
    if (Array.isArray(value)) return value.map((entry, index) => normalizePortableJson(entry, `${label}[${index}]`));
    if (isPlainObject(value)) {
        const result = {};
        Object.keys(value).forEach(key => {
            result[key] = normalizePortableJson(value[key], `${label}.${key}`);
        });
        return result;
    }
    throw new TypeError(`${label} must contain portable JSON values only.`);
};

const normalizeMarker = value => {
    if (!isPlainObject(value)) throw new TypeError('Animation marker must be an object.');
    assertKnownFields(value, ['markerId', 'frameId', 'offsetMs', 'kind', 'name', 'payload'], 'Animation marker');
    const payload = typeof value.payload === 'undefined' ? null : value.payload;
    if (payload !== null && !isPlainObject(payload)) throw new TypeError('marker.payload must be a plain object or null.');
    return {
        markerId: assertStableSemanticId(value.markerId, 'markerId'),
        frameId: assertStableSemanticId(value.frameId, 'frameId'),
        offsetMs: typeof value.offsetMs === 'undefined' ? 0 : normalizeInteger(value.offsetMs, 'marker.offsetMs'),
        kind: assertEnum(value.kind, MARKER_KINDS, 'marker.kind'),
        name: assertNonEmptyString(value.name, 'marker.name'),
        payload: payload === null ? null : normalizePortableJson(payload, 'marker.payload')
    };
};

const normalizePalette = value => {
    if (value === null || typeof value === 'undefined') return null;
    if (!isPlainObject(value)) throw new TypeError('Palette must be an object or null.');
    assertKnownFields(value, ['paletteId', 'storage', 'resourceId', 'entries'], 'Palette');
    const storage = assertEnum(value.storage, ['embedded', 'resource'], 'palette.storage');
    const entries = Array.isArray(value.entries) ? value.entries.map(entry => {
        if (!isPlainObject(entry)) throw new TypeError('Palette entry must be an object.');
        assertKnownFields(entry, ['entryId', 'index', 'rgba'], 'Palette entry');
        if (!isPlainObject(entry.rgba)) throw new TypeError('Palette entry rgba must be an object.');
        assertKnownFields(entry.rgba, ['r', 'g', 'b', 'a'], 'Palette entry rgba');
        const normalizeChannel = (channel, label) => normalizeInteger(channel, label, {min: 0});
        const rgba = {
            r: normalizeChannel(entry.rgba.r, 'palette.r'),
            g: normalizeChannel(entry.rgba.g, 'palette.g'),
            b: normalizeChannel(entry.rgba.b, 'palette.b'),
            a: normalizeChannel(entry.rgba.a, 'palette.a')
        };
        Object.values(rgba).forEach(channel => {
            if (channel > 255) throw new TypeError('Palette RGBA channels must be <= 255.');
        });
        return {
            entryId: assertStableSemanticId(entry.entryId, 'paletteEntryId'),
            index: normalizeInteger(entry.index, 'palette.index'),
            rgba
        };
    }) : [];
    if (entries.length > 256) throw new Error('Embedded Palette v1 supports at most 256 entries.');
    const indexes = new Set();
    entries.forEach(entry => {
        if (entry.index > 255) throw new Error('Palette entry index must be <= 255.');
        if (indexes.has(entry.index)) throw new Error(`Duplicate Palette index: ${entry.index}`);
        indexes.add(entry.index);
    });
    const resourceId = value.resourceId === null || typeof value.resourceId === 'undefined' ? null :
        assertCanonicalResourceId(value.resourceId);
    if (storage === 'resource' && !resourceId) throw new Error('Resource-backed Palette requires canonical resourceId.');
    if (storage === 'resource' && entries.length) {
        throw new Error('Resource-backed Palette must not duplicate palette entries in the document.');
    }
    if (storage === 'embedded' && resourceId) throw new Error('Embedded Palette must not declare resourceId.');
    return {
        paletteId: assertStableSemanticId(value.paletteId, 'paletteId'),
        storage,
        resourceId,
        entries
    };
};

const normalizeBounds = (value, label) => {
    if (!isPlainObject(value)) throw new TypeError(`${label} must be an object.`);
    assertKnownFields(value, ['x', 'y', 'width', 'height'], label);
    return {
        x: normalizeFinite(value.x, `${label}.x`),
        y: normalizeFinite(value.y, `${label}.y`),
        width: normalizeInteger(value.width, `${label}.width`, {min: 1}),
        height: normalizeInteger(value.height, `${label}.height`, {min: 1})
    };
};

const normalizePoint = (value, label) => {
    if (value === null || typeof value === 'undefined') return null;
    if (!isPlainObject(value)) throw new TypeError(`${label} must be an object or null.`);
    assertKnownFields(value, ['x', 'y'], label);
    return {x: normalizeFinite(value.x, `${label}.x`), y: normalizeFinite(value.y, `${label}.y`)};
};

const normalizeSlice = value => {
    if (!isPlainObject(value)) throw new TypeError('Slice must be an object.');
    assertKnownFields(value, ['sliceId', 'name', 'role', 'keys'], 'Slice');
    if (!Array.isArray(value.keys) || value.keys.length < 1) throw new TypeError('Slice keys must be a non-empty array.');
    return {
        sliceId: assertStableSemanticId(value.sliceId, 'sliceId'),
        name: assertNonEmptyString(value.name, 'slice.name'),
        role: assertEnum(value.role, SLICE_ROLES, 'slice.role'),
        keys: value.keys.map(key => {
            if (!isPlainObject(key)) throw new TypeError('Slice key must be an object.');
            assertKnownFields(key, ['frameId', 'bounds', 'pivot', 'center'], 'Slice key');
            return {
                frameId: key.frameId === null || typeof key.frameId === 'undefined' ?
                    null : assertStableSemanticId(key.frameId, 'frameId'),
                bounds: normalizeBounds(key.bounds, 'slice.bounds'),
                pivot: normalizePoint(key.pivot, 'slice.pivot'),
                center: key.center === null || typeof key.center === 'undefined' ? null : normalizeBounds(key.center, 'slice.center')
            };
        })
    };
};

const assertUniqueBy = (items, key, label) => {
    const seen = new Set();
    items.forEach(item => {
        if (seen.has(item[key])) throw new Error(`Duplicate ${label}: ${item[key]}`);
        seen.add(item[key]);
    });
};

const assertLayerGraph = layers => {
    const byId = new Map(layers.map(layer => [layer.layerId, layer]));
    layers.forEach(layer => {
        if (layer.parentLayerId && !byId.has(layer.parentLayerId)) {
            throw new Error(`Layer ${layer.layerId} references missing parent ${layer.parentLayerId}.`);
        }
        if (layer.parentLayerId && byId.get(layer.parentLayerId).type !== 'group') {
            throw new Error(`Layer ${layer.layerId} parent must be a group layer.`);
        }
        if (layer.clipToLayerId) {
            const clipTarget = byId.get(layer.clipToLayerId);
            if (!clipTarget || clipTarget.type === 'group') {
                throw new Error(`Layer ${layer.layerId} clip target must be an existing raster/mask layer.`);
            }
        }
        if (layer.type === 'mask') {
            const maskTarget = byId.get(layer.maskTargetLayerId);
            if (!maskTarget || maskTarget.type === 'group') {
                throw new Error(`Mask layer ${layer.layerId} requires an existing raster/mask target.`);
            }
        } else if (layer.maskTargetLayerId) {
            throw new Error(`Only mask layers may declare maskTargetLayerId (${layer.layerId}).`);
        }
        const visited = new Set([layer.layerId]);
        let cursor = layer.parentLayerId;
        while (cursor) {
            if (visited.has(cursor)) throw new Error(`Layer hierarchy contains a cycle at ${cursor}.`);
            visited.add(cursor);
            cursor = byId.get(cursor).parentLayerId;
        }
    });
};

const validateRelations = document => {
    const layerById = new Map(document.layers.map(layer => [layer.layerId, layer]));
    const frameIndex = new Map(document.frames.map((frame, index) => [frame.frameId, index]));
    const contentById = new Map(document.celContents.map(content => [content.contentId, content]));
    const celSlots = new Set();

    document.cels.forEach(cel => {
        const layer = layerById.get(cel.layerId);
        if (!layer) throw new Error(`Cel ${cel.celId} references missing layer ${cel.layerId}.`);
        if (layer.type === 'group') throw new Error(`Cel ${cel.celId} cannot target group layer ${cel.layerId}.`);
        if (!frameIndex.has(cel.frameId)) throw new Error(`Cel ${cel.celId} references missing frame ${cel.frameId}.`);
        const content = contentById.get(cel.contentId);
        if (!content) throw new Error(`Cel ${cel.celId} references missing content ${cel.contentId}.`);
        const expectedKind = document.canvas.colorMode === 'indexed' ? 'indexed-raster' : 'rgba-raster';
        if (content.kind !== expectedKind) {
            throw new Error(`Cel content ${content.contentId} kind ${content.kind} does not match ${document.canvas.colorMode}.`);
        }
        const slot = `${cel.layerId}#${cel.frameId}`;
        if (celSlots.has(slot)) throw new Error(`Multiple cels occupy layer/frame slot ${slot}.`);
        celSlots.add(slot);
    });

    document.clips.forEach(clip => {
        if (!frameIndex.has(clip.startFrameId) || !frameIndex.has(clip.endFrameId)) {
            throw new Error(`Animation clip ${clip.clipId} references missing frame.`);
        }
        if (frameIndex.get(clip.startFrameId) > frameIndex.get(clip.endFrameId)) {
            throw new Error(`Animation clip ${clip.clipId} start frame must not follow its end frame.`);
        }
    });

    const frameById = new Map(document.frames.map(frame => [frame.frameId, frame]));
    document.markers.forEach(marker => {
        const frame = frameById.get(marker.frameId);
        if (!frame) throw new Error(`Animation marker ${marker.markerId} references missing frame ${marker.frameId}.`);
        if (marker.offsetMs >= frame.durationMs) {
            throw new Error(`Animation marker ${marker.markerId} offset must be inside its frame duration.`);
        }
    });

    document.slices.forEach(slice => slice.keys.forEach(key => {
        if (key.frameId && !frameIndex.has(key.frameId)) {
            throw new Error(`Slice ${slice.sliceId} references missing frame ${key.frameId}.`);
        }
        if (slice.role === 'nine-slice' && !key.center) {
            throw new Error(`Nine-slice ${slice.sliceId} requires center bounds.`);
        }
    }));

    if (document.canvas.colorMode === 'indexed' && !document.palette) {
        throw new Error('Indexed animated raster document requires a Palette semantic owner.');
    }
};

const DOCUMENT_FIELDS = Object.freeze([
    'schemaId', 'schemaVersion', 'documentId', 'resourceId', 'mode', 'canvas',
    'layers', 'frames', 'celContents', 'cels', 'clips', 'markers', 'palette', 'slices'
]);

const normalizeAnimatedRasterDocument = value => {
    if (!isPlainObject(value)) throw new TypeError('Animated raster document must be an object.');
    assertKnownFields(value, DOCUMENT_FIELDS, 'Animated raster document');
    if (value.schemaId !== ANIMATED_RASTER_DOCUMENT_SCHEMA_ID) {
        throw new Error(`Unsupported animated raster schema id: ${String(value.schemaId)}`);
    }
    if (value.schemaVersion !== ANIMATED_RASTER_DOCUMENT_SCHEMA_VERSION) {
        throw new Error(`Unsupported animated raster schema version: ${String(value.schemaVersion)}`);
    }
    const document = {
        schemaId: ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
        schemaVersion: ANIMATED_RASTER_DOCUMENT_SCHEMA_VERSION,
        documentId: assertStableSemanticId(value.documentId, 'documentId'),
        resourceId: assertCanonicalResourceId(value.resourceId),
        mode: assertEnum(value.mode, ANIMATED_RASTER_MODES, 'document.mode'),
        canvas: normalizeCanvas(value.canvas),
        layers: Array.isArray(value.layers) ? value.layers.map(normalizeLayer) : [],
        frames: Array.isArray(value.frames) ? value.frames.map(normalizeFrame) : [],
        celContents: Array.isArray(value.celContents) ? value.celContents.map(normalizeCelContent) : [],
        cels: Array.isArray(value.cels) ? value.cels.map(normalizeCel) : [],
        clips: Array.isArray(value.clips) ? value.clips.map(normalizeClip) : [],
        markers: Array.isArray(value.markers) ? value.markers.map(normalizeMarker) : [],
        palette: normalizePalette(value.palette),
        slices: Array.isArray(value.slices) ? value.slices.map(normalizeSlice) : []
    };
    if (!document.layers.length) throw new Error('Animated raster document requires at least one layer.');
    if (!document.frames.length) throw new Error('Animated raster document requires at least one frame.');
    assertUniqueBy(document.layers, 'layerId', 'LayerId');
    assertUniqueBy(document.frames, 'frameId', 'FrameId');
    assertUniqueBy(document.celContents, 'contentId', 'CelContentId');
    assertUniqueBy(document.cels, 'celId', 'CelId');
    assertUniqueBy(document.clips, 'clipId', 'ClipId');
    assertUniqueBy(document.markers, 'markerId', 'MarkerId');
    assertUniqueBy(document.slices, 'sliceId', 'SliceId');
    if (document.palette) assertUniqueBy(document.palette.entries, 'entryId', 'PaletteEntryId');
    assertLayerGraph(document.layers);
    validateRelations(document);
    return freezeDeep(document);
};

export {
    ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
    ANIMATED_RASTER_DOCUMENT_SCHEMA_VERSION,
    ANIMATED_RASTER_MODES,
    RASTER_COLOR_MODES,
    RASTER_LAYER_TYPES,
    CEL_CONTENT_KINDS,
    CLIP_PLAYBACK_MODES,
    MARKER_KINDS,
    SLICE_ROLES,
    normalizeAnimatedRasterDocument
};
