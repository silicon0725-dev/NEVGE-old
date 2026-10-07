'use strict';

const {createEngineCommand} = require('../protocol');

const CHARACTER_CONTROLLER2D_TYPE_ID = 'ngvge.character-controller2d';
const CHARACTER_CONTROLLER2D_SCHEMA_VERSION = 1;
const CHARACTER_CONTROLLER2D_COMPONENT_OWNER = 'ngvge.scene-system';
const CHARACTER_CONTROLLER2D_PATCH_COMMAND_TYPE = 'PatchCharacterController2D';
const CHARACTER_CONTROLLER2D_PATCH_APPLIED_EVENT_TYPE = 'CharacterController2DPatchApplied';
const CHARACTER_CONTROLLER2D_MIN_SAFE_MARGIN = 0;
const CHARACTER_CONTROLLER2D_MAX_SAFE_MARGIN = 16;
const CHARACTER_CONTROLLER2D_MAX_SLIDES_LIMIT = 16;
const CHARACTER_CONTROLLER2D_MAX_STEP_HEIGHT = 256;
const CHARACTER_CONTROLLER2D_MAX_SNAP_LENGTH = 256;
const CHARACTER_CONTROLLER2D_MAX_SLOPE_DEGREES = 89.9;

const CHARACTER_CONTROLLER2D_DEFAULT_DATA = Object.freeze({
    floorSnapLength: 6,
    maxSlides: 4,
    maxSlopeDegrees: 45,
    safeMargin: 0.01,
    stepHeight: 0,
    upDirection: Object.freeze([0, 1])
});

