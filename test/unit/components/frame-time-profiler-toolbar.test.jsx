import React from 'react';
import renderer, {act} from 'react-test-renderer';
import EventEmitter from 'events';

import FrameTimeProfilerToolbar from '../../../src/components/stage/frame-time-profiler-toolbar.jsx';
import {getFrameTimeProfiler} from '../../../src/lib/frame-profiler';

const mounted = [];
afterEach(() => {
    while (mounted.length) act(() => mounted.pop().unmount());
});

describe('WS-10N8-HF4 frame-time profiler toolbar', () => {
    test('starts and stops diagnostic capture without changing project state', () => {
        const runtime = new EventEmitter();
        const draw = jest.fn();
        const vm = {renderer: {draw}, runtime};
        let component;
        act(() => { component = renderer.create(<FrameTimeProfilerToolbar vm={vm} />); });
        mounted.push(component);
        const profiler = getFrameTimeProfiler(runtime);
        const buttons = () => component.root.findAllByType('button');
        expect(buttons()[0].children.join('')).toBe('Start');
        act(() => { buttons()[0].props.onClick(); });
        expect(profiler.isEnabled()).toBe(true);
        expect(buttons()[0].children.join('')).toBe('Stop');
        act(() => { buttons()[0].props.onClick(); });
        expect(profiler.isEnabled()).toBe(false);
    });
});
