import {getGlobalAssetDatabase} from '../project-assets/global-asset-database';
import {getPropertyHistory} from '../project-inspector/property-history';

const COMMAND_MANAGER_PROPERTY = 'ngvgeEditorCommandManager';
const COMMAND_MANAGER_VERSION = 1;
const DEFAULT_SCOPE_ID = 'project';
const NATIVE_SCOPE_ID = 'native';

const normalizeKey = key => String(key || '').toLowerCase();

const normalizeShortcut = shortcut => String(shortcut || '')
    .toLowerCase()
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)
    .join('+');

const getEventShortcut = event => {
    if (!event) return '';
    const key = normalizeKey(event.key);
    if (!key || key === 'control' || key === 'meta' || key === 'alt' || key === 'shift') return '';
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('mod');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(key);
    return parts.join('+');
};

const isElement = value => Boolean(value && value.nodeType === 1);

const isEditableElement = target => {
    if (!isElement(target)) return false;
    const tagName = String(target.tagName || '').toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
    if (target.isContentEditable) return true;
    if (typeof target.closest === 'function' && target.closest('[contenteditable="true"], [role="textbox"]')) {
        return true;
    }
    return false;
};

const getExplicitScopeId = target => {
    if (!isElement(target) || typeof target.closest !== 'function') return null;
    const scopeElement = target.closest('[data-ngvge-command-scope]');
    return scopeElement ? scopeElement.getAttribute('data-ngvge-command-scope') : null;
};

const isModalTarget = target => (
    isElement(target) &&
    typeof target.closest === 'function' &&
    Boolean(target.closest('[aria-modal="true"], [role="dialog"]'))
);

const createHistoryScope = ({id, label, getState, undo, redo}) => ({
    getState,
    id,
    label,
    redo,
    undo
});

