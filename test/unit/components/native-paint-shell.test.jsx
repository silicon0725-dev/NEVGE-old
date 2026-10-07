import React from 'react';
import renderer, {act} from 'react-test-renderer';

import NativePaintShell from '../../../src/components/native-paint/native-paint-shell.jsx';

const findButtonByLabel = (tree, label) => tree.root.findAllByType('button')
    .find(node => node.props['aria-label'] === label || node.children.includes(label));

describe('WS-10F2B Native Paint unified shell', () => {
    test('owns the vector tool rail, context actions, status chrome, and collapsible panel dock', () => {
        const onSelectTool = jest.fn();
        const onUndo = jest.fn();
        const onRedo = jest.fn();
        const onContextAction = jest.fn();
        const onZoomChange = jest.fn();
        let tree;
        act(() => {
            tree = renderer.create(
                <NativePaintShell
                    activeTool="rect"
                    backendLabel="SVG-Edit"
                    canRedo
                    canUndo
                    contextActions={[
                        {id: 'duplicate', label: 'Duplicate'},
                        {id: 'group', label: 'Group', disabled: true}
                    ]}
                    dirty
                    mode="vector"
                    resourceLabel="hero.svg"
                    tools={['select', 'direct-select', 'rect', 'text', 'zoom']}
                    zoom={{mode: 'manual', zoom: 0.5, zoomPercent: 50}}
                    onContextAction={onContextAction}
                    onRedo={onRedo}
                    onSelectTool={onSelectTool}
                    onUndo={onUndo}
                    onZoomChange={onZoomChange}
                >
                    <div data-test-canvas="true" />
                </NativePaintShell>
            );
        });

        expect(tree.root.findByProps({'data-ngvge-native-paint-shell': 'true'})).toBeTruthy();
        expect(tree.root.findByProps({'data-ngvge-paint-canvas-chrome': 'true'})).toBeTruthy();
        expect(findButtonByLabel(tree, 'Rectangle').props['aria-pressed']).toBe(true);

        act(() => findButtonByLabel(tree, 'Selection').props.onClick());
        expect(onSelectTool).toHaveBeenCalledWith('select');

        act(() => findButtonByLabel(tree, 'Undo').props.onClick());
        act(() => findButtonByLabel(tree, 'Redo').props.onClick());
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(onRedo).toHaveBeenCalledTimes(1);

        act(() => findButtonByLabel(tree, 'Duplicate').props.onClick());
        expect(onContextAction).toHaveBeenCalledWith('duplicate');
        expect(findButtonByLabel(tree, 'Group').props.disabled).toBe(true);

        const zoomSelect = tree.root.findByProps({'aria-label': 'Vector zoom'});
        expect(zoomSelect.props.value).toBe('50');
        act(() => zoomSelect.props.onChange({target: {value: '200'}}));
        act(() => zoomSelect.props.onChange({target: {value: 'fit'}}));
        expect(onZoomChange).toHaveBeenNthCalledWith(1, 2);
        expect(onZoomChange).toHaveBeenNthCalledWith(2, 'fit');

        act(() => findButtonByLabel(tree, 'Layers').props.onClick());
        expect(tree.root.findByProps({'data-ngvge-paint-panel': 'layers'})).toBeTruthy();
    });

    test('renders backend-neutral Bitmap tool descriptors and shared zoom chrome without a Bitmap-specific shell fork', () => {
        const onSelectTool = jest.fn();
        const onZoomChange = jest.fn();
        let tree;
        act(() => {
            tree = renderer.create(
                <NativePaintShell
                    activeTool="brush"
                    backendLabel="Raster POC"
                    mode="bitmap"
                    resourceLabel="paint.png"
                    tools={['select', 'brush', 'eraser', 'fill', 'eyedropper', 'hand', 'zoom']}
                    zoom={{mode: 'manual', zoom: 1, zoomPercent: 100}}
                    onSelectTool={onSelectTool}
                    onZoomChange={onZoomChange}
                >
                    <div data-test-raster-canvas="true" />
                </NativePaintShell>
            );
        });

        expect(tree.root.findByProps({'data-ngvge-paint-shell-mode': 'bitmap'})).toBeTruthy();
        expect(findButtonByLabel(tree, 'Brush').props['aria-pressed']).toBe(true);
        expect(findButtonByLabel(tree, 'Eraser')).toBeTruthy();
        expect(findButtonByLabel(tree, 'Fill')).toBeTruthy();
        expect(findButtonByLabel(tree, 'Eyedropper')).toBeTruthy();
        expect(tree.root.findByProps({'aria-label': 'Bitmap zoom'}).props.value).toBe('100');

        act(() => findButtonByLabel(tree, 'Eyedropper').props.onClick());
        expect(onSelectTool).toHaveBeenCalledWith('eyedropper');
    });

    test('keeps legacy raster as compatibility passthrough without adding a duplicate tool rail', () => {
        let tree;
        act(() => {
            tree = renderer.create(
                <NativePaintShell mode="legacy-raster" compatibility>
                    <div data-legacy-raster="true" />
                </NativePaintShell>
            );
        });

        expect(tree.root.findByProps({'data-ngvge-native-paint-shell': 'true'})).toBeTruthy();
        expect(tree.root.findByProps({'data-legacy-raster': 'true'})).toBeTruthy();
        expect(tree.root.findAllByProps({role: 'toolbar'})).toHaveLength(0);
    });
});