const CHARACTER_CONTROLLER2D_CONTRACT = Object.freeze({
    componentOwner: CHARACTER_CONTROLLER2D_COMPONENT_OWNER,
    contractId: 'ngvge.character-controller2d-contract',
    contractVersion: '1',
    identity: Object.freeze({
        backendHandlePersistent: false,
        controllerIdSource: 'Runtime ComponentId',
        nodeIdIsControllerId: false
    }),
    movement: Object.freeze({
        colliderSource: 'ngvge.collider2d',
        contactSeparation: 'safeMargin + runtime contact slop',
        floorClassification: 'surface-normal-dot-up-direction >= cos(maxSlopeDegrees)',
        fullRigidBodyRequired: false,
        runtimeTransformWriter: 'Transform2DRuntimeStore',
        solidColliderRequired: true,
        stableSurfaceSelection: 'alignment + previous-contact stability',
        velocityPersistence: 'runtime-only'
    }),
    persistence: Object.freeze({
        nativeProject: '.ne',
        scratchProjection: 'native-only'
    }),
    runtimeState: Object.freeze({
        contactsPersistent: false,
        floorNormalPersistent: false,
        lastSafeTransformPersistent: false,
        recoveryPersistent: false,
        velocityPersistent: false,
        wallNormalPersistent: false
    }),
    schemaVersion: CHARACTER_CONTROLLER2D_SCHEMA_VERSION,
    stepAndSnap: Object.freeze({
        floorSnap: 'implemented',
        movingPlatformTranslationCarry: 'implemented',
        stepFoundation: 'basic-translation-step'
    }),
    typeId: CHARACTER_CONTROLLER2D_TYPE_ID
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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeDirection = (value, fallback) => {
    const source = Array.isArray(value) && value.length === 2 ? value : fallback;
    const x = finiteNumber(source[0], fallback[0]);
    const y = finiteNumber(source[1], fallback[1]);
    const length = Math.hypot(x, y);
    if (length <= Number.EPSILON) return fallback.slice();
    return [x / length, y / length];
};

const normalizeCharacterController2D = value => {
    const source = isPlainObject(value) ? value : {};
    return {
        floorSnapLength: clamp(
            Math.max(0, finiteNumber(source.floorSnapLength, CHARACTER_CONTROLLER2D_DEFAULT_DATA.floorSnapLength)),
            0,
            CHARACTER_CONTROLLER2D_MAX_SNAP_LENGTH
        ),
        maxSlides: clamp(
            Math.trunc(finiteNumber(source.maxSlides, CHARACTER_CONTROLLER2D_DEFAULT_DATA.maxSlides)),
            1,
            CHARACTER_CONTROLLER2D_MAX_SLIDES_LIMIT
        ),
        maxSlopeDegrees: clamp(
            finiteNumber(source.maxSlopeDegrees, CHARACTER_CONTROLLER2D_DEFAULT_DATA.maxSlopeDegrees),
            0,
            CHARACTER_CONTROLLER2D_MAX_SLOPE_DEGREES
        ),
        safeMargin: clamp(
            Math.max(0, finiteNumber(source.safeMargin, CHARACTER_CONTROLLER2D_DEFAULT_DATA.safeMargin)),
            CHARACTER_CONTROLLER2D_MIN_SAFE_MARGIN,
            CHARACTER_CONTROLLER2D_MAX_SAFE_MARGIN
        ),
        stepHeight: clamp(
            Math.max(0, finiteNumber(source.stepHeight, CHARACTER_CONTROLLER2D_DEFAULT_DATA.stepHeight)),
            0,
            CHARACTER_CONTROLLER2D_MAX_STEP_HEIGHT
        ),
        upDirection: normalizeDirection(source.upDirection, CHARACTER_CONTROLLER2D_DEFAULT_DATA.upDirection)
    };
};

const CHARACTER_CONTROLLER2D_PATCH_FIELDS = new Set([
    'floorSnapLength',
    'maxSlides',
    'maxSlopeDegrees',
    'safeMargin',
    'stepHeight',
    'upDirection'
]);

const assertFiniteNumber = (value, field) => {
    if (!Number.isFinite(Number(value))) {
        const error = new TypeError(`CharacterController2D ${field} must be finite.`);
        error.code = `NGVGE_CHARACTER_CONTROLLER2D_${field.toUpperCase()}_INVALID`;
        throw error;
    }
    return Number(value);
};

const normalizeCharacterController2DPatch = value => {
    if (!isPlainObject(value)) {
        const error = new TypeError('CharacterController2D patch must be a plain portable object.');
        error.code = 'NGVGE_CHARACTER_CONTROLLER2D_PATCH_INVALID';
        throw error;
    }
    const unsupported = Object.keys(value).filter(key => !CHARACTER_CONTROLLER2D_PATCH_FIELDS.has(key));
    if (unsupported.length) {
        const error = new TypeError(
            `CharacterController2D patch contains unsupported field(s): ${unsupported.join(', ')}`
        );
        error.code = 'NGVGE_CHARACTER_CONTROLLER2D_PATCH_FIELD_UNSUPPORTED';
        error.fields = unsupported;
        throw error;
    }
    if (!Object.keys(value).length) {
        const error = new TypeError('CharacterController2D patch must change at least one field.');
        error.code = 'NGVGE_CHARACTER_CONTROLLER2D_PATCH_EMPTY';
        throw error;
    }

    const result = {};
    if (Object.prototype.hasOwnProperty.call(value, 'floorSnapLength')) {
        const number = assertFiniteNumber(value.floorSnapLength, 'floor_snap_length');
        if (number < 0 || number > CHARACTER_CONTROLLER2D_MAX_SNAP_LENGTH) {
            throw Object.assign(new RangeError('CharacterController2D floorSnapLength is out of range.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_FLOOR_SNAP_LENGTH_OUT_OF_RANGE'
            });
        }
        result.floorSnapLength = number;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'maxSlides')) {
        const number = assertFiniteNumber(value.maxSlides, 'max_slides');
        const integer = Math.trunc(number);
        if (integer < 1 || integer > CHARACTER_CONTROLLER2D_MAX_SLIDES_LIMIT) {
            throw Object.assign(new RangeError('CharacterController2D maxSlides is out of range.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_MAX_SLIDES_OUT_OF_RANGE'
            });
        }
        result.maxSlides = integer;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'maxSlopeDegrees')) {
        const number = assertFiniteNumber(value.maxSlopeDegrees, 'max_slope_degrees');
        if (number < 0 || number > CHARACTER_CONTROLLER2D_MAX_SLOPE_DEGREES) {
            throw Object.assign(new RangeError('CharacterController2D maxSlopeDegrees is out of range.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_MAX_SLOPE_OUT_OF_RANGE'
            });
        }
        result.maxSlopeDegrees = number;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'safeMargin')) {
        const number = assertFiniteNumber(value.safeMargin, 'safe_margin');
        if (number < CHARACTER_CONTROLLER2D_MIN_SAFE_MARGIN || number > CHARACTER_CONTROLLER2D_MAX_SAFE_MARGIN) {
            throw Object.assign(new RangeError('CharacterController2D safeMargin is out of range.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_SAFE_MARGIN_OUT_OF_RANGE'
            });
        }
        result.safeMargin = number;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'stepHeight')) {
        const number = assertFiniteNumber(value.stepHeight, 'step_height');
        if (number < 0 || number > CHARACTER_CONTROLLER2D_MAX_STEP_HEIGHT) {
            throw Object.assign(new RangeError('CharacterController2D stepHeight is out of range.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_STEP_HEIGHT_OUT_OF_RANGE'
            });
        }
        result.stepHeight = number;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'upDirection')) {
        if (!Array.isArray(value.upDirection) || value.upDirection.length !== 2 ||
            value.upDirection.some(item => !Number.isFinite(Number(item)))) {
            throw Object.assign(new TypeError('CharacterController2D upDirection must contain two finite numbers.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_UP_DIRECTION_INVALID'
            });
        }
        const x = Number(value.upDirection[0]);
        const y = Number(value.upDirection[1]);
        if (Math.hypot(x, y) <= Number.EPSILON) {
            throw Object.assign(new TypeError('CharacterController2D upDirection cannot be zero.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_UP_DIRECTION_ZERO'
            });
        }
        result.upDirection = normalizeDirection([x, y], CHARACTER_CONTROLLER2D_DEFAULT_DATA.upDirection);
    }
    return result;
};

