import {
    ENTITIES_ROOT_NODE_ID,
    createEntityProvider,
    getTargetIdFromNodeId,
    getTargetNodeId
} from '../../../../src/lib/project-explorer/entity-provider';

describe('Project Explorer Entity Provider', () => {
    test('creates stable node identifiers', () => {
        expect(getTargetNodeId('target-id')).toBe('target:target-id');
        expect(getTargetIdFromNodeId('target:target-id')).toBe('target-id');
        expect(getTargetIdFromNodeId('provider:entities')).toBeNull();
    });

    test('maps stage and sprites in target-pane order', () => {
        const provider = createEntityProvider({
            stage: {
                id: 'stage-id',
                isStage: true,
                name: 'Stage'
            },
            sprites: {
                second: {
                    id: 'second',
                    name: 'Second',
                    order: 1
                },
                first: {
                    id: 'first',
                    name: 'First',
                    order: 0
                }
            }
        });

        expect(provider.getChildren(ENTITIES_ROOT_NODE_ID)).toEqual([
            expect.objectContaining({
                id: 'target:stage-id',
                targetId: 'stage-id',
                kind: 'stage',
                label: 'Stage'
            }),
            expect.objectContaining({
                id: 'target:first',
                targetId: 'first',
                kind: 'sprite',
                label: 'First'
            }),
            expect.objectContaining({
                id: 'target:second',
                targetId: 'second',
                kind: 'sprite',
                label: 'Second'
            })
        ]);
    });

    test('uses a localized stage fallback label', () => {
        const provider = createEntityProvider({
            stage: {
                id: 'stage-id',
                isStage: true
            },
            stageLabel: '舞台'
        });

        expect(provider.getChildren(ENTITIES_ROOT_NODE_ID)[0].label).toBe('舞台');
    });

    test('returns an empty entity list before a project is loaded', () => {
        const provider = createEntityProvider({});

        expect(provider.getChildren(ENTITIES_ROOT_NODE_ID)).toEqual([]);
        expect(provider.getChildren('target:unknown')).toEqual([]);
    });
});
