/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    PROJECT_LIFECYCLE_DOMAIN_ID,
    createProjectLifecycleAuthorityRegistry
} = require('./project-lifecycle-authority');

const PROJECT_LIFECYCLE_HOST_ID = 'ngvge.project-lifecycle-host@1';
const PROJECT_LIFECYCLE_CLIENT_ID = 'ngvge.project-lifecycle-client@1';
const PROJECT_LIFECYCLE_PROPERTY = 'ngvgeProjectLifecycleHost';
const PROJECT_LIFECYCLE_VERSION = 1;

const isPromiseLike = value => value && typeof value.then === 'function';

const createLifecycleError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const createScratchProjectLifecycleBackend = vm => {
    const bind = name => (typeof vm[name] === 'function' ? vm[name].bind(vm) : null);
    return Object.freeze({
        deserializeProject: bind('deserializeProject'),
        loadProject: bind('loadProject'),
        saveProjectSb3: bind('saveProjectSb3'),
        saveProjectSb3DontZip: bind('saveProjectSb3DontZip'),
        serializeAssets: bind('serializeAssets'),
        toJSON: bind('toJSON')
    });
};

const createProjectLifecycleHost = (vm, backend = createScratchProjectLifecycleBackend(vm)) => {
    if (!vm || !vm.runtime) {
        throw createLifecycleError(
            'PROJECT_LIFECYCLE_VM_REQUIRED',
            'Project Lifecycle Host requires a Scratch VM with a runtime.',
            TypeError
        );
    }

    const authorityRegistry = createProjectLifecycleAuthorityRegistry();
    const hooks = new Map();
    const listeners = new Set();
    const activeOperations = [];
    let operationSequence = 0;
    let completedOperationCount = 0;
    let failedOperationCount = 0;
    let projectGeneration = 0;
    let lastCompletedOperation = null;
    let lastFailedOperation = null;

    const listHooks = () => Array.from(hooks.values()).sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.id.localeCompare(right.id);
    });

    const createPublicOperation = operation => (operation ? {
        id: operation.id,
        kind: operation.kind,
        nested: operation.nested,
        rootId: operation.rootId,
        rootKind: operation.rootKind,
        source: operation.source,
        startedAt: operation.startedAt
    } : null);

    const getState = () => {
        const active = activeOperations.length ? activeOperations[activeOperations.length - 1] : null;
        return Object.freeze({
            activeOperation: createPublicOperation(active),
            authority: authorityRegistry.getWriter(PROJECT_LIFECYCLE_DOMAIN_ID),
            completedOperationCount,
            failedOperationCount,
            hostId: PROJECT_LIFECYCLE_HOST_ID,
            lastCompletedOperation: lastCompletedOperation ? Object.assign({}, lastCompletedOperation) : null,
            lastFailedOperation: lastFailedOperation ? Object.assign({}, lastFailedOperation) : null,
            phase: active ? active.kind : 'idle',
            projectGeneration,
            version: PROJECT_LIFECYCLE_VERSION
        });
    };

    const emitState = type => {
        const snapshot = getState();
        listeners.forEach(listener => {
            try {
                listener({state: snapshot, type});
            } catch {
                // Lifecycle observers are diagnostics only and must never become authority.
            }
        });
    };

    const beginOperation = (kind, args, source = 'legacy-vm-api') => {
        operationSequence += 1;
        const parent = activeOperations.length ? activeOperations[activeOperations.length - 1] : null;
        const operation = {
            args: Array.from(args || []),
            id: `project-lifecycle:${operationSequence}`,
            kind,
            nested: Boolean(parent),
            rootId: parent ? parent.rootId : `project-lifecycle:${operationSequence}`,
            rootKind: parent ? parent.rootKind : kind,
            source,
            startedAt: Date.now()
        };
        activeOperations.push(operation);
        emitState('operation:start');
        return operation;
    };

    const finishOperation = (operation, error = null) => {
        const index = activeOperations.findIndex(candidate => candidate.id === operation.id);
        if (index !== -1) activeOperations.splice(index, 1);
        const record = Object.assign(createPublicOperation(operation), {
            completedAt: Date.now(),
            errorCode: error && error.code ? error.code : null,
            ok: !error
        });
        if (error) {
            failedOperationCount += 1;
            lastFailedOperation = record;
        } else {
            completedOperationCount += 1;
            lastCompletedOperation = record;
            if (operation.kind === 'load' && !operation.nested) projectGeneration += 1;
        }
        emitState(error ? 'operation:error' : 'operation:complete');
    };

    const createHookContext = operation => Object.freeze({
        args: operation.args.slice(),
        kind: operation.kind,
        nested: operation.nested,
        operationId: operation.id,
        rootKind: operation.rootKind,
        rootOperationId: operation.rootId,
        source: operation.source
    });

    const runAsyncNotificationHooks = async (name, operation, value) => {
        const context = createHookContext(operation);
        for (const hook of listHooks()) {
            if (typeof hook[name] !== 'function') continue;
            await hook[name](context, value);
        }
    };

    const runSyncNotificationHooks = (name, operation, value) => {
        const context = createHookContext(operation);
        for (const hook of listHooks()) {
            if (typeof hook[name] !== 'function') continue;
            const result = hook[name](context, value);
            if (isPromiseLike(result)) {
                throw createLifecycleError(
                    'PROJECT_LIFECYCLE_ASYNC_SYNC_HOOK',
                    `Project lifecycle hook "${hook.id}" returned a Promise from synchronous hook "${name}".`
                );
            }
        }
    };

    const runSyncTransformHooks = (name, operation, initialValue) => {
        const context = createHookContext(operation);
        let value = initialValue;
        for (const hook of listHooks()) {
            if (typeof hook[name] !== 'function') continue;
            const result = hook[name](context, value);
            if (isPromiseLike(result)) {
                throw createLifecycleError(
                    'PROJECT_LIFECYCLE_ASYNC_SYNC_HOOK',
                    `Project lifecycle hook "${hook.id}" returned a Promise from synchronous hook "${name}".`
                );
            }
            if (typeof result !== 'undefined') value = result;
        }
        return value;
    };

    const requireBackend = name => {
        const method = backend[name];
        if (typeof method !== 'function') {
            throw createLifecycleError(
                'PROJECT_LIFECYCLE_BACKEND_METHOD_UNAVAILABLE',
                `Scratch Project Lifecycle Backend does not expose ${name}().`
            );
        }
        return method;
    };

    const runAsync = async (kind, args, backendName, beforeHook, afterHook, errorHook, source) => {
        const operation = beginOperation(kind, args, source);
        try {
            await runAsyncNotificationHooks(beforeHook, operation);
            const result = await requireBackend(backendName)(...args);
            await runAsyncNotificationHooks(afterHook, operation, result);
            finishOperation(operation);
            return result;
        } catch (error) {
            try {
                await runAsyncNotificationHooks(errorHook, operation, error);
            } finally {
                finishOperation(operation, error);
            }
            throw error;
        }
    };

    const runSync = (kind, args, backendName, beforeHook, afterHook, errorHook, source) => {
        const operation = beginOperation(kind, args, source);
        try {
            runSyncNotificationHooks(beforeHook, operation);
            let result = requireBackend(backendName)(...args);
            result = runSyncTransformHooks(afterHook, operation, result);
            finishOperation(operation);
            return result;
        } catch (error) {
            try {
                runSyncNotificationHooks(errorHook, operation, error);
            } finally {
                finishOperation(operation, error);
            }
            throw error;
        }
    };

    const host = {
        clientId: PROJECT_LIFECYCLE_CLIENT_ID,
        hostId: PROJECT_LIFECYCLE_HOST_ID,
        version: PROJECT_LIFECYCLE_VERSION,
        deserializeProject: (...args) => runAsync(
            'deserialize', args, 'deserializeProject',
            'beforeDeserialize', 'afterDeserialize', 'deserializeError', 'host'
        ),
        loadProject: (...args) => runAsync(
            'load', args, 'loadProject', 'beforeLoad', 'afterLoad', 'loadError', 'host'
        ),
        saveProjectSb3: (...args) => runAsync(
            'serialize-archive', args, 'saveProjectSb3', 'beforeSerializeArchive', 'afterSerializeArchive',
            'serializeArchiveError', 'host'
        ),
        saveProjectSb3DontZip: (...args) => runSync(
            'serialize-files', args, 'saveProjectSb3DontZip', 'beforeSerializeFiles', 'afterSerializeFiles',
            'serializeFilesError', 'host'
        ),
        serializeAssets: (...args) => runSync(
            'serialize-assets', args, 'serializeAssets', 'beforeSerializeAssets', 'afterSerializeAssets',
            'serializeAssetsError', 'host'
        ),
        serializeProjectJSON: (...args) => runSync(
            'serialize-json', args, 'toJSON', 'beforeSerializeProjectJSON', 'afterSerializeProjectJSON',
            'serializeProjectJSONError', 'host'
        ),
        getState,
        registerHook (definition) {
            if (!definition || typeof definition.id !== 'string' || !definition.id.trim()) {
                throw createLifecycleError(
                    'PROJECT_LIFECYCLE_HOOK_ID_REQUIRED',
                    'Project lifecycle hooks require a stable non-empty id.',
                    TypeError
                );
            }
            const normalized = Object.assign({}, definition, {
                id: definition.id.trim(),
                priority: Number.isFinite(definition.priority) ? definition.priority : 0
            });
            hooks.set(normalized.id, normalized);
            emitState('hook:register');
            return () => {
                if (hooks.get(normalized.id) !== normalized) return false;
                hooks.delete(normalized.id);
                emitState('hook:unregister');
                return true;
            };
        },
        subscribe (listener) {
            if (typeof listener !== 'function') return () => false;
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };

    return Object.freeze(host);
};