const applyCharacterController2DPatch = (current, patch) => normalizeCharacterController2D(Object.assign(
    {},
    normalizeCharacterController2D(current),
    normalizeCharacterController2DPatch(patch)
));

const createCharacterController2DPatchComponentCommand = ({componentId, nodeId, patch}) => createEngineCommand(
    CHARACTER_CONTROLLER2D_PATCH_COMMAND_TYPE,
    {
        componentId,
        nodeId,
        patch: normalizeCharacterController2DPatch(patch)
    }
);

module.exports = {
    CHARACTER_CONTROLLER2D_COMPONENT_OWNER,
    CHARACTER_CONTROLLER2D_CONTRACT,
    CHARACTER_CONTROLLER2D_DEFAULT_DATA,
    CHARACTER_CONTROLLER2D_MAX_SAFE_MARGIN,
    CHARACTER_CONTROLLER2D_MAX_SLIDES_LIMIT,
    CHARACTER_CONTROLLER2D_MAX_SLOPE_DEGREES,
    CHARACTER_CONTROLLER2D_MAX_SNAP_LENGTH,
    CHARACTER_CONTROLLER2D_MAX_STEP_HEIGHT,
    CHARACTER_CONTROLLER2D_PATCH_APPLIED_EVENT_TYPE,
    CHARACTER_CONTROLLER2D_PATCH_COMMAND_TYPE,
    CHARACTER_CONTROLLER2D_SCHEMA_VERSION,
    CHARACTER_CONTROLLER2D_TYPE_ID,
    applyCharacterController2DPatch,
    createCharacterController2DPatchComponentCommand,
    normalizeCharacterController2D,
    normalizeCharacterController2DPatch
};
