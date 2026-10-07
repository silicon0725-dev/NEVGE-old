import {
    MAX_TOOL_STATE_BYTES,
    WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID,
    WORKSPACE_TOOL_STATE_STORAGE_KEY,
    WorkspaceToolPersistenceService
} from '../../../../src/lib/editor-shell/workspace-tool-persistence';

class MemoryStorage {
    constructor () {
        this.values = new Map();
    }
    getItem (key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }
    setItem (key, value) {
        this.values.set(key, value);
    }
}

describe('WS-8 Workspace Tool Persistence service', () => {
    test('round-trips portable tool state through one Workspace-scoped record', () => {
        const storage = new MemoryStorage();
        const first = new WorkspaceToolPersistenceService({storage});
        expect(first.id).toBe(WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID);
        expect(first.scope).toBe('workspace');
        first.setState('ngvge.tool.todo', {schemaVersion: 1, tasks: [{id: 'todo-1', title: 'Ship', completed: false}]});
        expect(storage.getItem(WORKSPACE_TOOL_STATE_STORAGE_KEY)).toContain('ngvge.tool.todo');
        const second = new WorkspaceToolPersistenceService({storage});
        expect(second.getState('ngvge.tool.todo')).toEqual({
            schemaVersion: 1,
            tasks: [{id: 'todo-1', title: 'Ship', completed: false}]
        });
    });

    test('rejects secrets, backend identity, unstable ToolIds, and nonportable values', () => {
        const service = new WorkspaceToolPersistenceService();
        expect(() => service.setState('ngvge.tool.todo', {nested: {apiKey: 'secret'}})).toThrow(/forbidden/);
        expect(() => service.setState('ngvge.tool.todo', {targetId: 'scratch-target'})).toThrow(/forbidden/);
        expect(() => service.setState('scratch.todo', {})).toThrow(/stable ngvge\.tool/);
        expect(() => service.setState('ngvge.tool.todo', {fn: () => null})).toThrow(/plain data/);
    });

    test('enforces a bounded per-tool state payload', () => {
        const service = new WorkspaceToolPersistenceService();
        expect(() => service.setState('ngvge.tool.todo', {text: 'x'.repeat(MAX_TOOL_STATE_BYTES + 1)}))
            .toThrow(/exceeds/);
    });

    test('storage write failure preserves runtime state without becoming a semantic failure', () => {
        const storage = {
            getItem: () => null,
            setItem: () => {
                throw new Error('quota');
            }
        };
        const service = new WorkspaceToolPersistenceService({storage});
        service.setState('ngvge.tool.todo', {schemaVersion: 1, value: 4});
        expect(service.getState('ngvge.tool.todo')).toEqual({schemaVersion: 1, value: 4});
    });
});