const installProjectLifecycleHost = vm => {
    if (!vm || !vm.runtime) return null;
    const current = vm[PROJECT_LIFECYCLE_PROPERTY];
    if (current && current.version === PROJECT_LIFECYCLE_VERSION) return current;

    const backend = createScratchProjectLifecycleBackend(vm);
    const host = createProjectLifecycleHost(vm, backend);

    if (backend.loadProject) vm.loadProject = (...args) => host.loadProject(...args);
    if (backend.deserializeProject) vm.deserializeProject = (...args) => host.deserializeProject(...args);
    if (backend.toJSON) vm.toJSON = (...args) => host.serializeProjectJSON(...args);
    if (backend.serializeAssets) vm.serializeAssets = (...args) => host.serializeAssets(...args);
    if (backend.saveProjectSb3) vm.saveProjectSb3 = (...args) => host.saveProjectSb3(...args);
    if (backend.saveProjectSb3DontZip) vm.saveProjectSb3DontZip = (...args) => host.saveProjectSb3DontZip(...args);

    Object.defineProperty(vm, PROJECT_LIFECYCLE_PROPERTY, {
        configurable: false,
        enumerable: false,
        value: host,
        writable: false
    });
    if (vm.runtime && !Object.prototype.hasOwnProperty.call(vm.runtime, PROJECT_LIFECYCLE_PROPERTY)) {
        Object.defineProperty(vm.runtime, PROJECT_LIFECYCLE_PROPERTY, {
            configurable: false,
            enumerable: false,
            value: Object.freeze({
                getState: host.getState,
                hostId: host.hostId,
                version: host.version
            }),
            writable: false
        });
    }

    return host;
};

const getProjectLifecycleHost = vm => (
    vm && vm[PROJECT_LIFECYCLE_PROPERTY] ? vm[PROJECT_LIFECYCLE_PROPERTY] : null
);

module.exports = {
    PROJECT_LIFECYCLE_CLIENT_ID,
    PROJECT_LIFECYCLE_HOST_ID,
    PROJECT_LIFECYCLE_PROPERTY,
    PROJECT_LIFECYCLE_VERSION,
    createProjectLifecycleHost,
    createScratchProjectLifecycleBackend,
    getProjectLifecycleHost,
    installProjectLifecycleHost
};
