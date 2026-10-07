import React from 'react';
import renderer, {act} from 'react-test-renderer';

import PerformanceQualityToolbar from '../../../src/components/stage/performance-quality-toolbar.jsx';
import {
    PERFORMANCE_DEBUG_DETAIL,
    PERFORMANCE_PHYSICS_QUALITY,
    PERFORMANCE_RENDER_QUALITY,
    getPerformanceQualityPreferences
} from '../../../src/lib/performance-quality';

const mounted = [];
afterEach(() => {
    while (mounted.length) act(() => mounted.pop().unmount());
});

describe('WS-10N8-HF3 performance quality toolbar', () => {
    test('changes render, physics, and debug quality independently', () => {
        const runtime = {};
        const vm = {runtime};
        let component;
        act(() => { component = renderer.create(<PerformanceQualityToolbar vm={vm} />); });
        mounted.push(component);
        const renderSelect = component.root.findByProps({'aria-label': 'NGVGE render quality'});
        const physicsSelect = component.root.findByProps({'aria-label': 'NGVGE physics quality'});
        const debugSelect = component.root.findByProps({'aria-label': 'NGVGE debug detail'});
        act(() => { renderSelect.props.onChange({target: {value: PERFORMANCE_RENDER_QUALITY.PERFORMANCE}}); });
        act(() => { physicsSelect.props.onChange({target: {value: PERFORMANCE_PHYSICS_QUALITY.BALANCED}}); });
        act(() => { debugSelect.props.onChange({target: {value: PERFORMANCE_DEBUG_DETAIL.LIGHT}}); });
        const preferences = getPerformanceQualityPreferences(runtime);
        expect(preferences.getRenderSettings().canvasScale).toBe(0.5);
        expect(preferences.getPhysicsSettings().fixedHz).toBe(45);
        expect(preferences.getDebugSettings().maxCollisionDebugShapes).toBe(300);
    });
});
