import {
    RUNTIME_NODE_EXTENSION_DATA_KEY,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
    createScenePersistenceReviewService
} from '../../../../src/lib/scene-system';

const clone = value => JSON.parse(JSON.stringify(value));

const createReview = project => createScenePersistenceReviewService(
    {
        readProject: () => clone(project),
        validateProject: () => ({errors: [], valid: true, warnings: []})
    },
    {
        validatePersistentState: () => ({valid: true})
    },
    {
        validatePersistentBindings: () => ({issues: [], valid: true})
    }
);

describe('NGVGE scene persistence review', () => {
    test('accepts a clean persistent project', () => {
        const review = createReview({
            activeSceneId: 'scene-a',
            extensionData: {},
            scenes: [{id: 'scene-a', name: 'Scene A', snapshot: null}]
        });

        expect(review.capabilityId).toBe('ngvge.scene-persistence-review');
        expect(review.audit()).toMatchObject({issueCount: 0, valid: true});
    });

    test('detects runtime-only node and Scratch binding fields in stored records', () => {
        const review = createReview({
            activeSceneId: 'scene-a',
            extensionData: {
                [RUNTIME_NODE_EXTENSION_DATA_KEY]: {
                    activeSceneId: 'scene-a',
                    nodes: [{
                        activeInHierarchy: true,
                        components: [{
                            data: {
                                bindingId: 'binding-a',
                                lifecycle: 'attached',
                                sceneId: 'scene-a'
                            },
                            enabled: true,
                            id: 'component-a',
                            typeId: SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
                        }],
                        enabled: true,
                        id: 'node-a',
                        name: 'Player',
                        parentId: 'runtime-node:scene-root:scene-a',
                        sceneId: 'scene-a',
                        scope: 'scene',
                        typeId: 'ngvge.sprite-node'
                    }],
                    scenes: [{id: 'scene-a', name: 'Scene A'}],
                    version: 1
                }
            },
            scenes: [{id: 'scene-a', name: 'Scene A', snapshot: null}]
        });
        const report = review.audit();

        expect(report.valid).toBe(false);
        expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
            'SCENE_PERSISTENCE_RUNTIME_NODE_FIELD',
            'SCENE_PERSISTENCE_SCRATCH_RUNTIME_FIELD'
        ]));
        let thrown = null;
        try {
            review.assertValid();
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toMatchObject({code: 'SCENE_PERSISTENCE_REVIEW_FAILED'});
    });
});
