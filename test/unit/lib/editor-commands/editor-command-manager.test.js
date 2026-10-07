import {
    createEditorCommandManager
} from '../../../../src/lib/editor-commands/editor-command-manager';
import {DATABASE_PROPERTY} from '../../../../src/lib/project-assets/global-asset-database';
import {getPropertyHistory} from '../../../../src/lib/project-inspector/property-history';

const createRuntime = () => ({
    on: jest.fn()
});

const dispatchShortcut = (target, options) => {
    const event = new KeyboardEvent('keydown', Object.assign({
        bubbles: true,
        cancelable: true
    }, options));
    target.dispatchEvent(event);
    return event;
};

describe('Editor command manager', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('handles project undo globally outside the inspector', () => {
        const runtime = createRuntime();
        const vm = {runtime};
        const history = getPropertyHistory(runtime);
        const undo = jest.fn();
        const redo = jest.fn();
        history.push({label: 'Move node', undo, redo});
        const manager = createEditorCommandManager(vm);
        manager.attach(document);

        const stage = document.createElement('div');
        stage.setAttribute('data-ngvge-command-scope', 'project');
        document.body.appendChild(stage);
        stage.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
        const event = dispatchShortcut(stage, {ctrlKey: true, key: 'z'});

        expect(undo).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        manager.detach();
    });

    test('routes asset shortcuts to the asset history scope', () => {
        const runtime = createRuntime();
        const assetUndo = jest.fn(() => true);
        runtime[DATABASE_PROPERTY] = {
            getHistoryState: () => ({canRedo: false, canUndo: true, undoCount: 1}),
            redo: jest.fn(() => false),
            subscribe: () => () => {},
            undo: assetUndo
        };
        const manager = createEditorCommandManager({runtime});
        manager.attach(document);

        const assets = document.createElement('div');
        assets.setAttribute('data-ngvge-command-scope', 'assets');
        document.body.appendChild(assets);
        assets.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
        dispatchShortcut(assets, {ctrlKey: true, key: 'z'});

        expect(assetUndo).toHaveBeenCalledTimes(1);
        manager.detach();
    });

    test('does not steal undo from editable or native editor targets', () => {
        const runtime = createRuntime();
        const history = getPropertyHistory(runtime);
        const undo = jest.fn();
        history.push({label: 'Rename node', undo, redo: jest.fn()});
        const manager = createEditorCommandManager({runtime});
        manager.attach(document);

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        dispatchShortcut(input, {ctrlKey: true, key: 'z'});

        const nativeEditor = document.createElement('div');
        nativeEditor.setAttribute('data-ngvge-command-scope', 'native');
        document.body.appendChild(nativeEditor);
        nativeEditor.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
        dispatchShortcut(nativeEditor, {ctrlKey: true, key: 'z'});

        expect(undo).not.toHaveBeenCalled();
        manager.detach();
    });
});
