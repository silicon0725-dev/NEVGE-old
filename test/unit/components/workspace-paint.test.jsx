jest.mock('@svgedit/svgcanvas', () => class MockSvgCanvas {
    constructor () {
        this.svg = '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"32\"></svg>';
        this.mode = 'select';
        this.zoom = 1;
        this.contentW = 64;
        this.contentH = 32;
        this.selectedElements = [];
        this.root = {
            style: {},
            setAttribute: () => {},
            removeAttribute: () => {},
            querySelector: () => null
        };
        this.content = {setAttribute: () => {}, getAttribute: () => '0'};
        this.pathActions = {zoomChange: () => {}, clear: () => { this.mode = 'select'; }};
        this.undoMgr = {
            getUndoStackSize: () => 0,
            getRedoStackSize: () => 0,
            resetUndoStack: () => {}
        };
    }
    setSvgString (svg) { this.svg = svg; return true; }
    getSvgString () { return this.svg; }
    getSvgRoot () { return this.root; }
    getSvgContent () { return this.content; }
    getResolution () { return {w: this.contentW, h: this.contentH, zoom: this.zoom}; }
    setZoom (zoom) { this.zoom = zoom; }
    getZoom () { return this.zoom; }
    updateCanvas (width, height) {
        return {x: (width - this.contentW * this.zoom) / 2, y: (height - this.contentH * this.zoom) / 2};
    }
    getSelectedElements () { return this.selectedElements; }
    gettingSelectorManager () { return {requestSelector: () => ({resize: () => {}})}; }
    setMode (mode) { this.mode = mode; }
    getMode () { return this.mode; }
    bind () {}
    unbind () {}
}, {virtual: true});


import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspacePaint from '../../../src/components/workspace-paint/workspace-paint.jsx';
import {WORKSPACE_PAINT_BACKEND_ACTIVATE, activateWorkspacePaintBackend} from '../../../src/lib/tw-scratch-paint';

const RESOURCE_ID = 'ngvge:resource:cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const createSession = () => {
    const listeners = new Set();
    let revision = 0;
    let name = 'Hero';
    let proposalReview = null;
    let transactionId = null;
    const emit = () => {
        revision += 1;
        listeners.forEach(listener => listener({revision}));
    };
    return {
        getState: () => ({
            sessionId: 'ngvge.workspace-paint-tool-session@1',
            backend: {
                adapterId: 'ngvge.paint-backend-adapter.svg-edit@1',
                package: '@svgedit/svgcanvas@7.4.2'
            },
            selectedResourceId: RESOURCE_ID,
            resource: {
                resourceId: RESOURCE_ID,
                kind: 'image',
                name: 'Hero',
                dataFormat: 'svg',
                referenceCount: 1
            },
            imageResources: [{resourceId: RESOURCE_ID, name: 'Hero'}],
            draft: {name},
            workingCopy: {
                loaded: true,
                workingCopyId: 'ngvge.workspace-paint-working-copy.test',
                resourceId: RESOURCE_ID,
                sourceAuthorityRevision: 1,
                dataFormat: 'svg',
                dirty: false,
                stale: false
            },
            proposalReview,
            transactionId,
            lastError: null
        }),
        getWorkingCopyContent: () => ({
            workingCopyId: 'ngvge.workspace-paint-working-copy.test',
            resourceId: RESOURCE_ID,
            sourceAuthorityRevision: 1,
            dataFormat: 'svg',
            rotationCenterX: 0,
            rotationCenterY: 0,
            content: {kind: 'svg-text', text: '<svg></svg>'}
        }),
        selectResource: jest.fn(),
        applyWorkingCopyEdit: jest.fn(),
        discardWorkingCopy: jest.fn(),
        reloadWorkingCopy: jest.fn(),
        setDraftName: next => {
            name = next;
            emit();
        },
        reviewChanges: () => {
            proposalReview = {
                state: 'ready',
                canCommit: true,
                impact: {changedCommandCount: 1},
                commands: [{
                    commandIndex: 0,
                    resourceId: RESOURCE_ID,
                    kind: 'resource.rename',
                    before: {name: 'Hero'},
                    after: {name: 'Hero Prime'}
                }],
                diagnostics: []
            };
            emit();
            return proposalReview;
        },
        commitReviewedChanges: async () => {
            transactionId = 'ngvge.workspace-project-transaction.1';
            emit();
            return {transactionId};
        },
        rollbackLastTransaction: async () => true,
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};

describe('WS-10F Workspace Paint UI', () => {
    test('WS-10B exposes an explicit lazy scratch-paint backend activation action', () => {
        expect(activateWorkspacePaintBackend()).toEqual({type: WORKSPACE_PAINT_BACKEND_ACTIVATE});
    });

    test('renders the admitted Paint session and transaction review controls', async () => {
        const session = createSession();
        let tree;
        act(() => {
            tree = renderer.create(<WorkspacePaint session={session} />);
        });
        expect(tree.root.findByProps({'data-ngvge-tool-id': 'ngvge.tool.paint'})).toBeTruthy();
        expect(tree.root.findAllByType('button').some(node => node.children.includes('Pencil'))).toBe(true);
        expect(tree.root.findByProps({'data-ngvge-paint-backend': 'ngvge.paint-backend-adapter.svg-edit@1'}))
            .toBeTruthy();
        const input = tree.root.findByProps({id: 'ngvge-paint-resource-name'});
        act(() => input.props.onChange({target: {value: 'Hero Prime'}}));
        const reviewButton = tree.root.findAllByType('button').find(node => node.children.includes('Review Changes'));
        await act(async () => reviewButton.props.onClick());
        expect(JSON.stringify(tree.toJSON())).toContain('Commit allowed');
    });
});
