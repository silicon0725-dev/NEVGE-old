import {TodoToolModel} from '../../../../src/lib/editor-shell/todo-tool-model';
import {WorkspaceToolPersistenceService} from '../../../../src/lib/editor-shell/workspace-tool-persistence';

class MemoryStorage {
    constructor () {
        this.value = null;
    }
    getItem () {
        return this.value;
    }
    setItem (key, value) {
        this.value = value;
    }
}

describe('WS-8 Todo reference tool model', () => {
    test('adds, toggles, removes, clears, and persists Workspace tasks', () => {
        const storage = new MemoryStorage();
        const service = new WorkspaceToolPersistenceService({storage});
        const model = new TodoToolModel({persistenceService: service});
        const first = model.add('Review Tool contract');
        const second = model.add('Run Webpack');
        expect(first).toBe('todo-1');
        expect(second).toBe('todo-2');
        expect(model.toggle(first)).toBe(true);
        expect(model.remove('missing')).toBe(false);
        expect(model.getSnapshot().tasks[0].completed).toBe(true);
        expect(model.clearCompleted()).toBe(true);
        expect(model.getSnapshot().tasks.map(task => task.id)).toEqual([second]);

        const reloaded = new TodoToolModel({
            persistenceService: new WorkspaceToolPersistenceService({storage})
        });
        expect(reloaded.getSnapshot().tasks).toEqual([{id: second, title: 'Run Webpack', completed: false}]);
        expect(reloaded.add('Next').startsWith('todo-')).toBe(true);
    });

    test('requires the NGVGE Workspace Tool Persistence service', () => {
        expect(() => new TodoToolModel({persistenceService: {id: 'other'}})).toThrow(/requires/);
    });
});
