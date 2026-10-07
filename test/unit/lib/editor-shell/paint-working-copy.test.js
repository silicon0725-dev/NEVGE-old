import {
    WORKSPACE_PAINT_WORKING_COPY_MODEL_ID,
    WorkspacePaintWorkingCopyModel
} from '../../../../src/lib/editor-shell/paint-working-copy';

const A = 'ngvge:resource:20202020-2020-4020-8020-202020202020';
const B = 'ngvge:resource:30303030-3030-4030-8030-303030303030';

const createContentRead = () => {
    const listeners = new Set();
    let revision = 1;
    const source = id => ({
        schemaVersion: 1,
        resourceId: id,
        kind: 'image',
        dataFormat: 'svg',
        bitmapResolution: 1,
        rotationCenterX: 0,
        rotationCenterY: 0,
        byteLength: 20,
        sourceAuthorityRevision: revision,
        content: {kind: 'data-uri', dataUri: 'data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E'}
    });
    return {
        getImageContent: jest.fn(id => source(id)),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        emit: ({type = 'replace', resourceId = A, contentMayHaveChanged = true} = {}) => {
            revision += 1;
            listeners.forEach(listener => listener({
                sourceAuthorityRevision: revision,
                type,
                resourceId,
                contentMayHaveChanged
            }));
        }
    };
};

describe('WS-10B Paint Working Copy model', () => {
    test('loads an immutable Resource content snapshot into a transient copy', () => {
        const contentRead = createContentRead();
        const model = new WorkspacePaintWorkingCopyModel({resourceContentRead: contentRead});
        model.load(A);
        const state = model.getState();
        expect(model.id).toBe(WORKSPACE_PAINT_WORKING_COPY_MODEL_ID);
        expect(state).toEqual(expect.objectContaining({loaded: true, resourceId: A, dirty: false, stale: false}));
        expect(model.getContent().content.kind).toBe('data-uri');
    });

    test('backend edits affect only the transient copy and mark it dirty', () => {
        const contentRead = createContentRead();
        const model = new WorkspacePaintWorkingCopyModel({resourceContentRead: contentRead});
        model.load(A);
        model.applyEdit({
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX: 10,
            rotationCenterY: 11,
            content: {kind: 'svg-text', text: '<svg><circle/></svg>'}
        });
        expect(model.getState()).toEqual(expect.objectContaining({dirty: true, rotationCenterX: 10, rotationCenterY: 11}));
        expect(model.getContent().content.text).toContain('circle');
        expect(contentRead.getImageContent).toHaveBeenCalledTimes(1);
    });

    test('refuses a Resource switch while local content is dirty', () => {
        const contentRead = createContentRead();
        const model = new WorkspacePaintWorkingCopyModel({resourceContentRead: contentRead});
        model.load(A);
        model.applyEdit({dataFormat: 'svg', content: {kind: 'svg-text', text: '<svg/>'}});
        expect(() => model.load(B)).toThrow(/Discard the current Paint working copy/);
        expect(model.getState().resourceId).toBe(A);
    });

    test('marks content-affecting source changes stale but ignores metadata-only changes', () => {
        const contentRead = createContentRead();
        const model = new WorkspacePaintWorkingCopyModel({resourceContentRead: contentRead});
        model.load(A);
        contentRead.emit({type: 'rename', resourceId: A, contentMayHaveChanged: false});
        expect(model.getState().stale).toBe(false);
        contentRead.emit({type: 'replace', resourceId: A, contentMayHaveChanged: true});
        expect(model.getState().stale).toBe(true);
    });

    test('discard reloads source and clears dirty/stale state', () => {
        const contentRead = createContentRead();
        const model = new WorkspacePaintWorkingCopyModel({resourceContentRead: contentRead});
        model.load(A);
        model.applyEdit({dataFormat: 'svg', content: {kind: 'svg-text', text: '<svg/>'}});
        contentRead.emit({resourceId: A});
        model.discard();
        expect(model.getState()).toEqual(expect.objectContaining({dirty: false, stale: false, resourceId: A}));
        expect(contentRead.getImageContent).toHaveBeenCalledTimes(2);
    });
});
