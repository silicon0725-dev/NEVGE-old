jest.mock('@svgedit/svgcanvas', () => {
    class MockSvgCanvas {
        static instances = [];

        constructor (container, config) {
            MockSvgCanvas.instances.push(this);
            this.container = container;
            this.config = config;
            this.svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"></svg>';
            this.contentW = 64;
            this.contentH = 32;
            this.zoom = 1;
            this.mode = 'select';
            this.handlers = new Map();
            this.selectedElements = [];
            this.commandCalls = [];
            this.contentAttributes = {x: '0', y: '0'};
            this.backgroundAttributes = {x: '0', y: '0'};
            this.selectorTranslation = {x: 0, y: 0};
            this.content = {
                setAttribute: (name, value) => {
                    this.contentAttributes[name] = String(value);
                },
                getAttribute: name => this.contentAttributes[name]
            };
            this.background = {
                setAttribute: (name, value) => {
                    this.backgroundAttributes[name] = String(value);
                }
            };
            this.selectorParent = {
                setAttribute: (name, value) => {
                    if (name !== 'transform') return;
                    const match = String(value).match(/translate\(([-0-9.]+),([-0-9.]+)\)/);
                    if (match) this.selectorTranslation = {x: Number(match[1]), y: Number(match[2])};
                }
            };
            this.root = {
                style: {},
                setAttribute: () => {},
                removeAttribute: () => {},
                querySelector: selector => ({
                    '#canvasBackground': this.background,
                    '#selectorParentGroup': this.selectorParent
                }[selector] || null)
            };
            this.pathActions = {
                zoomChange: () => {},
                toEditMode: element => {
                    this.commandCalls.push(['path.toEditMode', element && element.id]);
                    this.mode = 'pathedit';
                },
                clear: () => {
                    this.commandCalls.push(['path.clear']);
                    this.mode = 'select';
                },
                clonePathNode: () => this.commandCalls.push(['path.clonePathNode']),
                deletePathNode: () => this.commandCalls.push(['path.deletePathNode']),
                setSegType: type => this.commandCalls.push(['path.setSegType', type]),
                opencloseSubPath: () => this.commandCalls.push(['path.opencloseSubPath']),
                linkControlPoints: value => this.commandCalls.push(['path.linkControlPoints', value])
            };
            this.undoMgr = {
                getUndoStackSize: () => 0,
                getRedoStackSize: () => 0,
                resetUndoStack: () => {}
            };
        }

        setSvgString (svg) {
            this.svg = svg;
            const width = svg.match(/\bwidth=["']([0-9.]+)/i);
            const height = svg.match(/\bheight=["']([0-9.]+)/i);
            this.contentW = width ? Number(width[1]) : 64;
            this.contentH = height ? Number(height[1]) : 32;
            return true;
        }
        getSvgString () { return this.svg; }
        getSvgRoot () { return this.root; }
        getSvgContent () { return this.content; }
        getResolution () { return {w: this.contentW, h: this.contentH, zoom: this.zoom}; }
        setZoom (zoom) { this.zoom = zoom; }
        getZoom () { return this.zoom; }
        updateCanvas (width, height) {
            const x = (width - this.contentW * this.zoom) / 2;
            const y = (height - this.contentH * this.zoom) / 2;
            this.contentAttributes.x = String(x);
            this.contentAttributes.y = String(y);
            this.selectorTranslation = {x, y};
            return {x, y};
        }
        getSelectedElements () { return this.selectedElements; }
        getStrokedBBox () { return null; }
        gettingSelectorManager () { return {requestSelector: () => ({resize: () => {}})}; }
        setMode (mode) { this.mode = mode; }
        getMode () { return this.mode; }
        clearSelection () { this.commandCalls.push(['clearSelection']); this.selectedElements = []; }
        copySelectedElements () { this.commandCalls.push(['copySelectedElements']); }
        cutSelectedElements () { this.commandCalls.push(['cutSelectedElements']); }
        pasteElements (mode) { this.commandCalls.push(['pasteElements', mode]); }
        deleteSelectedElements () { this.commandCalls.push(['deleteSelectedElements']); }
        cloneSelectedElements (dx, dy) { this.commandCalls.push(['cloneSelectedElements', dx, dy]); }
        groupSelectedElements () { this.commandCalls.push(['groupSelectedElements']); }
        ungroupSelectedElement () { this.commandCalls.push(['ungroupSelectedElement']); }
        moveUpDownSelected (direction) { this.commandCalls.push(['moveUpDownSelected', direction]); }
        moveToTopSelectedElement () { this.commandCalls.push(['moveToTopSelectedElement']); }
        moveToBottomSelectedElement () { this.commandCalls.push(['moveToBottomSelectedElement']); }
        moveSelectedElements (dx, dy, undoable) { this.commandCalls.push(['moveSelectedElements', dx, dy, undoable]); }
        bind (event, handler) { this.handlers.set(event, handler); }
        unbind (event) { this.handlers.delete(event); }
    }
    return MockSvgCanvas;
}, {virtual: true});

import SvgCanvas from '@svgedit/svgcanvas';
import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspaceVectorEditor from '../../../src/components/workspace-paint/workspace-vector-editor.jsx';

const makeWorkingCopy = () => ({
    workingCopyId: 'ngvge.workspace-paint-working-copy.f2c',
    resourceId: 'ngvge:resource:f2c',
    sourceAuthorityRevision: 1,
    dataFormat: 'svg',
    bitmapResolution: 1,
    rotationCenterX: 32,
    rotationCenterY: 16,
    content: {kind: 'svg-text', text: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><path id="p" d="M0 0L10 10"/></svg>'}
});

const makeKeyEvent = (key, extra = {}) => ({
    key,
    target: {tagName: 'DIV'},
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    ...extra
});

const makePointerEvent = (extra = {}) => ({
    button: 0,
    pointerId: 11,
    clientX: 100,
    clientY: 80,
    shiftKey: false,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    currentTarget: {
        setPointerCapture: jest.fn(),
        releasePointerCapture: jest.fn()
    },
    ...extra
});

describe('WS-10F2C Workspace Vector professional tooling', () => {
    test('routes professional shortcuts, Direct Selection, Hand/Space pan, and Zoom through NGVGE controls', () => {
        const onApplyEdit = jest.fn();
        const onBackendStateChange = jest.fn();
        const onError = jest.fn();
        const nodeMock = {
            clientWidth: 640,
            clientHeight: 420,
            appendChild: jest.fn(),
            focus: jest.fn(),
            replaceChildren: jest.fn(),
            getBoundingClientRect: () => ({width: 640, height: 420})
        };
        let tree;
        act(() => {
            tree = renderer.create(
                <WorkspaceVectorEditor
                    showToolbar={false}
                    stageSize={{width: 480, height: 360}}
                    workingCopy={makeWorkingCopy()}
                    onApplyEdit={onApplyEdit}
                    onBackendStateChange={onBackendStateChange}
                    onError={onError}
                />,
                {createNodeMock: element => element.props['aria-label'] === 'SVG vector canvas' ? nodeMock : {}}
            );
        });

        expect(onError).not.toHaveBeenCalled();
        const canvas = SvgCanvas.instances[SvgCanvas.instances.length - 1];
        const surface = () => tree.root.findByProps({'aria-label': 'SVG vector canvas'});
        expect(canvas.config.show_outside_canvas).toBe(true);
        expect(surface().props['data-ngvge-vector-workspace']).toBe('unbounded');
        expect(canvas.contentAttributes.overflow).toBe('visible');

        canvas.selectedElements = [{id: 'path-1', tagName: 'path'}];
        act(() => canvas.handlers.get('selected')());
        act(() => surface().props.onKeyDown(makeKeyEvent('a')));
        expect(canvas.commandCalls).toContainEqual(['path.toEditMode', 'path-1']);
        expect(surface().props['data-ngvge-vector-tool']).toBe('direct-select');

        act(() => surface().props.onKeyDown(makeKeyEvent('Delete')));
        expect(canvas.commandCalls).toContainEqual(['path.deletePathNode']);
        act(() => surface().props.onKeyDown(makeKeyEvent('Escape')));
        expect(surface().props['data-ngvge-vector-tool']).toBe('select');

        canvas.selectedElements = [{id: 'rect-1', tagName: 'rect'}];
        act(() => canvas.handlers.get('selected')());
        act(() => surface().props.onKeyDown(makeKeyEvent('d', {ctrlKey: true})));
        expect(canvas.commandCalls).toContainEqual(['cloneSelectedElements', 10, 10]);

        act(() => surface().props.onKeyDown(makeKeyEvent('h')));
        expect(surface().props['data-ngvge-vector-tool']).toBe('hand');
        const panDown = makePointerEvent();
        act(() => surface().props.onPointerDownCapture(panDown));
        act(() => surface().props.onPointerMoveCapture(makePointerEvent({clientX: 130, clientY: 65})));
        expect(canvas.selectorTranslation.x).not.toBe((640 - 64 * canvas.zoom) / 2);

        act(() => surface().props.onKeyDown(makeKeyEvent('v')));
        act(() => surface().props.onKeyDown(makeKeyEvent(' ')));
        expect(surface().props['data-ngvge-vector-tool']).toBe('hand-temporary');
        act(() => surface().props.onKeyUp(makeKeyEvent(' ')));
        expect(surface().props['data-ngvge-vector-tool']).toBe('select');

        act(() => surface().props.onKeyDown(makeKeyEvent('z')));
        const beforeZoom = canvas.zoom;
        act(() => surface().props.onPointerDownCapture(makePointerEvent()));
        expect(canvas.zoom).toBeCloseTo(beforeZoom * 2, 6);
        expect(surface().props['data-ngvge-vector-tool']).toBe('zoom');

        expect(onBackendStateChange).toHaveBeenCalled();
    });
});
