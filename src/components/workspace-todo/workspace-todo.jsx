import PropTypes from 'prop-types';
import React from 'react';

import {WORKSPACE_TODO_TOOL_MODEL_ID} from '../../lib/editor-shell/todo-tool-model';

import styles from './workspace-todo.css';

const COPY = Object.freeze({
    add: 'Add',
    clearCompleted: 'Clear completed',
    empty: 'No tasks yet.',
    inputLabel: 'New task',
    placeholder: 'Add a workspace task…',
    remove: 'Remove',
    title: 'Workspace Todo'
});

const WorkspaceTodo = ({model}) => {
    const [revision, setRevision] = React.useState(0);
    const [draft, setDraft] = React.useState('');

    React.useEffect(() => model.subscribe(event => setRevision(event.revision)), [model]);
    const snapshot = React.useMemo(() => model.getSnapshot(), [model, revision]);
    const completedCount = snapshot.tasks.filter(task => task.completed).length;

    const handleSubmit = React.useCallback(event => {
        event.preventDefault();
        if (!draft.trim()) return;
        model.add(draft);
        setDraft('');
    }, [draft, model]);
    const handleDraftChange = React.useCallback(event => setDraft(event.target.value), []);
    const handleClearCompleted = React.useCallback(() => model.clearCompleted(), [model]);
    const handleToggleTask = React.useCallback(event => {
        model.toggle(event.currentTarget.dataset.taskId);
    }, [model]);
    const handleRemoveTask = React.useCallback(event => {
        model.remove(event.currentTarget.dataset.taskId);
    }, [model]);

    return (
        <section
            className={styles.root}
            data-ngvge-todo-model={model.id}
            data-ngvge-tool-id={model.toolId}
        >
            <header className={styles.header}>
                <div>
                    <h2 className={styles.title}>{COPY.title}</h2>
                    <p className={styles.meta}>{`${snapshot.tasks.length} tasks · ${completedCount} completed`}</p>
                </div>
                <button
                    className={styles.quietButton}
                    disabled={completedCount === 0}
                    type="button"
                    onClick={handleClearCompleted}
                >
                    {COPY.clearCompleted}
                </button>
            </header>

            <form
                className={styles.addRow}
                onSubmit={handleSubmit}
            >
                <label
                    className={styles.visuallyHidden}
                    htmlFor="ngvge-workspace-todo-input"
                >
                    {COPY.inputLabel}
                </label>
                <input
                    className={styles.input}
                    id="ngvge-workspace-todo-input"
                    placeholder={COPY.placeholder}
                    type="text"
                    value={draft}
                    onChange={handleDraftChange}
                />
                <button
                    className={styles.primaryButton}
                    disabled={!draft.trim()}
                    type="submit"
                >
                    {COPY.add}
                </button>
            </form>

            <div
                className={styles.list}
                role="list"
            >
                {snapshot.tasks.length === 0 && <div className={styles.empty}>{COPY.empty}</div>}
                {snapshot.tasks.map(task => (
                    <div
                        className={styles.item}
                        data-task-id={task.id}
                        key={task.id}
                        role="listitem"
                    >
                        <label className={styles.taskLabel}>
                            <input
                                checked={task.completed}
                                className={styles.checkbox}
                                data-task-id={task.id}
                                type="checkbox"
                                onChange={handleToggleTask}
                            />
                            <span className={task.completed ? styles.completedTitle : styles.taskTitle}>
                                {task.title}
                            </span>
                        </label>
                        <button
                            aria-label={`${COPY.remove}: ${task.title}`}
                            className={styles.removeButton}
                            data-task-id={task.id}
                            type="button"
                            onClick={handleRemoveTask}
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 16 16"
                            >
                                <path
                                    d="M4 4l8 8M12 4l-8 8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeWidth="1.4"
                                />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
};

WorkspaceTodo.propTypes = {
    model: PropTypes.shape({
        add: PropTypes.func.isRequired,
        clearCompleted: PropTypes.func.isRequired,
        getSnapshot: PropTypes.func.isRequired,
        id: PropTypes.oneOf([WORKSPACE_TODO_TOOL_MODEL_ID]).isRequired,
        remove: PropTypes.func.isRequired,
        subscribe: PropTypes.func.isRequired,
        toggle: PropTypes.func.isRequired,
        toolId: PropTypes.string.isRequired
    }).isRequired
};

export default WorkspaceTodo;