const createEditorCommandManager = vm => {
    const runtime = vm && vm.runtime;
    const commands = new Map();
    const shortcutBindings = new Map();
    const historyScopes = new Map();
    const listeners = new Set();
    const scopeUnsubscribers = new Map();
    let activeScopeId = DEFAULT_SCOPE_ID;
    let attachedDocument = null;

    const emit = change => {
        const snapshot = {
            activeScopeId,
            change,
            version: COMMAND_MANAGER_VERSION
        };
        listeners.forEach(listener => listener(snapshot));
    };

    const getScope = scopeId => historyScopes.get(scopeId || activeScopeId) || null;

    const getScopeState = scopeId => {
        const scope = getScope(scopeId);
        if (!scope || typeof scope.getState !== 'function') {
            return {
                canRedo: false,
                canUndo: false,
                redoLabel: null,
                scopeId: scopeId || activeScopeId,
                scopeLabel: null,
                undoLabel: null
            };
        }
        const state = scope.getState() || {};
        return {
            canRedo: Boolean(state.canRedo),
            canUndo: Boolean(state.canUndo),
            redoDepth: state.redoDepth || state.redoCount || 0,
            redoLabel: state.redoLabel || state.nextRedoLabel || null,
            scopeId: scope.id,
            scopeLabel: scope.label,
            undoDepth: state.undoDepth || state.undoCount || 0,
            undoLabel: state.undoLabel || state.nextUndoLabel || null
        };
    };

    const setActiveScope = (scopeId, options = {}) => {
        const normalized = scopeId || DEFAULT_SCOPE_ID;
        if (activeScopeId === normalized) return false;
        activeScopeId = normalized;
        if (!options.silent) emit({scopeId: normalized, type: 'scope:change'});
        return true;
    };

    const registerShortcut = (shortcut, commandId) => {
        const normalizedShortcut = normalizeShortcut(shortcut);
        if (!normalizedShortcut || typeof commandId !== 'string') {
            throw new TypeError('Editor shortcut must provide a shortcut and command id');
        }
        const binding = {commandId, shortcut: normalizedShortcut};
        shortcutBindings.set(normalizedShortcut, binding);
        emit({commandId, shortcut: normalizedShortcut, type: 'shortcut:register'});
        return () => {
            if (shortcutBindings.get(normalizedShortcut) !== binding) return false;
            shortcutBindings.delete(normalizedShortcut);
            emit({commandId, shortcut: normalizedShortcut, type: 'shortcut:unregister'});
            return true;
        };
    };

    const registerCommand = command => {
        if (!command || typeof command.id !== 'string' || typeof command.execute !== 'function') {
            throw new TypeError('Editor command must provide an id and execute function');
        }
        const registeredCommand = Object.assign({}, command);
        const shortcutUnsubscribers = (registeredCommand.shortcuts || [])
            .map(shortcut => registerShortcut(shortcut, registeredCommand.id));
        commands.set(command.id, registeredCommand);
        emit({commandId: command.id, type: 'command:register'});
        return () => {
            if (commands.get(command.id) !== registeredCommand) return false;
            shortcutUnsubscribers.forEach(unsubscribe => unsubscribe());
            commands.delete(command.id);
            emit({commandId: command.id, type: 'command:unregister'});
            return true;
        };
    };

    const registerHistoryScope = scope => {
        if (!scope || typeof scope.id !== 'string') {
            throw new TypeError('History scope must provide an id');
        }
        if (scopeUnsubscribers.has(scope.id)) {
            scopeUnsubscribers.get(scope.id)();
            scopeUnsubscribers.delete(scope.id);
        }
        historyScopes.set(scope.id, scope);
        if (typeof scope.subscribe === 'function') {
            const unsubscribe = scope.subscribe((state, change) => {
                emit({change, scopeId: scope.id, state, type: 'history:change'});
            });
            if (typeof unsubscribe === 'function') scopeUnsubscribers.set(scope.id, unsubscribe);
        }
        emit({scopeId: scope.id, type: 'history:register'});
        return () => {
            if (scopeUnsubscribers.has(scope.id)) {
                scopeUnsubscribers.get(scope.id)();
                scopeUnsubscribers.delete(scope.id);
            }
            historyScopes.delete(scope.id);
            emit({scopeId: scope.id, type: 'history:unregister'});
        };
    };

    const getCommandState = (commandId, context = {}) => {
        const command = commands.get(commandId);
        if (!command) return {enabled: false, label: commandId};
        const scopeId = context.scopeId || activeScopeId;
        const state = typeof command.getState === 'function' ? command.getState({
            context,
            manager: api,
            scopeId
        }) : {enabled: true};
        return Object.assign({
            enabled: true,
            id: command.id,
            label: command.label || command.id,
            scopeId,
            shortcuts: (command.shortcuts || []).slice()
        }, state || {});
    };

    const execute = (commandId, context = {}) => {
        const command = commands.get(commandId);
        if (!command) return false;
        const commandState = getCommandState(commandId, context);
        if (!commandState.enabled) return false;
        const result = command.execute({
            context,
            manager: api,
            scopeId: commandState.scopeId
        });
        if (result !== false) emit({commandId, scopeId: commandState.scopeId, type: 'command:execute'});
        return result !== false;
    };

    const resolveScopeFromTarget = target => {
        const explicitScopeId = getExplicitScopeId(target);
        if (explicitScopeId === 'preserve') return activeScopeId;
        if (explicitScopeId) return explicitScopeId;
        if (isModalTarget(target)) return NATIVE_SCOPE_ID;
        return DEFAULT_SCOPE_ID;
    };

    const resolveEventScope = event => {
        const eventTarget = event && event.target;
        const explicitEventScope = getExplicitScopeId(eventTarget);
        if (explicitEventScope === 'preserve') return activeScopeId;
        if (explicitEventScope) return explicitEventScope;
        if (typeof document !== 'undefined') {
            const explicitActiveScope = getExplicitScopeId(document.activeElement);
            if (explicitActiveScope === 'preserve') return activeScopeId;
            if (explicitActiveScope) return explicitActiveScope;
            if (isModalTarget(document.activeElement)) return NATIVE_SCOPE_ID;
        }
        return activeScopeId || DEFAULT_SCOPE_ID;
    };

    const shouldIgnoreShortcut = event => {
        if (!event || event.defaultPrevented || event.isComposing || event.altKey) return true;
        if (isEditableElement(event.target)) return true;
        if (typeof document !== 'undefined' && isEditableElement(document.activeElement)) return true;
        return false;
    };

    const handleKeyDown = event => {
        if (shouldIgnoreShortcut(event)) return;
        const shortcut = getEventShortcut(event);
        const binding = shortcutBindings.get(shortcut);
        if (!binding) return;
        const commandId = binding.commandId;
        const scopeId = resolveEventScope(event);
        if (scopeId === NATIVE_SCOPE_ID || scopeId === 'none') return;
        const handled = execute(commandId, {event, scopeId});
        if (!handled) return;
        event.preventDefault();
        event.stopPropagation();
    };

    const handleInteraction = event => {
        const scopeId = resolveScopeFromTarget(event.target);
        setActiveScope(scopeId);
    };

    const attach = targetDocument => {
        const documentTarget = targetDocument || (typeof document !== 'undefined' ? document : null);
        if (!documentTarget || attachedDocument === documentTarget) return false;
        if (attachedDocument) api.detach();
        attachedDocument = documentTarget;
        attachedDocument.addEventListener('keydown', handleKeyDown, true);
        attachedDocument.addEventListener('pointerdown', handleInteraction, true);
        attachedDocument.addEventListener('focusin', handleInteraction, true);
        emit({type: 'manager:attach'});
        return true;
    };

    const detach = () => {
        if (!attachedDocument) return false;
        attachedDocument.removeEventListener('keydown', handleKeyDown, true);
        attachedDocument.removeEventListener('pointerdown', handleInteraction, true);
        attachedDocument.removeEventListener('focusin', handleInteraction, true);
        attachedDocument = null;
        emit({type: 'manager:detach'});
        return true;
    };

    const api = {
        version: COMMAND_MANAGER_VERSION,
        attach,
        detach,
        execute,
        getActiveScopeId: () => activeScopeId,
        getCommandState,
        getScopeState,
        getShortcutBindings: () => Array.from(shortcutBindings.values()).map(binding => Object.assign({}, binding)),
        registerCommand,
        registerShortcut,
        registerHistoryScope,
        setActiveScope,
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };

    const projectHistory = getPropertyHistory(runtime);
    if (projectHistory) {
        registerHistoryScope(Object.assign(createHistoryScope({
            getState: () => projectHistory.getState(),
            id: DEFAULT_SCOPE_ID,
            label: 'Project',
            redo: () => projectHistory.redo(),
            undo: () => projectHistory.undo()
        }), {
            subscribe: listener => projectHistory.subscribe(listener)
        }));
    }

    const assetDatabase = getGlobalAssetDatabase(runtime);
    if (assetDatabase) {
        registerHistoryScope(Object.assign(createHistoryScope({
            getState: () => assetDatabase.getHistoryState(),
            id: 'assets',
            label: 'Assets',
            redo: () => assetDatabase.redo(),
            undo: () => assetDatabase.undo()
        }), {
            subscribe: listener => assetDatabase.subscribe(change => listener(assetDatabase.getHistoryState(), change))
        }));
    }

    registerCommand({
        id: 'editor.undo',
        label: 'Undo',
        shortcuts: ['mod+z'],
        execute: ({scopeId}) => {
            const scope = getScope(scopeId);
            return Boolean(scope && typeof scope.undo === 'function' && scope.undo());
        },
        getState: ({scopeId}) => {
            const state = getScopeState(scopeId);
            return {
                enabled: state.canUndo,
                label: state.undoLabel ? `Undo ${state.undoLabel}` : 'Undo',
                scopeId: state.scopeId,
                scopeLabel: state.scopeLabel
            };
        }
    });

    registerCommand({
        id: 'editor.redo',
        label: 'Redo',
        shortcuts: ['mod+shift+z', 'mod+y'],
        execute: ({scopeId}) => {
            const scope = getScope(scopeId);
            return Boolean(scope && typeof scope.redo === 'function' && scope.redo());
        },
        getState: ({scopeId}) => {
            const state = getScopeState(scopeId);
            return {
                enabled: state.canRedo,
                label: state.redoLabel ? `Redo ${state.redoLabel}` : 'Redo',
                scopeId: state.scopeId,
                scopeLabel: state.scopeLabel
            };
        }
    });

    return api;
};

const installEditorCommandManager = vm => {
    if (!vm || !vm.runtime) return null;
    const current = vm.runtime[COMMAND_MANAGER_PROPERTY];
    if (current && current.version === COMMAND_MANAGER_VERSION) return current;
    const manager = createEditorCommandManager(vm);
    vm.runtime[COMMAND_MANAGER_PROPERTY] = manager;
    return manager;
};

const getEditorCommandManager = runtime => (
    runtime && runtime[COMMAND_MANAGER_PROPERTY] ? runtime[COMMAND_MANAGER_PROPERTY] : null
);

export {
    COMMAND_MANAGER_PROPERTY,
    COMMAND_MANAGER_VERSION,
    DEFAULT_SCOPE_ID,
    NATIVE_SCOPE_ID,
    createEditorCommandManager,
    getEditorCommandManager,
    getEventShortcut,
    installEditorCommandManager,
    isEditableElement,
    normalizeShortcut
};
