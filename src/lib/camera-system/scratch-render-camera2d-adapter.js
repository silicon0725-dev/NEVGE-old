'use strict';

const CAMERA2D_RENDER_ADAPTER_ID = 'ngvge.scratch-render.camera2d-adapter';
const NATIVE_SIZE_EVENT = 'NativeSizeChanged';

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const createScratchRenderCamera2DAdapter = renderer => {
    if (!renderer || !renderer.exports || !renderer.exports.twgl || !renderer.exports.twgl.m4) {
        const error = new TypeError('Camera2D Scratch renderer adapter requires scratch-render with twgl exports.');
        error.code = 'NGVGE_CAMERA2D_RENDERER_UNAVAILABLE';
        throw error;
    }
    const m4 = renderer.exports.twgl.m4;
    const originalCulling = renderer.offscreenDrawableCulling;
    let disposed = false;
    let activeState = null;
    let applyCount = 0;

    const baseProjection = () => m4.ortho(
        Number.isFinite(renderer._xLeft) ? renderer._xLeft : -(renderer._nativeSize[0] / 2),
        Number.isFinite(renderer._xRight) ? renderer._xRight : (renderer._nativeSize[0] / 2),
        Number.isFinite(renderer._yBottom) ? renderer._yBottom : -(renderer._nativeSize[1] / 2),
        Number.isFinite(renderer._yTop) ? renderer._yTop : (renderer._nativeSize[1] / 2),
        -1,
        1
    );

    const buildProjection = state => {
        const base = baseProjection();
        if (!state || !state.activeCameraNodeId) return base;
        const position = state.position || [0, 0];
        const offset = state.offset || [0, 0];
        const zoom = state.zoom || [1, 1];
        const rotationRadians = -(Number(state.rotation) || 0) * Math.PI / 180;
        const translation = m4.translation([
            -(Number(position[0]) + Number(offset[0])),
            -(Number(position[1]) + Number(offset[1])),
            0
        ]);
        const rotation = m4.rotationZ(rotationRadians);
        const scale = m4.scaling([Number(zoom[0]) || 1, Number(zoom[1]) || 1, 1]);
        const view = m4.multiply(m4.multiply(scale, rotation), translation);
        return m4.multiply(base, view);
    };

    const applyViewport = state => {
        if (disposed) return false;
        activeState = state ? JSON.parse(JSON.stringify(state)) : null;
        renderer._projection = buildProjection(activeState);
        renderer.offscreenDrawableCulling = activeState && activeState.activeCameraNodeId ? false : originalCulling;
        renderer.dirty = true;
        if (typeof renderer.requestRedraw === 'function') renderer.requestRedraw();
        applyCount += 1;
        return true;
    };

    const handleNativeSizeChanged = () => {
        if (activeState && activeState.activeCameraNodeId) applyViewport(activeState);
    };
    if (typeof renderer.on === 'function') renderer.on(NATIVE_SIZE_EVENT, handleNativeSizeChanged);

    return Object.freeze({
        adapterId: CAMERA2D_RENDER_ADAPTER_ID,
        applyViewport,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            if (typeof renderer.removeListener === 'function') renderer.removeListener(NATIVE_SIZE_EVENT, handleNativeSizeChanged);
            renderer._projection = baseProjection();
            renderer.offscreenDrawableCulling = originalCulling;
            renderer.dirty = true;
            if (typeof renderer.requestRedraw === 'function') renderer.requestRedraw();
            activeState = null;
        },
        getStatus: () => deepFreeze({
            activeCameraNodeId: activeState ? activeState.activeCameraNodeId : null,
            applyCount,
            disposed
        })
    });
};

module.exports = {
    CAMERA2D_RENDER_ADAPTER_ID,
    createScratchRenderCamera2DAdapter
};
