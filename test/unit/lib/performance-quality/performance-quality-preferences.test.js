'use strict';

const {
    PERFORMANCE_DEBUG_DETAIL,
    PERFORMANCE_PHYSICS_QUALITY,
    PERFORMANCE_RENDER_QUALITY,
    getPerformanceQualityPreferences
} = require('../../../../src/lib/performance-quality');

describe('WS-10N8-HF3 performance quality preferences', () => {
    test('keeps execution quality separate from project semantics and exposes deterministic presets', () => {
        const runtime = {};
        const preferences = getPerformanceQualityPreferences(runtime);
        expect(preferences.getRenderQuality()).toBe(PERFORMANCE_RENDER_QUALITY.BALANCED);
        expect(preferences.getRenderSettings()).toEqual({canvasScale: 0.75, maxRefreshHz: 30, tileMapRefreshHz: 30});
        expect(preferences.getPhysicsQuality()).toBe(PERFORMANCE_PHYSICS_QUALITY.PRECISE);
        expect(preferences.getPhysicsSettings()).toEqual({fixedHz: 60, maxCatchUpSteps: 8});
        expect(preferences.getDebugDetail()).toBe(PERFORMANCE_DEBUG_DETAIL.BALANCED);
        expect(preferences.getDebugSettings()).toEqual({maxCollisionDebugShapes: 1000});
    });

    test('publishes independent render, physics, and debug quality changes', () => {
        const runtime = {};
        const preferences = getPerformanceQualityPreferences(runtime);
        const changes = [];
        const unsubscribe = preferences.subscribe(change => changes.push(change));
        expect(preferences.setRenderQuality(PERFORMANCE_RENDER_QUALITY.PERFORMANCE)).toBe(true);
        expect(preferences.setPhysicsQuality(PERFORMANCE_PHYSICS_QUALITY.PERFORMANCE)).toBe(true);
        expect(preferences.setDebugDetail(PERFORMANCE_DEBUG_DETAIL.LIGHT)).toBe(true);
        expect(preferences.getRenderSettings()).toMatchObject({canvasScale: 0.5, maxRefreshHz: 20});
        expect(preferences.getPhysicsSettings()).toEqual({fixedHz: 30, maxCatchUpSteps: 2});
        expect(preferences.getDebugSettings()).toEqual({maxCollisionDebugShapes: 300});
        expect(changes.map(change => change.kind)).toEqual(['render', 'physics', 'debug']);
        unsubscribe();
    });
});
