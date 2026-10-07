const {
    createPortableProjectPayload,
    encodeBase64Bytes,
    encodeUTF8
} = require('../../../src/lib/first-party-modules/portable-project-files');
const {createSceneEditorProjection} = require('../../../src/lib/scene-system/scene-editor-projection');
const {
    clearSceneSnapshotProjectionCache,
    getSceneSnapshotNodeTreeId,
    getSceneSnapshotProjection,
    getSceneSnapshotTargetTreeId
} = require('../../../src/lib/project-explorer/scene-snapshot-projection');

const createScene = ({withMetadataProjection = false} = {}) => {
    const projectJSON = {
        targets: [
            {isStage: true, name: 'Stage B'},
            {isStage: false, name: 'Player B'}
        ],
        ngvge: {
            projectSections: {
                'ngvge-node-tree': {
                    nodes: [
                        {childIds: [], enabled: true, id: 'target-stage-b', name: 'Stage B', parentId: null, typeId: 'ngvge.stage-target'},
                        {childIds: ['health-b'], enabled: true, id: 'target-player-b', name: 'Player B', parentId: null, typeId: 'ngvge.sprite-target'},
                        {childIds: [], enabled: true, id: 'health-b', name: 'Health B', parentId: 'target-player-b', typeId: 'ngvge.node2d'},
                        {childIds: [], enabled: true, id: 'scene-service-b', name: 'Scene Service B', parentId: null, typeId: 'ngvge.service-node'}
                    ],
                    targetBindings: ['target-stage-b', 'target-player-b'],
                    version: 1
                }
            }
        }
    };
    const payload = createPortableProjectPayload([{
        data: encodeBase64Bytes(encodeUTF8(JSON.stringify(projectJSON))),
        name: 'project.json'
    }]);
    return {
        id: 'scene-b',
        name: 'Scene B',
        snapshot: {
            byteLength: payload.length,
            metadata: Object.assign(
                {capturedAt: 100},
                withMetadataProjection ? {editorProjection: createSceneEditorProjection(projectJSON)} : {}
            ),
            payload,
            schemaVersion: 2
        }
    };
};

describe('Scene snapshot Project Explorer projection', () => {
    afterEach(() => clearSceneSnapshotProjectionCache());

    test('projects inactive targets and compatibility nodes from the portable scene snapshot', () => {
        const scene = createScene();
        const projection = getSceneSnapshotProjection(scene);

        expect(projection.sceneId).toBe('scene-b');
        expect(projection.source).toBe('payload');
        expect(projection.targets).toEqual([
            {index: 0, isStage: true, name: 'Stage B', nodeId: 'target-stage-b'},
            {index: 1, isStage: false, name: 'Player B', nodeId: 'target-player-b'}
        ]);
        expect(projection.getChildren('target-player-b').map(node => node.name)).toEqual(['Health B']);
        expect(projection.rootCustomNodes.map(node => node.name)).toEqual(['Scene Service B']);
        expect(getSceneSnapshotNodeTreeId('scene-b', 'health-b')).toBe('scene-snapshot-node:scene-b:health-b');
        expect(getSceneSnapshotTargetTreeId('scene-b', 1)).toBe('scene-snapshot-target:scene-b:1');
    });

    test('prefers the lightweight snapshot metadata index when available', () => {
        const scene = createScene({withMetadataProjection: true});
        const projection = getSceneSnapshotProjection(scene);
        expect(projection.source).toBe('metadata');
        expect(projection.getChildren('target-player-b').map(node => node.name)).toEqual(['Health B']);
    });

    test('reuses the cached projection for an unchanged snapshot', () => {
        const scene = createScene();
        expect(getSceneSnapshotProjection(scene)).toBe(getSceneSnapshotProjection(scene));
    });
});
