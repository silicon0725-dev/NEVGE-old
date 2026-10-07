import {TOOL_IDS} from './tool-registry';
import {WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID} from './workspace-tool-persistence';

const WORKSPACE_TODO_TOOL_MODEL_ID = 'ngvge.workspace-todo-tool-model@1';
const TODO_STATE_SCHEMA_VERSION = 1;

const normalizeStoredState = state => {
    if (!state || state.schemaVersion !== TODO_STATE_SCHEMA_VERSION || !Array.isArray(state.tasks)) {
        return {schemaVersion: TODO_STATE_SCHEMA_VERSION, nextId: 1, tasks: []};
    }
    const tasks = state.tasks.filter(task => task && typeof task.id === 'string' && typeof task.title === 'string')
        .map(task => ({id: task.id, title: task.title, completed: Boolean(task.completed)}));
    const nextId = Number.isInteger(state.nextId) && state.nextId > 0 ? state.nextId : tasks.length + 1;
    return {schemaVersion: TODO_STATE_SCHEMA_VERSION, nextId, tasks};
};

class TodoToolModel {
    constructor ({persistenceService}) {
        if (!persistenceService || persistenceService.id !== WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID) {
            throw new TypeError('Todo Tool requires NGVGE Workspace Tool Persistence service.');
        }
        this.id = WORKSPACE_TODO_TOOL_MODEL_ID;
        this.toolId = TOOL_IDS.TODO;
        this._persistenceService = persistenceService;
        this._listeners = new Set();
        this._revision = 0;
        this._state = normalizeStoredState(persistenceService.getState(this.toolId, null));
    }

    subscribe (listener) {
        if (typeof listener !== 'function') throw new TypeError('Todo Tool listener must be a function.');
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _commit (type) {
        this._persistenceService.setState(this.toolId, this._state);
        this._revision += 1;
        const event = Object.freeze({modelId: this.id, revision: this._revision, type});
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    getSnapshot () {
        return Object.freeze({
            modelId: this.id,
            revision: this._revision,
            tasks: Object.freeze(this._state.tasks.map(task => Object.freeze({...task})))
        });
    }

    add (title) {
        if (typeof title !== 'string' || !title.trim()) throw new TypeError('Todo title must be non-empty.');
        const id = `todo-${this._state.nextId}`;
        this._state = {
            ...this._state,
            nextId: this._state.nextId + 1,
            tasks: [...this._state.tasks, {id, title: title.trim(), completed: false}]
        };
        this._commit('todo:added');
        return id;
    }

    toggle (taskId) {
        let changed = false;
        const tasks = this._state.tasks.map(task => {
            if (task.id !== taskId) return task;
            changed = true;
            return {...task, completed: !task.completed};
        });
        if (!changed) return false;
        this._state = {...this._state, tasks};
        this._commit('todo:toggled');
        return true;
    }

    remove (taskId) {
        const tasks = this._state.tasks.filter(task => task.id !== taskId);
        if (tasks.length === this._state.tasks.length) return false;
        this._state = {...this._state, tasks};
        this._commit('todo:removed');
        return true;
    }

    clearCompleted () {
        const tasks = this._state.tasks.filter(task => !task.completed);
        if (tasks.length === this._state.tasks.length) return false;
        this._state = {...this._state, tasks};
        this._commit('todo:completed-cleared');
        return true;
    }
}

export {WORKSPACE_TODO_TOOL_MODEL_ID, TODO_STATE_SCHEMA_VERSION, TodoToolModel};
