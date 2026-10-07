import projectExplorerReducer, {
    DEFAULT_WIDTH,
    MAX_WIDTH,
    MIN_WIDTH,
    projectExplorerInitialState,
    resetProjectExplorer,
    setProjectExplorerNodeExpanded,
    setProjectExplorerSelectedNode,
    setProjectExplorerVisible,
    setProjectExplorerWidth
} from '../../../src/reducers/project-explorer';

describe('project explorer reducer', () => {
    test('returns initial state', () => {
        expect(projectExplorerReducer(undefined, {})).toEqual(projectExplorerInitialState);
    });

    test('sets visibility without changing other state', () => {
        const state = projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerVisible(true)
        );

        expect(state).toEqual({
            visible: true,
            width: DEFAULT_WIDTH,
            selectedNodeId: null,
            expandedNodeIds: [
                'project:root',
                'provider:entities',
                'provider:assets'
            ]
        });
    });


    test('selects an NGVGE node', () => {
        const state = projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerSelectedNode('node:collider')
        );

        expect(state.selectedNodeId).toBe('node:collider');
        expect(projectExplorerReducer(state, setProjectExplorerSelectedNode(null)).selectedNodeId).toBeNull();
    });

    test('sets and clamps width', () => {
        expect(projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerWidth(320)
        ).width).toBe(320);

        expect(projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerWidth(20)
        ).width).toBe(MIN_WIDTH);

        expect(projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerWidth(2000)
        ).width).toBe(MAX_WIDTH);

        expect(projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerWidth(Number.NaN)
        ).width).toBe(DEFAULT_WIDTH);
    });

    test('expands a node without duplicates', () => {
        const firstState = projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerNodeExpanded('provider:entities', true)
        );
        const secondState = projectExplorerReducer(
            firstState,
            setProjectExplorerNodeExpanded('provider:entities', true)
        );

        expect(secondState.expandedNodeIds).toEqual([
            'project:root',
            'provider:entities',
            'provider:assets'
        ]);
    });

    test('collapses a node without mutating the previous state', () => {
        const state = {
            visible: false,
            width: DEFAULT_WIDTH,
            selectedNodeId: 'node:test',
            expandedNodeIds: ['provider:entities', 'target:test']
        };
        const nextState = projectExplorerReducer(
            state,
            setProjectExplorerNodeExpanded('provider:entities', false)
        );

        expect(nextState.expandedNodeIds).toEqual(['target:test']);
        expect(state.expandedNodeIds).toEqual(['provider:entities', 'target:test']);
    });

    test('ignores invalid node identifiers', () => {
        expect(projectExplorerReducer(
            projectExplorerInitialState,
            setProjectExplorerNodeExpanded('', true)
        )).toBe(projectExplorerInitialState);
    });

    test('returns the same reference for unknown actions', () => {
        const state = {
            visible: true,
            width: DEFAULT_WIDTH,
            selectedNodeId: null,
            expandedNodeIds: []
        };

        expect(projectExplorerReducer(state, {type: 'unknown'})).toBe(state);
    });

    test('resets state', () => {
        const state = {
            visible: true,
            width: MAX_WIDTH,
            selectedNodeId: 'node:test',
            expandedNodeIds: ['provider:entities']
        };

        expect(projectExplorerReducer(state, resetProjectExplorer()))
            .toBe(projectExplorerInitialState);
    });
});
