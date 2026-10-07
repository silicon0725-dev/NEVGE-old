import {
    MAX_WORKSPACE_IMAGE_CONTENT_BYTES,
    WORKSPACE_RESOURCE_CONTENT_READ_CAPABILITY_ID,
    createWorkspaceResourceContentReadFacade
} from '../../../../src/lib/editor-shell/workspace-resource-content-capability';

const RESOURCE_ID = 'ngvge:resource:10101010-1010-4010-8010-101010101010';

const createDatabase = () => {
    const record = {
        id: 'asset:image',
        resourceId: RESOURCE_ID,
        kind: 'costume',
        dataFormat: 'svg',
        bitmapResolution: 1,
        rotationCenterX: 4,
        rotationCenterY: 5
    };
    const listeners = new Set();
    let revision = 7;
    let contentRevision = 7;
    let dataUri = 'data:image/svg+xml,%3Csvg%3E%3Crect%2F%3E%3C%2Fsvg%3E';
    return {
        getAsset: id => id === record.id ? {...record} : null,
        getAssetIdForResourceId: id => id === RESOURCE_ID ? record.id : null,
        getDataURL: id => id === record.id ? dataUri : null,
        getResource: id => id === RESOURCE_ID ? {...record} : null,
        getRevision: () => revision,
        getResourceContentRevision: id => id === RESOURCE_ID ? contentRevision : null,
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        emit: type => {
            revision += 1;
            if (type === 'replace') contentRevision += 1;
            listeners.forEach(listener => listener({assetId: record.id, type}));
        },
        setDataUri: value => {
            dataUri = value;
        }
    };
};

describe('WS-10B Resource Content Read capability', () => {
    test('reads bounded portable image content without exposing backend identifiers', () => {
        const database = createDatabase();
        const facade = createWorkspaceResourceContentReadFacade({getResourceDatabase: () => database});
        const content = facade.getImageContent(RESOURCE_ID);
        expect(facade.id).toBe(WORKSPACE_RESOURCE_CONTENT_READ_CAPABILITY_ID);
        expect(content).toEqual(expect.objectContaining({
            resourceId: RESOURCE_ID,
            kind: 'image',
            dataFormat: 'svg',
            sourceAuthorityRevision: 7,
            rotationCenterX: 4,
            rotationCenterY: 5
        }));
        expect(content.content.kind).toBe('data-uri');
        expect(content.assetId).toBeUndefined();
        expect(content.vm).toBeUndefined();
        expect(content.backend).toBeUndefined();
    });

    test('emits portable source events and marks only content-affecting event kinds', () => {
        const database = createDatabase();
        const facade = createWorkspaceResourceContentReadFacade({getResourceDatabase: () => database});
        const events = [];
        const unsubscribe = facade.subscribe(event => events.push(event));
        database.emit('rename');
        database.emit('replace');
        unsubscribe();
        expect(events[0]).toEqual(expect.objectContaining({
            resourceId: RESOURCE_ID,
            sourceAuthorityRevision: 7,
            contentMayHaveChanged: false,
            type: 'rename'
        }));
        expect(events[1]).toEqual(expect.objectContaining({
            resourceId: RESOURCE_ID,
            sourceAuthorityRevision: 8,
            contentMayHaveChanged: true,
            type: 'replace'
        }));
    });

    test('rejects unsupported formats instead of silently handing them to scratch-paint', () => {
        const database = createDatabase();
        database.getResource = id => id === RESOURCE_ID ? {
            id: 'asset:image', resourceId: RESOURCE_ID, kind: 'costume', dataFormat: 'webp'
        } : null;
        const facade = createWorkspaceResourceContentReadFacade({getResourceDatabase: () => database});
        expect(() => facade.getImageContent(RESOURCE_ID)).toThrow(/does not support image format/);
    });

    test('enforces a bounded working-copy content read budget', () => {
        const database = createDatabase();
        database.setDataUri(`data:image/png;base64,${'A'.repeat(Math.ceil(MAX_WORKSPACE_IMAGE_CONTENT_BYTES * 4 / 3) + 8)}`);
        const facade = createWorkspaceResourceContentReadFacade({getResourceDatabase: () => database});
        expect(() => facade.getImageContent(RESOURCE_ID)).toThrow(/working-copy read budget/);
    });
});
