import {
    createPropertyHistory,
    getPropertyHistory
} from '../../../src/lib/project-inspector/property-history';

describe('project inspector property history', () => {
    test('records, undoes and redoes value changes', () => {
        const history = createPropertyHistory();
        let value = 2;

        value = 5;
        history.recordValue({
            after: 5,
            apply: nextValue => {
                value = nextValue;
            },
            before: 2,
            label: 'Set value'
        });

        expect(history.getState()).toMatchObject({canUndo: true, canRedo: false, undoDepth: 1});
        expect(history.undo()).toBe(true);
        expect(value).toBe(2);
        expect(history.getState()).toMatchObject({canUndo: false, canRedo: true, redoDepth: 1});
        expect(history.redo()).toBe(true);
        expect(value).toBe(5);
    });

    test('does not record equal values', () => {
        const history = createPropertyHistory();
        expect(history.recordValue({
            after: {x: 1},
            apply: () => {},
            before: {x: 1},
            label: 'No-op'
        })).toBe(false);
        expect(history.getState().undoDepth).toBe(0);
    });

    test('creates one history service per runtime and clears after project load', () => {
        let projectLoadedHandler = null;
        const runtime = {
            on: jest.fn((event, handler) => {
                if (event === 'PROJECT_LOADED') projectLoadedHandler = handler;
            })
        };
        const history = getPropertyHistory(runtime);
        history.push({label: 'Test', undo: () => {}, redo: () => {}});

        expect(getPropertyHistory(runtime)).toBe(history);
        projectLoadedHandler();
        expect(history.getState().undoDepth).toBe(0);
    });
});
