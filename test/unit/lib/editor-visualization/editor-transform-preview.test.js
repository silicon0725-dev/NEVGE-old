import {getEditorTransformPreview} from '../../../../src/lib/editor-visualization';

describe('WS-10N6-HF7 editor transform preview', () => {
    test('keeps authored transform separate from transient drag position', () => {
        const runtime = {};
        const preview = getEditorTransformPreview(runtime);
        const changes = [];
        const unsubscribe = preview.subscribe((snapshot, change) => changes.push({snapshot, change}));

        preview.begin({
            authoredPosition: [10, 20],
            nodeId: 'sprite-node',
            targetRuntimeId: 'scratch-target'
        });
        preview.updatePosition([35, -5]);

        expect(preview.getSnapshot()).toMatchObject({
            active: true,
            authoredPosition: [10, 20],
            delta: [25, -25],
            nodeId: 'sprite-node',
            previewPosition: [35, -5],
            targetRuntimeId: 'scratch-target'
        });
        expect(changes.map(entry => entry.change.type)).toEqual(['begin', 'update']);

        preview.commit('pointer-up');
        expect(preview.getSnapshot()).toMatchObject({active: false, nodeId: null, reason: 'pointer-up'});
        unsubscribe();
    });

    test('cancels without promoting preview coordinates to authored state', () => {
        const runtime = {};
        const preview = getEditorTransformPreview(runtime);
        preview.begin({authoredPosition: [1, 2], nodeId: 'node'});
        preview.updatePosition([100, 200]);
        preview.cancel('escape');
        expect(preview.getSnapshot()).toMatchObject({
            active: false,
            authoredPosition: null,
            previewPosition: null,
            reason: 'escape'
        });
    });
});
