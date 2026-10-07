import React from 'react';
import renderer from 'react-test-renderer';

import ProjectAssetManager from '../../../src/components/project-assets/project-asset-manager.jsx';

const getRenderedText = node => node.children.map(child => {
    if (child === null || typeof child === 'undefined') return '';
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    return getRenderedText(child);
}).join('');

const createDatabase = () => {
    const listeners = new Set();
    const assets = [{
        assetId: 'image-hash',
        dataFormat: 'svg',
        folderId: null,
        id: 'asset:image',
        resourceId: 'ngvge:resource:image-0001',
        kind: 'costume',
        md5ext: 'image-hash.svg',
        name: 'Hero',
        referenceCount: 2
    }, {
        assetId: 'sound-hash',
        dataFormat: 'wav',
        folderId: 'folder:audio',
        id: 'asset:sound',
        resourceId: 'ngvge:resource:sound-0001',
        kind: 'sound',
        md5ext: 'sound-hash.wav',
        name: 'Theme',
        referenceCount: 0
    }];
    return {
        addAssetToTarget: jest.fn(() => Promise.resolve()),
        captureCurrentCostume: jest.fn(() => 'asset:image'),
        createFolder: jest.fn(() => 'folder:new'),
        getAsset: id => assets.find(asset => asset.id === id),
        getDataURL: jest.fn(() => null),
        getHistoryState: jest.fn(() => ({
            canRedo: false,
            canUndo: true,
            redoCount: 0,
            undoCount: 1
        })),
        getPreviewURL: jest.fn(() => null),
        getReferences: jest.fn(() => []),
        getRevision: jest.fn(() => 1),
        importCostume: jest.fn(),
        importSound: jest.fn(),
        listAssets: jest.fn(() => assets),
        listFolders: jest.fn(() => [{id: 'folder:audio', name: 'Audio'}]),
        moveAsset: jest.fn(),
        perform: jest.fn((label, action) => Promise.resolve(action())),
        redo: jest.fn(),
        removeAsset: jest.fn(),
        removeFolder: jest.fn(),
        renameAsset: jest.fn(),
        renameFolder: jest.fn(),
        replaceAssetFromCurrent: jest.fn(),
        subscribe (listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        undo: jest.fn(),
        unlinkReference: jest.fn()
    };
};

const currentTarget = {
    currentCostume: 0,
    getCostumes: () => [{name: 'Idle'}],
    getName: () => 'Player',
    id: 'player'
};

const mountedManagers = [];
const renderManager = (database, extraProps = {}) => {
    const component = renderer.create(
    <ProjectAssetManager
        assetDatabase={database}
        currentTarget={currentTarget}
        vm={{
            runtime: {
                storage: {}
            }
        }}
        {...extraProps}
    />
    );
    mountedManagers.push(component);
    return component;
};

describe('ProjectAssetManager', () => {
    afterEach(() => {
        while (mountedManagers.length) mountedManagers.pop().unmount();
    });
    test('renders image and sound assets with filters and folders', () => {
        const component = renderManager(createDatabase());
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Import files');
        expect(text).toContain('Hero');
        expect(text).toContain('Theme');
        expect(text).toContain('All assets');
        expect(text).toContain('All folders');
        expect(text).toContain('Images');
        expect(text).toContain('Sounds');
        expect(text).toContain('Audio');
        const undoButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === '↶ Undo (1)'
        ))[0];
        expect(undoButton).toBeDefined();
    });


    test('projects ResourceId selection and clears it when the tool surface unmounts', () => {
        const onSelectionContextChange = jest.fn();
        let component;
        renderer.act(() => {
            component = renderManager(createDatabase(), {onSelectionContextChange});
        });
        const hero = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).includes('Hero')
        ))[0];

        renderer.act(() => hero.props.onClick());
        expect(onSelectionContextChange).toHaveBeenLastCalledWith('ngvge:resource:image-0001');

        renderer.act(() => component.unmount());
        expect(onSelectionContextChange).toHaveBeenLastCalledWith(null);
        const index = mountedManagers.indexOf(component);
        if (index !== -1) mountedManagers.splice(index, 1);
    });

    test('invokes asset history undo', () => {
        const database = createDatabase();
        const component = renderManager(database);
        const undoButton = component.root.findAllByType('button').find(button => (
            Array.isArray(button.children) && button.children.join('').includes('Undo')
        ));

        undoButton.props.onClick();

        expect(database.undo).toHaveBeenCalledTimes(1);
    });
});
