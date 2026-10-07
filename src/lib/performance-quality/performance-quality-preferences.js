'use strict';

const PERFORMANCE_RENDER_QUALITY = Object.freeze({
    BALANCED: 'balanced',
    PERFORMANCE: 'performance',
    QUALITY: 'quality'
});

const PERFORMANCE_PHYSICS_QUALITY = Object.freeze({
    BALANCED: 'balanced',
    PERFORMANCE: 'performance',
    PRECISE: 'precise'
});

const PERFORMANCE_DEBUG_DETAIL = Object.freeze({
    BALANCED: 'balanced',
    FULL: 'full',
    LIGHT: 'light'
});

const RENDER_SETTINGS = Object.freeze({
    [PERFORMANCE_RENDER_QUALITY.PERFORMANCE]: Object.freeze({
        canvasScale: 0.5,
        maxRefreshHz: 20,
        tileMapRefreshHz: 20
    }),
    [PERFORMANCE_RENDER_QUALITY.BALANCED]: Object.freeze({
        canvasScale: 0.75,
        maxRefreshHz: 30,
        tileMapRefreshHz: 30
    }),
    [PERFORMANCE_RENDER_QUALITY.QUALITY]: Object.freeze({
        canvasScale: 1,
        maxRefreshHz: 60,
        tileMapRefreshHz: 60
    })
});

const PHYSICS_SETTINGS = Object.freeze({
    [PERFORMANCE_PHYSICS_QUALITY.PERFORMANCE]: Object.freeze({
        fixedHz: 30,
        maxCatchUpSteps: 2
    }),
    [PERFORMANCE_PHYSICS_QUALITY.BALANCED]: Object.freeze({
        fixedHz: 45,
        maxCatchUpSteps: 4
    }),
    [PERFORMANCE_PHYSICS_QUALITY.PRECISE]: Object.freeze({
        fixedHz: 60,
        maxCatchUpSteps: 8
    })
});

const DEBUG_SETTINGS = Object.freeze({
    [PERFORMANCE_DEBUG_DETAIL.LIGHT]: Object.freeze({maxCollisionDebugShapes: 300}),
    [PERFORMANCE_DEBUG_DETAIL.BALANCED]: Object.freeze({maxCollisionDebugShapes: 1000}),
    [PERFORMANCE_DEBUG_DETAIL.FULL]: Object.freeze({maxCollisionDebugShapes: 5000})
});

const stores = new WeakMap();
const validRender = new Set(Object.values(PERFORMANCE_RENDER_QUALITY));
const validPhysics = new Set(Object.values(PERFORMANCE_PHYSICS_QUALITY));
const validDebug = new Set(Object.values(PERFORMANCE_DEBUG_DETAIL));

const assertRuntime = runtime => {
    if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
        throw new TypeError('Performance quality preferences require a runtime object.');
    }
};

const createStore = () => {
    const listeners = new Set();
    let renderQuality = PERFORMANCE_RENDER_QUALITY.BALANCED;
    let physicsQuality = PERFORMANCE_PHYSICS_QUALITY.PRECISE;
    let debugDetail = PERFORMANCE_DEBUG_DETAIL.BALANCED;
    let revision = 0;
    const notify = change => {
        revision += 1;
        listeners.forEach(listener => listener(Object.freeze(Object.assign({revision}, change))));
    };
    const setValue = (kind, value) => {
        if (kind === 'render') {
            if (!validRender.has(value)) throw new TypeError(`Unknown render quality: ${value}`);
            if (renderQuality === value) return false;
            renderQuality = value;
        } else if (kind === 'physics') {
            if (!validPhysics.has(value)) throw new TypeError(`Unknown physics quality: ${value}`);
            if (physicsQuality === value) return false;
            physicsQuality = value;
        } else {
            if (!validDebug.has(value)) throw new TypeError(`Unknown debug detail: ${value}`);
            if (debugDetail === value) return false;
            debugDetail = value;
        }
        notify({kind, type: 'performance-quality-change', value});
        return true;
    };
    return Object.freeze({
        getDebugDetail: () => debugDetail,
        getDebugSettings: () => DEBUG_SETTINGS[debugDetail],
        getPhysicsQuality: () => physicsQuality,
        getPhysicsSettings: () => PHYSICS_SETTINGS[physicsQuality],
        getRenderQuality: () => renderQuality,
        getRenderSettings: () => RENDER_SETTINGS[renderQuality],
        getSnapshot: () => Object.freeze({
            debugDetail,
            debugSettings: DEBUG_SETTINGS[debugDetail],
            physicsQuality,
            physicsSettings: PHYSICS_SETTINGS[physicsQuality],
            renderQuality,
            renderSettings: RENDER_SETTINGS[renderQuality],
            revision
        }),
        setDebugDetail: value => setValue('debug', value),
        setPhysicsQuality: value => setValue('physics', value),
        setRenderQuality: value => setValue('render', value),
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

const getPerformanceQualityPreferences = runtime => {
    assertRuntime(runtime);
    if (!stores.has(runtime)) stores.set(runtime, createStore());
    return stores.get(runtime);
};

module.exports = {
    DEBUG_SETTINGS,
    PERFORMANCE_DEBUG_DETAIL,
    PERFORMANCE_PHYSICS_QUALITY,
    PERFORMANCE_RENDER_QUALITY,
    PHYSICS_SETTINGS,
    RENDER_SETTINGS,
    getPerformanceQualityPreferences
};
