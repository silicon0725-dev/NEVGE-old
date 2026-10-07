import {STABLE_ID_KINDS, formatStableIdentity} from '../../../../src/core/identity';
import {
    isLegacyTargetDerivedNodeId,
    migrateLegacyTargetDerivedNodeIds,
    migrateLegacyTargetDerivedNodeIdsInProjectSections
} from '../../../../src/lib/project-nodes/legacy-node-identity-migration';

const makeFactory = () => {
    let index = 0;
    return () => {
        index += 1;
        return formatStableIdentity(STABLE_ID_KINDS.NODE, `migration-${String(index).padStart(8, '0')}`);
    };
};

describe('legacy target-derived Project Node identity migration', () => {
    test('remaps legacy identities and every internal reference without mutating the source', () => {
        const source = {
            editorState: {expandedNodeIds: ['target-node:player-old']},
            nodes: [
                {
                    childIds: ['node:body'],
                    id: 'target-node:player-old',
                    parentId: null,
                    properties: {selfReference: 'target-node:player-old'}
                },
                {
                    childIds: [],
                    id: 'node:body',
                    parentId: 'target-node:player-old',
                    properties: {}
                }
            ],
            targetBindings: ['target-node:player-old'],
            version: 3
        };

        const result = migrateLegacyTargetDerivedNodeIds(source, makeFactory());
        const canonicalId = result.aliases.get('target-node:player-old');

        expect(result.migratedNodeCount).toBe(1);
        expect(canonicalId).toMatch(/^ngvge:node:/);
        expect(result.data.nodes[0].id).toBe(canonicalId);
        expect(result.data.nodes[0].properties.selfReference).toBe(canonicalId);
        expect(result.data.nodes[1].parentId).toBe(canonicalId);
        expect(result.data.targetBindings).toEqual([canonicalId]);
        expect(result.data.editorState.expandedNodeIds).toEqual([canonicalId]);
        expect(source.nodes[0].id).toBe('target-node:player-old');
    });

    test('remaps legacy NodeId references across NGVGE project sections as one migration transaction', () => {
        const source = {
            'ngvge-node-tree': {
                nodes: [{
                    childIds: [],
                    id: 'target-node:player-old',
                    parentId: null
                }],
                targetBindings: ['target-node:player-old'],
                version: 3
            },
            'ngvge-reference-fixture': {
                ownerNodeId: 'target-node:player-old',
                unrelatedText: 'keep-me'
            }
        };

        const result = migrateLegacyTargetDerivedNodeIdsInProjectSections(source, makeFactory());
        const canonicalId = result.data['ngvge-node-tree'].nodes[0].id;

        expect(result.migratedNodeCount).toBe(1);
        expect(canonicalId).toMatch(/^ngvge:node:/);
        expect(result.data['ngvge-node-tree'].targetBindings).toEqual([canonicalId]);
        expect(result.data['ngvge-reference-fixture'].ownerNodeId).toBe(canonicalId);
        expect(result.data['ngvge-reference-fixture'].unrelatedText).toBe('keep-me');
        expect(source['ngvge-reference-fixture'].ownerNodeId).toBe('target-node:player-old');
    });

    test('leaves non-target-derived legacy NGVGE ids stable', () => {
        const source = {
            nodes: [{childIds: [], id: 'node:existing-custom', parentId: null}],
            targetBindings: [],
            version: 3
        };
        const result = migrateLegacyTargetDerivedNodeIds(source, makeFactory());

        expect(result.migratedNodeCount).toBe(0);
        expect(result.data.nodes[0].id).toBe('node:existing-custom');
        expect(isLegacyTargetDerivedNodeId('node:existing-custom')).toBe(false);
    });
});
