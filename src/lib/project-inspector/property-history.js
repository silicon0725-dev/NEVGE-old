const HISTORY_PROPERTY = 'ngvgePropertyHistory';
const DEFAULT_HISTORY_LIMIT = 100;

const cloneValue = value => {
    if (typeof value === 'undefined') return undefined;
    return JSON.parse(JSON.stringify(value));
};

const valuesEqual = (valueA, valueB) => {
    if (Object.is(valueA, valueB)) return true;
    try {
        return JSON.stringify(valueA) === JSON.stringify(valueB);
    } catch (error) {
        return false;
    }
};

const createPropertyHistory = ({limit = DEFAULT_HISTORY_LIMIT} = {}) => {
    const listeners = new Set();
    const undoStack = [];
    const redoStack = [];
    let isApplying = false;

    const getState = () => ({
        canRedo: redoStack.length > 0,
        canUndo: undoStack.length > 0,
        isApplying,
        redoDepth: redoStack.length,
        redoLabel: redoStack.length ? redoStack[redoStack.length - 1].label : null,
        undoDepth: undoStack.length,
        undoLabel: undoStack.length ? undoStack[undoStack.length - 1].label : null
    });

    const emit = change => {
        const state = getState();
        listeners.forEach(listener => listener(state, change));
    };

    const push = command => {
        if (!command || typeof command.undo !== 'function' || typeof command.redo !== 'function') {
            throw new TypeError('Property history command must implement undo and redo');
        }

        undoStack.push(Object.assign({label: 'Property change'}, command));
        if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
        redoStack.length = 0;
        emit({type: 'push'});
        return true;
    };

    const applyFromStack = (source, destination, direction) => {
        if (!source.length || isApplying) return false;
        const command = source.pop();
        isApplying = true;
        emit({type: `${direction}:start`, command});
        try {
            command[direction]();
            destination.push(command);
            emit({type: direction, command});
            return true;
        } catch (error) {
            source.push(command);
            emit({type: `${direction}:error`, command, error});
            throw error;
        } finally {
            isApplying = false;
            emit({type: `${direction}:finish`, command});
        }
    };

    return {
        version: 1,
        clear () {
            if (!undoStack.length && !redoStack.length) return false;
            undoStack.length = 0;
            redoStack.length = 0;
            emit({type: 'clear'});
            return true;
        },
        getState,
        push,
        recordValue (options) {
            const before = cloneValue(options.before);
            const after = cloneValue(options.after);
            if (valuesEqual(before, after)) return false;
            return push({
                label: options.label,
                metadata: options.metadata || null,
                undo: () => options.apply(cloneValue(before)),
                redo: () => options.apply(cloneValue(after))
            });
        },
        redo () {
            return applyFromStack(redoStack, undoStack, 'redo');
        },
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        undo () {
            return applyFromStack(undoStack, redoStack, 'undo');
        }
    };
};

const getPropertyHistory = runtime => {
    if (!runtime) return null;
    const currentHistory = runtime[HISTORY_PROPERTY];
    if (
        currentHistory &&
        currentHistory.version === 1 &&
        typeof currentHistory.push === 'function' &&
        typeof currentHistory.undo === 'function'
    ) {
        return currentHistory;
    }

    const history = createPropertyHistory();
    runtime[HISTORY_PROPERTY] = history;

    if (typeof runtime.on === 'function') {
        runtime.on('PROJECT_LOADED', () => history.clear());
    }

    return history;
};

export {
    DEFAULT_HISTORY_LIMIT,
    HISTORY_PROPERTY,
    cloneValue,
    createPropertyHistory,
    getPropertyHistory,
    valuesEqual
};
