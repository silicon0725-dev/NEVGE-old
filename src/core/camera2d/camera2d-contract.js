'use strict';

const {createEngineCommand} = require('../protocol');

const CAMERA2D_TYPE_ID = 'ngvge.camera2d';
const CAMERA2D_SCHEMA_VERSION = 1;
const CAMERA2D_COMPONENT_OWNER = 'ngvge.scene-system';
const CAMERA2D_PATCH_COMMAND_TYPE = 'PatchCamera2D';
const CAMERA2D_PATCH_APPLIED_EVENT_TYPE = 'Camera2DPatchApplied';
const CAMERA2D_DEFAULT_PRIORITY = 0;
const CAMERA2D_MIN_ZOOM = 0.01;
const CAMERA2D_MAX_ZOOM = 100;

const CAMERA2D_DEFAULT_DATA = Object.freeze({
    enabled: true,
    offset: Object.freeze([0, 0]),
    priority: CAMERA2D_DEFAULT_PRIORITY,
    zoom: Object.freeze([1, 1])
});

const CAMERA2D_CONTRACT = Object.freeze({
    componentOwner: CAMERA2D_COMPONENT_OWNER,
    coordinateSpace: Object.freeze({
        cameraPositionSource: 'Transform2D.position',
        cameraRotationSource: 'Transform2D.rotation',
        offsetSpace: 'world',
        screenOrigin: 'viewport-center',
        zoomMeaning: 'larger-values-magnify'
    }),
    contractId: 'ngvge.camera2d-contract',
    contractVersion: '1',
    persistence: Object.freeze({
        nativeProject: '.ne',
        scratchProjection: 'native-only'
    }),
    runtimeAuthority: Object.freeze({
        activeCameraSelection: 'enabled-highest-priority-stable-node-id',
        backendHandlePersistent: false,
        componentTypeId: CAMERA2D_TYPE_ID,
        viewportSingleSourceOfTruth: 'Camera2DRuntimeService.viewportState'
    }),
    schemaVersion: CAMERA2D_SCHEMA_VERSION,
    typeId: CAMERA2D_TYPE_ID
});

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const finiteNumber = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const normalizeVec2 = (value, fallback) => {
    const source = Array.isArray(value) && value.length === 2 ? value : fallback;
    return [finiteNumber(source[0], fallback[0]), finiteNumber(source[1], fallback[1])];
};

const normalizeZoom = value => normalizeVec2(value, CAMERA2D_DEFAULT_DATA.zoom).map(number => (
    Math.max(CAMERA2D_MIN_ZOOM, Math.min(CAMERA2D_MAX_ZOOM, Math.abs(number)))
));

const normalizeCamera2D = value => {
    const source = isPlainObject(value) ? value : {};
    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : CAMERA2D_DEFAULT_DATA.enabled,
        offset: normalizeVec2(source.offset, CAMERA2D_DEFAULT_DATA.offset),
        priority: Math.trunc(finiteNumber(source.priority, CAMERA2D_DEFAULT_PRIORITY)),
        zoom: normalizeZoom(source.zoom)
    };
};

const CAMERA2D_PATCH_FIELDS = new Set(['enabled', 'offset', 'priority', 'zoom']);

const normalizeCamera2DPatch = value => {
    if (!isPlainObject(value)) {
        const error = new TypeError('Camera2D patch must be a plain portable object.');
        error.code = 'NGVGE_CAMERA2D_PATCH_INVALID';
        throw error;
    }
    const unsupported = Object.keys(value).filter(key => !CAMERA2D_PATCH_FIELDS.has(key));
    if (unsupported.length) {
        const error = new TypeError(`Camera2D patch contains unsupported field(s): ${unsupported.join(', ')}`);
        error.code = 'NGVGE_CAMERA2D_PATCH_FIELD_UNSUPPORTED';
        error.fields = unsupported;
        throw error;
    }
    if (!Object.keys(value).length) {
        const error = new TypeError('Camera2D patch must change at least one field.');
        error.code = 'NGVGE_CAMERA2D_PATCH_EMPTY';
        throw error;
    }
    const result = {};
    if (Object.prototype.hasOwnProperty.call(value, 'enabled')) {
        if (typeof value.enabled !== 'boolean') {
            const error = new TypeError('Camera2D enabled must be boolean.');
            error.code = 'NGVGE_CAMERA2D_ENABLED_INVALID';
            throw error;
        }
        result.enabled = value.enabled;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'offset')) {
        if (!Array.isArray(value.offset) || value.offset.length !== 2 || value.offset.some(item => !Number.isFinite(Number(item)))) {
            const error = new TypeError('Camera2D offset must contain exactly two finite numbers.');
            error.code = 'NGVGE_CAMERA2D_OFFSET_INVALID';
            throw error;
        }
        result.offset = value.offset.map(Number);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'priority')) {
        if (!Number.isFinite(Number(value.priority))) {
            const error = new TypeError('Camera2D priority must be finite.');
            error.code = 'NGVGE_CAMERA2D_PRIORITY_INVALID';
            throw error;
        }
        result.priority = Math.trunc(Number(value.priority));
    }
    if (Object.prototype.hasOwnProperty.call(value, 'zoom')) {
        if (!Array.isArray(value.zoom) || value.zoom.length !== 2 || value.zoom.some(item => !Number.isFinite(Number(item)))) {
            const error = new TypeError('Camera2D zoom must contain exactly two finite numbers.');
            error.code = 'NGVGE_CAMERA2D_ZOOM_INVALID';
            throw error;
        }
        result.zoom = normalizeZoom(value.zoom);
    }
    return result;
};


const createCamera2DPatchComponentCommand = ({componentId, nodeId, patch}) => createEngineCommand(
    CAMERA2D_PATCH_COMMAND_TYPE,
    {
        componentId,
        nodeId,
        patch: normalizeCamera2DPatch(patch)
    }
);

const applyCamera2DPatch = (current, patch) => normalizeCamera2D(Object.assign(
    {},
    normalizeCamera2D(current),
    normalizeCamera2DPatch(patch)
));

module.exports = {
    CAMERA2D_COMPONENT_OWNER,
    CAMERA2D_CONTRACT,
    CAMERA2D_DEFAULT_DATA,
    CAMERA2D_MAX_ZOOM,
    CAMERA2D_MIN_ZOOM,
    CAMERA2D_PATCH_APPLIED_EVENT_TYPE,
    CAMERA2D_PATCH_COMMAND_TYPE,
    CAMERA2D_SCHEMA_VERSION,
    CAMERA2D_TYPE_ID,
    applyCamera2DPatch,
    createCamera2DPatchComponentCommand,
    normalizeCamera2D,
    normalizeCamera2DPatch
};
