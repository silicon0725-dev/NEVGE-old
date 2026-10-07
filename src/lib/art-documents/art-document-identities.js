const ART_DOCUMENT_ID_PREFIX = 'ngvge:art-document:';
const ART_LAYER_ID_PREFIX = 'ngvge:art-layer:';
const ANIMATION_FRAME_ID_PREFIX = 'ngvge:animation-frame:';
const ANIMATION_CEL_ID_PREFIX = 'ngvge:animation-cel:';
const CEL_CONTENT_ID_PREFIX = 'ngvge:cel-content:';
const ANIMATION_CLIP_ID_PREFIX = 'ngvge:animation-clip:';
const ANIMATION_MARKER_ID_PREFIX = 'ngvge:animation-marker:';
const PALETTE_ID_PREFIX = 'ngvge:palette:';
const PALETTE_ENTRY_ID_PREFIX = 'ngvge:palette-entry:';
const SLICE_ID_PREFIX = 'ngvge:slice:';

const ID_PREFIXES = Object.freeze({
    documentId: ART_DOCUMENT_ID_PREFIX,
    layerId: ART_LAYER_ID_PREFIX,
    frameId: ANIMATION_FRAME_ID_PREFIX,
    celId: ANIMATION_CEL_ID_PREFIX,
    contentId: CEL_CONTENT_ID_PREFIX,
    clipId: ANIMATION_CLIP_ID_PREFIX,
    markerId: ANIMATION_MARKER_ID_PREFIX,
    paletteId: PALETTE_ID_PREFIX,
    paletteEntryId: PALETTE_ENTRY_ID_PREFIX,
    sliceId: SLICE_ID_PREFIX
});

const assertStableSemanticId = (value, kind) => {
    const prefix = ID_PREFIXES[kind];
    if (!prefix) throw new TypeError(`Unknown NGVGE art semantic identity kind: ${String(kind)}`);
    if (typeof value !== 'string' || !value.startsWith(prefix) || value.length <= prefix.length) {
        throw new TypeError(`${kind} must be a stable ${prefix}* identifier.`);
    }
    return value;
};

const assertCanonicalResourceId = value => {
    if (typeof value !== 'string' || !value.startsWith('ngvge:resource:') || value.length <= 'ngvge:resource:'.length) {
        throw new TypeError('Art document resourceId must be a canonical ngvge:resource:* identifier.');
    }
    return value;
};

export {
    ART_DOCUMENT_ID_PREFIX,
    ART_LAYER_ID_PREFIX,
    ANIMATION_FRAME_ID_PREFIX,
    ANIMATION_CEL_ID_PREFIX,
    CEL_CONTENT_ID_PREFIX,
    ANIMATION_CLIP_ID_PREFIX,
    ANIMATION_MARKER_ID_PREFIX,
    PALETTE_ID_PREFIX,
    PALETTE_ENTRY_ID_PREFIX,
    SLICE_ID_PREFIX,
    assertStableSemanticId,
    assertCanonicalResourceId
};
