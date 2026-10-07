jest.mock('../../../src/components/workspace-paint/workspace-scratch-paint-editor.jsx', () => 'mock-modular-scratch-paint-editor');
jest.mock('../../../src/containers/paint-editor-wrapper.jsx', () => 'mock-paint-editor-wrapper');

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import NativePaintHost from '../../../src/containers/native-paint-editor-host.jsx';

const RESOURCE_ID = 'ngvge:resource:33333333-3333-4333-8333-333333333333';

const createTarget = (dataFormat, extras = {}) => ({
    id: 'target-native',
    isOriginal: true,
    runtime: {stageWidth: 640, stageHeight: 360},
    sprite: {costumes: [{name: 'Native', dataFormat, ...extras}]},
    getCostumes () {
        return this.sprite.costumes;
    }
});

const createSession = (dataFormat = 'svg') => {
    const listeners = new Set();
    let revision = 0;
    let selectedResourceId = null;
    let workingCopy = {
        loaded: false,
        workingCopyId: null,
        resourceId: null,
        dirty: false,
        stale: false
    };
    let proposalReview = null;
    const emit = () => {
        revision += 1;
        listeners.forEach(listener => listener({revision}));
    };
    return {
        getState: () => ({
            selectedResourceId,
            workingCopy,
            proposalReview,
            draft: {name: 'Native'},
            lastError: null
        }),
        getWorkingCopyContent: () => workingCopy.loaded ? ({
            workingCopyId: workingCopy.workingCopyId,
            resourceId: workingCopy.resourceId,
            sourceAuthorityRevision: 0,
            dataFormat,
            bitmapResolution: dataFormat === 'svg' ? 1 : 2,
            rotationCenterX: 0,
            rotationCenterY: 0,
            content: dataFormat === 'svg' ?
                {kind: 'svg-text', text: '<svg xmlns="http://www.w3.org/2000/svg"></svg>'} :
                {kind: 'data-uri', dataUri: `data:image/${dataFormat};base64,AAAA`}
        }) : null,
        selectResource: jest.fn(resourceId => {
            selectedResourceId = resourceId || null;
            workingCopy = selectedResourceId ? {
                loaded: true,
                workingCopyId: 'ngvge.workspace-paint-working-copy.native',
                resourceId: selectedResourceId,
                dirty: false,
                stale: false
            } : {
                loaded: false,
                workingCopyId: null,
                resourceId: null,
                dirty: false,
                stale: false
            };
            emit();
        }),
        applyWorkingCopyEdit: jest.fn(),
        setDraftName: jest.fn(),
        reviewChanges: jest.fn(() => {
            proposalReview = {canCommit: true};
            emit();
        }),
        commitReviewedChanges: jest.fn(() => Promise.resolve()),
        discardWorkingCopy: jest.fn(() => Promise.resolve()),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};

const createAssetDatabase = () => ({
    getCostumeResourceId: jest.fn(() => null),
    ensureCostumeResource: jest.fn(() => RESOURCE_ID)
});

const findModeButton = (tree, mode) => tree.root.findByProps({'data-ngvge-paint-mode-option': mode});

describe('WS-10P0M modular Scratch Paint Native host', () => {
    test('mounts the modular Scratch Paint foundation for SVG working copies', () => {
        const session = createSession();
        const assetDatabase = createAssetDatabase();
        const onResourceSelectionChange = jest.fn();
        let tree;
        act(() => {
            tree = renderer.create(
                <NativePaintHost
                    assetDatabase={assetDatabase}
                    paintSession={session}
                    selectedCostumeIndex={0}
                    target={createTarget('svg')}
                    onResourceSelectionChange={onResourceSelectionChange}
                />
            );
        });

        expect(tree.root.findByProps({'data-ngvge-native-paint-host': 'true'})).toBeTruthy();
        expect(tree.root.findByProps({'data-ngvge-modular-scratch-paint': 'true'})).toBeTruthy();
        expect(tree.root.findByType('mock-modular-scratch-paint-editor')).toBeTruthy();
        expect(tree.root.findByProps({
            'data-ngvge-active-paint-backend': 'Scratch Paint Modular · Vector'
        })).toBeTruthy();
        expect(findModeButton(tree, 'vector').props.disabled).toBe(false);
        expect(findModeButton(tree, 'bitmap').props.disabled).toBe(true);
        expect(findModeButton(tree, 'pixel').props.disabled).toBe(true);
        expect(session.selectResource).toHaveBeenCalledWith(RESOURCE_ID);
        expect(onResourceSelectionChange).toHaveBeenCalledWith(RESOURCE_ID);
    });

    test('mounts the same modular Scratch Paint foundation for PNG working copies', () => {
        const session = createSession('png');
        const assetDatabase = createAssetDatabase();
        let tree;
        act(() => {
            tree = renderer.create(
                <NativePaintHost
                    assetDatabase={assetDatabase}
                    paintSession={session}
                    selectedCostumeIndex={0}
                    target={createTarget('png', {
                        bitmapResolution: 2,
                        rotationCenterX: 128,
                        rotationCenterY: 96
                    })}
                />
            );
        });

        expect(tree.root.findByProps({'data-ngvge-paint-mode': 'bitmap'})).toBeTruthy();
        const editor = tree.root.findByType('mock-modular-scratch-paint-editor');
        expect(editor.props.stageSize).toEqual({width: 640, height: 360});
        expect(tree.root.findByProps({
            'data-ngvge-active-paint-backend': 'Scratch Paint Modular · Bitmap'
        })).toBeTruthy();
        expect(findModeButton(tree, 'bitmap').props.disabled).toBe(false);
        expect(assetDatabase.ensureCostumeResource).toHaveBeenCalled();
        expect(tree.root.findAllByType('mock-paint-editor-wrapper')).toHaveLength(0);
    });

    test('keeps explicit compatibility as a direct Scratch VM fallback', () => {
        const session = createSession('png');
        const assetDatabase = createAssetDatabase();
        let tree;
        act(() => {
            tree = renderer.create(
                <NativePaintHost
                    assetDatabase={assetDatabase}
                    paintSession={session}
                    selectedCostumeIndex={0}
                    target={createTarget('png')}
                />
            );
        });

        act(() => {
            findModeButton(tree, 'compatibility').props.onClick();
        });

        expect(tree.root.findByProps({'data-ngvge-paint-mode': 'legacy-raster'})).toBeTruthy();
        expect(tree.root.findByType('mock-paint-editor-wrapper')).toBeTruthy();
        expect(tree.root.findAllByType('mock-modular-scratch-paint-editor')).toHaveLength(0);

        act(() => {
            findModeButton(tree, 'bitmap').props.onClick();
        });

        expect(tree.root.findByProps({'data-ngvge-paint-mode': 'bitmap'})).toBeTruthy();
        expect(tree.root.findByType('mock-modular-scratch-paint-editor')).toBeTruthy();
    });

    test('keeps unsupported formats on direct compatibility fallback', () => {
        const session = createSession('webp');
        const assetDatabase = createAssetDatabase();
        let tree;
        act(() => {
            tree = renderer.create(
                <NativePaintHost
                    assetDatabase={assetDatabase}
                    paintSession={session}
                    selectedCostumeIndex={0}
                    target={createTarget('webp')}
                />
            );
        });
        expect(tree.root.findByProps({'data-ngvge-paint-mode': 'legacy-raster'})).toBeTruthy();
        expect(tree.root.findByType('mock-paint-editor-wrapper')).toBeTruthy();
        expect(findModeButton(tree, 'bitmap').props.disabled).toBe(true);
    });
});
