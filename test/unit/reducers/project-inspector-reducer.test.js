import projectInspectorReducer, {
    DEFAULT_WIDTH,
    MAX_WIDTH,
    MIN_WIDTH,
    projectInspectorInitialState,
    resetProjectInspector,
    setProjectInspectorSectionExpanded,
    setProjectInspectorVisible,
    setProjectInspectorWidth
} from '../../../src/reducers/project-inspector';

describe('project inspector reducer', () => {
    test('returns initial state', () => {
        expect(projectInspectorReducer(undefined, {})).toEqual(projectInspectorInitialState);
    });

    test('sets visibility', () => {
        expect(projectInspectorReducer(
            projectInspectorInitialState,
            setProjectInspectorVisible(false)
        ).visible).toBe(false);
    });

    test('sets and clamps width', () => {
        expect(projectInspectorReducer(
            projectInspectorInitialState,
            setProjectInspectorWidth(360)
        ).width).toBe(360);
        expect(projectInspectorReducer(
            projectInspectorInitialState,
            setProjectInspectorWidth(10)
        ).width).toBe(MIN_WIDTH);
        expect(projectInspectorReducer(
            projectInspectorInitialState,
            setProjectInspectorWidth(900)
        ).width).toBe(MAX_WIDTH);
        expect(projectInspectorReducer(
            projectInspectorInitialState,
            setProjectInspectorWidth(Number.NaN)
        ).width).toBe(DEFAULT_WIDTH);
    });

    test('expands and collapses sections without duplicates', () => {
        const expanded = projectInspectorReducer(
            projectInspectorInitialState,
            setProjectInspectorSectionExpanded('extension:camera', true)
        );
        const duplicate = projectInspectorReducer(
            expanded,
            setProjectInspectorSectionExpanded('extension:camera', true)
        );
        const collapsed = projectInspectorReducer(
            duplicate,
            setProjectInspectorSectionExpanded('extension:camera', false)
        );

        expect(duplicate.expandedSectionIds.filter(id => id === 'extension:camera')).toHaveLength(1);
        expect(collapsed.expandedSectionIds).not.toContain('extension:camera');
    });

    test('resets state', () => {
        expect(projectInspectorReducer({
            visible: false,
            width: 500,
            expandedSectionIds: []
        }, resetProjectInspector())).toBe(projectInspectorInitialState);
    });
});
