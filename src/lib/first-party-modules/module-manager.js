const ModuleCapabilityRegistry = require('./capability-registry');
const ModuleDataStore = require('./module-data-store');
const FirstPartyModuleRegistry = require('./module-registry');
const {
    MODULE_AVAILABILITY,
    MODULE_FRAMEWORK_VERSION,
    SB3_COMPATIBILITY_LEVELS,
    SB3_COMPATIBILITY_PRIORITY
} = require('./constants');
const {MODULE_ENABLE_COMPLETION, MODULE_STATES} = require('./module-lifecycle-constants');
const {cloneSerializable} = require('./module-manifest');
const {createObserverErrorRecorder} = require('./observer-dispatch');
const {createServiceFacadeFactory} = require('./service-facade');


const hostManagerInstances = new WeakSet();
const clientFacadeOwners = new WeakMap();

const createInitialState = manifest => ({
    enableCompletion: MODULE_ENABLE_COMPLETION.IDLE,
    enabled: false,
    error: null,
    initialized: false,
    moduleId: manifest.id,
    state: MODULE_STATES.REGISTERED
});

const createModuleManager = (options = {}) => {
    let observerDispatchDepth = 0;
    let enableBatchDepth = 0;
    let enableCompletionDepth = 0;
    let activeCompletionModuleId = null;
    let disposed = false;
    let suppressProjectChanges = false;
    let unknownProjectModules = {};

    if (options.registry || options.capabilities || options.dataStore) {
        const error = new Error(
            'Custom Module Registry, Capability Registry, and Data Store injection is not supported by the sealed authority domain.'
        );
        error.code = 'MODULE_HOST_INFRASTRUCTURE_INJECTION_FORBIDDEN';
        throw error;
    }

    const managerIdentity = Object.freeze({kind: 'module-manager-identity'});
    const hostAuthority = Object.freeze({kind: 'module-host-authority'});
    const recoveryAuthority = Object.freeze({kind: 'module-recovery-authority'});
    const hostClientAuthority = Object.freeze({kind: 'module-host-client-authority'});
    const moduleAuthorities = new Map();
    const hookExecutionStack = [];
    const getActiveHook = () => hookExecutionStack.length ? hookExecutionStack[hookExecutionStack.length - 1] : null;
    const createModuleAuthority = moduleId => Object.freeze({
        generation: Object.freeze({moduleId}),
        kind: 'module-client-authority',
        moduleId
    });
    const installModuleAuthority = moduleId => {
        const authority = createModuleAuthority(moduleId);
        moduleAuthorities.set(moduleId, authority);
        return authority;
    };
    const getModuleAuthority = moduleId => moduleAuthorities.get(moduleId) || null;
    const isModuleAuthorityFor = (authority, moduleId) => Boolean(
        authority && moduleAuthorities.get(moduleId) === authority
    );

    const enterObserverDispatch = () => { observerDispatchDepth += 1; };
    const leaveObserverDispatch = () => { observerDispatchDepth -= 1; };
    const createLifecycleMutationError = (code, operation, details = {}) => {
        const error = new Error(`Module lifecycle mutation "${operation}" is forbidden in the current execution phase.`);
        error.code = code;
        error.operation = operation;
        error.moduleId = activeCompletionModuleId || (getActiveHook() && getActiveHook().moduleId) || null;
        Object.assign(error, details);
        return error;
    };
    const assertLifecycleMutationAllowed = (operation, mutationOptions = {}) => {
        if (disposed) {
            throw createLifecycleMutationError('MODULE_MANAGER_DISPOSED', operation);
        }
        if (observerDispatchDepth > 0) {
            throw createLifecycleMutationError('MODULE_OBSERVER_REENTRANT_MUTATION', operation);
        }
        if (enableCompletionDepth > 0 && mutationOptions.allowDuringCompletion !== true) {
            throw createLifecycleMutationError('MODULE_COMPLETION_REENTRANT_MUTATION', operation);
        }
    };
    const assertHostSurfaceAllowed = (operation, mutationOptions = {}) => {
        assertLifecycleMutationAllowed(operation, mutationOptions);
        const activeHook = getActiveHook();
        if (activeHook && mutationOptions.allowFromModuleHook !== true) {
            throw createLifecycleMutationError('MODULE_HOST_AUTHORITY_REQUIRED', operation, {
                hookName: activeHook.hookName
            });
        }
    };
    const assertInfrastructureMutationAllowed = (surface, operation, context = {}) => {
        const operationName = `${surface}:${operation}`;
        if (disposed) {
            throw createLifecycleMutationError('MODULE_MANAGER_DISPOSED', operationName);
        }

        // Recovery authority is a private, non-exported compensating authority. It may only
        // remove capabilities that belong to the module currently being repaired. It is
        // intentionally checked before observer/completion guards because rollback must be
        // able to restore invariants even when the original failure occurred inside one of
        // those synchronous execution phases. No creation or cross-provider mutation is
        // permitted through this authority.
        if (context.authority === recoveryAuthority) {
            if (surface === 'capability' &&
                (operation === 'revoke' || operation === 'revokeByProvider') &&
                typeof context.providerModuleId === 'string' && context.providerModuleId) {
                return true;
            }
            throw createLifecycleMutationError('MODULE_RECOVERY_AUTHORITY_SCOPE_VIOLATION', operationName);
        }

        if (observerDispatchDepth > 0) {
            throw createLifecycleMutationError('MODULE_OBSERVER_REENTRANT_MUTATION', operationName);
        }
        if (context.authority === hostAuthority) return true;

        const activeHook = getActiveHook();
        const authorityModuleId = context.authority && context.authority.kind === 'module-client-authority' ?
            context.authority.moduleId : null;
        if (authorityModuleId && !isModuleAuthorityFor(context.authority, authorityModuleId)) {
            throw createLifecycleMutationError('MODULE_CLIENT_AUTHORITY_REVOKED', operationName, {
                authorityModuleId
            });
        }

        const authorityOwnsTarget = surface === 'capability' ?
            isModuleAuthorityFor(context.authority, context.providerModuleId) :
            surface === 'data-store' ? isModuleAuthorityFor(context.authority, context.moduleId) : false;
        const authorityMatchesActiveHook = Boolean(
            activeHook && isModuleAuthorityFor(context.authority, activeHook.moduleId)
        );

        if (surface === 'capability' && authorityOwnsTarget) {
            if (operation === 'provide') {
                const phasePermit = context.phasePermit || null;
                const allowedHook = activeHook && phasePermit === activeHook &&
                    phasePermit.authority === context.authority &&
                    phasePermit.moduleId === context.providerModuleId &&
                    authorityMatchesActiveHook &&
                    ['initialize', 'enable', 'completeEnable'].includes(activeHook.hookName);
                if (!allowedHook) {
                    throw createLifecycleMutationError('MODULE_CAPABILITY_PROVISION_PHASE_FORBIDDEN', operationName, {
                        hookName: activeHook ? activeHook.hookName : null
                    });
                }
                return true;
            }
            if (operation === 'revoke') {
                if (enableCompletionDepth > 0) {
                    throw createLifecycleMutationError('MODULE_COMPLETION_REENTRANT_MUTATION', operationName);
                }
                if (activeHook && !authorityMatchesActiveHook) {
                    throw createLifecycleMutationError('MODULE_CAPABILITY_PROVIDER_IDENTITY_FORBIDDEN', operationName);
                }
                return true;
            }
        }

        if (enableCompletionDepth > 0 && !(authorityOwnsTarget && authorityMatchesActiveHook)) {
            throw createLifecycleMutationError('MODULE_COMPLETION_REENTRANT_MUTATION', operationName);
        }

        if (activeHook) {
            if (authorityOwnsTarget && authorityMatchesActiveHook) return true;
            const code = surface === 'capability' ?
                'MODULE_CAPABILITY_PROVIDER_IDENTITY_FORBIDDEN' :
                surface === 'data-store' ? 'MODULE_DATA_OWNER_IDENTITY_FORBIDDEN' :
                'MODULE_HOST_AUTHORITY_REQUIRED';
            throw createLifecycleMutationError(code, operationName, {
                hookName: activeHook.hookName,
                requestedModuleId: context.providerModuleId || context.moduleId || null
            });
        }

        if (context.authority && context.authority !== hostAuthority) {
            if (authorityOwnsTarget) return true;
            const code = surface === 'capability' ?
                'MODULE_CAPABILITY_PROVIDER_IDENTITY_FORBIDDEN' :
                surface === 'data-store' ? 'MODULE_DATA_OWNER_IDENTITY_FORBIDDEN' :
                'MODULE_HOST_AUTHORITY_REQUIRED';
            throw createLifecycleMutationError(code, operationName);
        }
        throw createLifecycleMutationError('MODULE_HOST_AUTHORITY_REQUIRED', operationName);
    };
    const observerOptions = {
        enterObserverDispatch,
        leaveObserverDispatch,
        onObserverError: options.onObserverError
    };
    const observerErrors = createObserverErrorRecorder(options.onObserverError, {
        enterDispatch: enterObserverDispatch,
        leaveDispatch: leaveObserverDispatch
    });
    const registry = new FirstPartyModuleRegistry(Object.assign({}, observerOptions, {
        assertMutationAllowed: (operation, context) =>
            assertInfrastructureMutationAllowed('module-registry', operation, context)
    }));
    const capabilities = new ModuleCapabilityRegistry(Object.assign({}, observerOptions, {
        assertMutationAllowed: (operation, context) =>
            assertInfrastructureMutationAllowed('capability', operation, context)
    }));
    const listeners = new Set();
    const states = new Map();
    const moduleCapabilityDisposers = new Map();
    const moduleSubscriptionDisposers = new Map();
    const pendingEnableCompletions = new Map();
    const moduleClientFacades = new WeakMap();
    const serviceFacadeFactories = new WeakMap();
    const capabilityFacadeFactories = new WeakMap();
    const serviceDescriptors = new Map();
    Object.keys(options.services || {}).forEach(serviceId => {
        const source = options.services[serviceId];
        const descriptor = source && typeof source === 'object' &&
            Object.prototype.hasOwnProperty.call(source, 'value') ? source : {value: source};
        serviceDescriptors.set(serviceId, Object.freeze({
            permission: typeof descriptor.permission === 'string' ? descriptor.permission : null,
            value: descriptor.value
        }));
    });

    const markProjectChanged = change => {
        if (suppressProjectChanges) return;
        if (typeof options.onProjectChanged === 'function') options.onProjectChanged(change);
    };

    const dataStore = new ModuleDataStore(change => {
        markProjectChanged({change, type: 'module-data'});
        emit({change, type: 'module-data'});
    }, Object.assign({}, observerOptions, {
        assertMutationAllowed: (operation, context) =>
            assertInfrastructureMutationAllowed('data-store', operation, context)
    }));

    const emit = change => {
        const snapshot = Object.assign({version: MODULE_FRAMEWORK_VERSION}, change);
        observerErrors.dispatch(listeners, snapshot, {source: 'module-manager', type: change && change.type});
    };

    const getRecord = moduleId => registry.get(moduleId);

    const getStateInternal = moduleId => {
        const record = getRecord(moduleId);
        if (!record) return null;
        if (!states.has(moduleId)) states.set(moduleId, createInitialState(record.manifest));
        return states.get(moduleId);
    };

    const setState = (moduleId, patch, changeType) => {
        const state = getStateInternal(moduleId);
        if (!state) return null;
        Object.assign(state, patch);
        emit({moduleId, state: cloneSerializable(state), type: changeType});
        return state;
    };

    const hasPermission = (manifest, permission) => manifest.permissions.indexOf(permission) !== -1;

    const resolveEmbeddedManagerAuthority = (value, moduleId) => {
        if (value === api) return {handled: true, value: getModuleClientFacade(moduleId)};
        if (hostManagerInstances.has(value)) {
            const error = new Error('A foreign Module Host Manager cannot cross a Module Service or Capability boundary.');
            error.code = 'MODULE_HOST_AUTHORITY_EXPOSURE_FORBIDDEN';
            error.moduleId = moduleId;
            throw error;
        }
        const clientOwner = clientFacadeOwners.get(value);
        if (!clientOwner) return null;
        if (clientOwner.managerIdentity !== managerIdentity) {
            const error = new Error('A foreign Module Client facade cannot cross a Module Service or Capability boundary.');
            error.code = 'MODULE_FOREIGN_CLIENT_AUTHORITY_FORBIDDEN';
            error.moduleId = moduleId;
            throw error;
        }
        return {handled: true, value: getModuleClientFacade(moduleId)};
    };

    const getService = (manifest, moduleAuthority, serviceId) => {
        assertModuleClientActive(manifest.id, moduleAuthority, `service:${serviceId}:get`);
        const descriptor = serviceDescriptors.get(serviceId);
        if (!descriptor) return null;
        const requiredPermission = descriptor.permission;
        if (requiredPermission && !hasPermission(manifest, requiredPermission)) {
            const error = new Error(
                `Module "${manifest.id}" does not have permission "${requiredPermission}" for service "${serviceId}".`
            );
            error.code = 'MODULE_SERVICE_PERMISSION_DENIED';
            error.moduleId = manifest.id;
            error.permission = requiredPermission;
            error.serviceId = serviceId;
            throw error;
        }
        if (!descriptor.value || (typeof descriptor.value !== 'object' && typeof descriptor.value !== 'function')) {
            return descriptor.value;
        }
        if (!serviceFacadeFactories.has(moduleAuthority)) serviceFacadeFactories.set(moduleAuthority, new Map());
        const factories = serviceFacadeFactories.get(moduleAuthority);
        if (!factories.has(serviceId)) {
            factories.set(serviceId, createServiceFacadeFactory({
                assertActive: operation => assertModuleClientActive(manifest.id, moduleAuthority, operation),
                boundaryKind: 'service',
                resolveValue: value => resolveEmbeddedManagerAuthority(value, manifest.id),
                serviceId
            }));
        }
        return factories.get(serviceId).wrap(descriptor.value);
    };

    const getCapabilityForClient = (moduleId, authority, capabilityId, required = false) => {
        assertModuleClientActive(moduleId, authority, `capability:${capabilityId}:get`);
        const record = capabilities.getRecord(capabilityId);
        if (!record) {
            if (required) throw new Error(`Required capability "${capabilityId}" is unavailable.`);
            return null;
        }
        if (!record.value || (typeof record.value !== 'object' && typeof record.value !== 'function')) {
            return record.value;
        }
        if (!capabilityFacadeFactories.has(authority)) capabilityFacadeFactories.set(authority, new WeakMap());
        const factories = capabilityFacadeFactories.get(authority);
        if (!factories.has(record)) {
            factories.set(record, createServiceFacadeFactory({
                assertActive: operation => {
                    assertModuleClientActive(moduleId, authority, operation);
                    if (capabilities.getRecord(capabilityId) !== record) {
                        throw createLifecycleMutationError('MODULE_CAPABILITY_AUTHORITY_REVOKED', operation, {
                            capabilityId,
                            moduleId
                        });
                    }
                },
                boundaryKind: 'capability',
                resolveValue: value => resolveEmbeddedManagerAuthority(value, moduleId),
                serviceId: `capability:${capabilityId}`
            }));
        }
        return factories.get(record).wrap(record.value);
    };

    const listCapabilitiesForClient = (moduleId, authority) => {
        assertModuleClientActive(moduleId, authority, 'capability:list');
        return capabilities.list().map(record => Object.freeze(Object.assign({}, record, {
            value: getCapabilityForClient(moduleId, authority, record.capabilityId)
        })));
    };


    let api = null;

    const HOST_CLIENT_FACADE_ID = 'ngvge.host-client';
    const trackModuleSubscription = (moduleId, disposer) => {
        if (moduleId === HOST_CLIENT_FACADE_ID || typeof disposer !== 'function') return disposer;
        if (!moduleSubscriptionDisposers.has(moduleId)) moduleSubscriptionDisposers.set(moduleId, new Set());
        moduleSubscriptionDisposers.get(moduleId).add(disposer);
        return () => {
            moduleSubscriptionDisposers.get(moduleId)?.delete(disposer);
            return disposer();
        };
    };
    const disposeModuleSubscriptions = moduleId => {
        const disposers = moduleSubscriptionDisposers.get(moduleId);
        if (!disposers) return;
        disposers.forEach(disposer => {
            try {
                disposer();
            } catch {
                // Subscription cleanup is best-effort and cannot block lifecycle cleanup.
            }
        });
        moduleSubscriptionDisposers.delete(moduleId);
    };
    const assertModuleClientActive = (moduleId, authority, operation) => {
        if (disposed) {
            throw createLifecycleMutationError('MODULE_MANAGER_DISPOSED', operation, {moduleId});
        }
        if (moduleId === HOST_CLIENT_FACADE_ID) {
            if (authority !== hostClientAuthority) {
                throw createLifecycleMutationError('MODULE_CLIENT_AUTHORITY_REVOKED', operation, {moduleId});
            }
            return true;
        }
        if (!getRecord(moduleId) || !isModuleAuthorityFor(authority, moduleId)) {
            throw createLifecycleMutationError('MODULE_CLIENT_AUTHORITY_REVOKED', operation, {moduleId});
        }
        return true;
    };
    const assertClientEnablePhase = (moduleId, authority) => {
        assertModuleClientActive(moduleId, authority, 'client:enableModule');
        if (moduleId === HOST_CLIENT_FACADE_ID) return true;
        const activeHook = getActiveHook();
        if (activeHook && activeHook.hookName === 'completeEnable' && activeHook.moduleId === moduleId) return true;
        throw createLifecycleMutationError('MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN', 'client:enableModule', {
            hookName: activeHook ? activeHook.hookName : null,
            requestingModuleId: moduleId
        });
    };
    const createReadOnlyModuleDataFacade = (ownerModuleId, authority) => Object.freeze({
        get: (moduleId, fallback) => {
            assertModuleClientActive(ownerModuleId, authority, 'client:moduleData:get');
            return dataStore.get(moduleId, fallback);
        },
        subscribe: listener => {
            assertModuleClientActive(ownerModuleId, authority, 'client:moduleData:subscribe');
            return trackModuleSubscription(ownerModuleId, dataStore.subscribe(listener));
        }
    });

    const getModuleClientFacade = moduleId => {
        const authority = moduleId === HOST_CLIENT_FACADE_ID ? hostClientAuthority : getModuleAuthority(moduleId);
        if (!authority) {
            throw createLifecycleMutationError('MODULE_CLIENT_AUTHORITY_REVOKED', 'client:createFacade', {moduleId});
        }
        if (moduleClientFacades.has(authority)) return moduleClientFacades.get(authority);
        const facadeDefinition = {
            version: MODULE_FRAMEWORK_VERSION,
            enableModule: (targetModuleId, enableOptions = {}) => {
                assertClientEnablePhase(moduleId, authority);
                return enableModule(targetModuleId, enableOptions);
            },
            getCapability: capabilityId =>
                getCapabilityForClient(moduleId, authority, capabilityId),
            getModuleData: (targetModuleId, fallback) => {
                assertModuleClientActive(moduleId, authority, 'client:getModuleData');
                return dataStore.get(targetModuleId, fallback);
            },
            getModuleState: targetModuleId => {
                assertModuleClientActive(moduleId, authority, 'client:getModuleState');
                return getModuleState(targetModuleId);
            },
            getObserverErrorSnapshot: () => {
                assertModuleClientActive(moduleId, authority, 'client:getObserverErrorSnapshot');
                return observerErrors.getSnapshot();
            },
            getSB3CompatibilityReport: reportOptions => {
                assertModuleClientActive(moduleId, authority, 'client:getSB3CompatibilityReport');
                return getSB3CompatibilityReport(reportOptions);
            },
            listModules: () => {
                assertModuleClientActive(moduleId, authority, 'client:listModules');
                return listModules();
            },
            moduleData: createReadOnlyModuleDataFacade(moduleId, authority)
        };
        if (moduleId === HOST_CLIENT_FACADE_ID) {
            facadeDefinition.disableModule = (targetModuleId, disableOptions = {}) => {
                assertModuleClientActive(moduleId, authority, 'client:disableModule');
                return disableModule(targetModuleId, disableOptions);
            };
            facadeDefinition.subscribe = listener => {
                assertModuleClientActive(moduleId, authority, 'client:subscribe');
                if (typeof listener !== 'function') return () => {};
                listeners.add(listener);
                return () => listeners.delete(listener);
            };
        }
        const facade = Object.freeze(facadeDefinition);
        moduleClientFacades.set(authority, facade);
        clientFacadeOwners.set(facade, Object.freeze({managerIdentity, moduleId}));
        return facade;
    };

    const createContext = (moduleId, hookFrame) => {
        const record = getRecord(moduleId);
        if (!record) throw new Error(`Unknown module: ${moduleId}`);
        const manifest = record.manifest;
        const moduleAuthority = hookFrame && hookFrame.authority;
        if (!moduleAuthority || hookFrame.moduleId !== moduleId || !isModuleAuthorityFor(moduleAuthority, moduleId)) {
            throw createLifecycleMutationError('MODULE_CLIENT_AUTHORITY_REVOKED', 'context:create', {moduleId});
        }
        return Object.freeze({
            capabilities: Object.freeze({
                get: capabilityId =>
                    getCapabilityForClient(moduleId, moduleAuthority, capabilityId),
                list: () => listCapabilitiesForClient(moduleId, moduleAuthority),
                provide: (capabilityId, value, capabilityOptions = {}) => {
                    const disposer = capabilities.provide(
                        moduleId,
                        capabilityId,
                        value,
                        capabilityOptions,
                        moduleAuthority,
                        hookFrame
                    );
                    if (!moduleCapabilityDisposers.has(moduleId)) moduleCapabilityDisposers.set(moduleId, new Set());
                    moduleCapabilityDisposers.get(moduleId).add(disposer);
                    return disposer;
                },
                require: capabilityId =>
                    getCapabilityForClient(moduleId, moduleAuthority, capabilityId, true)
            }),
            data: Object.freeze({
                get: fallback => {
                    assertModuleClientActive(moduleId, moduleAuthority, 'data:get');
                    return dataStore.get(moduleId, fallback);
                },
                set: value => dataStore.set(moduleId, value, {}, moduleAuthority),
                subscribe: listener => {
                    assertModuleClientActive(moduleId, moduleAuthority, 'data:subscribe');
                    if (typeof listener !== 'function') return () => {};
                    return trackModuleSubscription(moduleId, dataStore.subscribe(change => {
                        if (!change || change.moduleId !== moduleId) return;
                        listener(change);
                    }));
                },
                update: updater => dataStore.update(moduleId, updater, {}, moduleAuthority)
            }),
            getService: serviceId => getService(manifest, moduleAuthority, serviceId),
            manager: getModuleClientFacade(moduleId),
            manifest,
            moduleId,
            permissions: Object.freeze({
                has: permission => hasPermission(manifest, permission),
                require: permission => {
                    if (!hasPermission(manifest, permission)) {
                        throw new Error(`Module "${moduleId}" requires permission "${permission}".`);
                    }
                    return true;
                }
            })
        });
    };

    const callHook = (moduleId, hookName, ...args) => {
        const record = getRecord(moduleId);
        if (!record || typeof record.hooks[hookName] !== 'function') return undefined;
        const authority = getModuleAuthority(moduleId);
        if (!authority) {
            throw createLifecycleMutationError('MODULE_CLIENT_AUTHORITY_REVOKED', `hook:${hookName}`, {moduleId});
        }
        const hookFrame = Object.freeze({authority, hookName, moduleId});
        hookExecutionStack.push(hookFrame);
        try {
            return record.hooks[hookName](createContext(moduleId, hookFrame), ...args);
        } finally {
            hookExecutionStack.pop();
        }
    };

    const isEnableCompletionPending = state => Boolean(
        state && state.enableCompletion === MODULE_ENABLE_COMPLETION.PENDING
    );

    const isModuleOperational = state => Boolean(
        state && state.enabled && state.enableCompletion === MODULE_ENABLE_COMPLETION.COMPLETED
    );

    const isEnableStageActive = state => Boolean(
        state && (isModuleOperational(state) || isEnableCompletionPending(state))
    );

    const rollbackEnableStage = (moduleId, error, options = {}) => {
        const state = getStateInternal(moduleId);
        pendingEnableCompletions.delete(moduleId);
        if (state && isEnableStageActive(state) && options.skipDisable !== true) {
            try {
                callHook(moduleId, 'disable');
            } catch {
                // Recovery cleanup below is authoritative and must continue even if the
                // module's optional disable hook cannot run in the failing phase.
            }
        }
        try {
            disposeModuleCapabilities(moduleId, recoveryAuthority);
        } catch {
            // Never replace the original lifecycle failure with a cleanup failure. The
            // recovery authority is deliberately narrow enough that a failure here means
            // an internal framework defect; state repair must still preserve the original
            // error for diagnosis.
        }
        setState(moduleId, {
            enableCompletion: MODULE_ENABLE_COMPLETION.FAILED,
            enabled: false,
            error: error && error.message ? error.message : String(error),
            state: MODULE_STATES.ERROR
        }, 'module:error');
    };

    const getIncompleteRequiredDependencies = moduleId => {
        const record = getRecord(moduleId);
        if (!record) return [];
        return record.manifest.dependencies
            .filter(dependency => !dependency.optional)
            .map(dependency => dependency.id)
            .filter(dependencyId => !isModuleOperational(getStateInternal(dependencyId)));
    };

    const completePendingEnableHooks = () => {
        if (enableCompletionDepth > 0) return true;
        enableCompletionDepth += 1;
        let firstError = null;
        try {
            while (pendingEnableCompletions.size > 0) {
                let progressed = false;
                const pending = Array.from(pendingEnableCompletions.entries());
                for (const [moduleId, completionOptions] of pending) {
                    const state = getStateInternal(moduleId);
                    if (!state || !isEnableCompletionPending(state)) {
                        pendingEnableCompletions.delete(moduleId);
                        progressed = true;
                        continue;
                    }
                    const incompleteDependencies = getIncompleteRequiredDependencies(moduleId);
                    const waitingDependencies = incompleteDependencies.filter(dependencyId => {
                        const dependencyState = getStateInternal(dependencyId);
                        return isEnableCompletionPending(dependencyState) &&
                            pendingEnableCompletions.has(dependencyId);
                    });
                    if (waitingDependencies.length) continue;
                    if (incompleteDependencies.length) {
                        const error = new Error(
                            `Module "${moduleId}" cannot complete enable because required dependencies are incomplete: ` +
                            incompleteDependencies.join(', ')
                        );
                        error.code = 'MODULE_ENABLE_DEPENDENCY_INCOMPLETE';
                        error.moduleId = moduleId;
                        error.dependencies = incompleteDependencies;
                        rollbackEnableStage(moduleId, error);
                        if (!firstError) firstError = error;
                        progressed = true;
                        continue;
                    }
                    pendingEnableCompletions.delete(moduleId);
                    try {
                        activeCompletionModuleId = moduleId;
                        callHook(moduleId, 'completeEnable');
                        setState(moduleId, {
                            enableCompletion: MODULE_ENABLE_COMPLETION.COMPLETED,
                            enabled: true,
                            error: null,
                            state: MODULE_STATES.ENABLED
                        }, 'module:enable-complete');
                        if (!completionOptions.silent) markProjectChanged({moduleId, type: 'module-enable'});
                    } catch (error) {
                        rollbackEnableStage(moduleId, error);
                        if (!firstError) firstError = error;
                    } finally {
                        activeCompletionModuleId = null;
                    }
                    progressed = true;
                }
                if (!progressed && pendingEnableCompletions.size > 0) {
                    const blocked = Array.from(pendingEnableCompletions.keys());
                    const error = new Error(
                        `Module enable completion queue cannot make progress: ${blocked.join(', ')}`
                    );
                    error.code = 'MODULE_ENABLE_COMPLETION_DEADLOCK';
                    error.modules = blocked;
                    blocked.forEach(moduleId => rollbackEnableStage(moduleId, error));
                    if (!firstError) firstError = error;
                }
            }
        } finally {
            enableCompletionDepth -= 1;
        }
        if (firstError) throw firstError;
        return true;
    };

    const runEnableBatch = callback => {
        enableBatchDepth += 1;
        let result;
        let callbackError = null;
        let completionError = null;
        try {
            result = callback();
        } catch (error) {
            callbackError = error;
        } finally {
            enableBatchDepth -= 1;
            if (enableBatchDepth === 0 && enableCompletionDepth === 0) {
                try {
                    completePendingEnableHooks();
                } catch (error) {
                    completionError = error;
                }
            }
        }
        if (callbackError) {
            if (completionError) callbackError.enableCompletionError = completionError;
            throw callbackError;
        }
        if (completionError) throw completionError;
        return result;
    };

    const registerModule = definition => {
        assertLifecycleMutationAllowed('registerModule');
        const record = registry.register(definition, hostAuthority);
        installModuleAuthority(record.manifest.id);
        disposeModuleSubscriptions(record.manifest.id);
        states.set(record.manifest.id, createInitialState(record.manifest));
        emit({manifest: record.manifest, moduleId: record.manifest.id, type: 'module:register'});
        return record;
    };

    const unregisterModule = (moduleId, unregisterOptions = {}) => {
        assertLifecycleMutationAllowed('unregisterModule');
        const record = getRecord(moduleId);
        if (!record) return false;
        const state = getStateInternal(moduleId);
        if (state && isEnableStageActive(state)) {
            disableModule(moduleId, {
                cascade: Boolean(unregisterOptions.cascade),
                force: Boolean(unregisterOptions.force),
                silent: Boolean(unregisterOptions.silent)
            });
        }
        callHook(moduleId, 'dispose');
        disposeModuleCapabilities(moduleId);
        states.delete(moduleId);
        disposeModuleSubscriptions(moduleId);
        const removed = registry.unregister(moduleId, hostAuthority);
        moduleAuthorities.delete(moduleId);
        if (removed) emit({moduleId, type: 'module:unregister'});
        return removed;
    };

    const initializeModule = (moduleId, internalEnable = false) => {
        assertLifecycleMutationAllowed('initializeModule', {allowDuringCompletion: internalEnable});
        const record = getRecord(moduleId);
        if (!record) throw new Error(`Unknown module: ${moduleId}`);
        const state = getStateInternal(moduleId);
        if (state.initialized) return true;
        try {
            callHook(moduleId, 'initialize');
            setState(moduleId, {
                error: null,
                initialized: true,
                state: MODULE_STATES.INITIALIZED
            }, 'module:initialize');
            return true;
        } catch (error) {
            try {
                disposeModuleCapabilities(moduleId, recoveryAuthority);
            } catch {
                // Preserve the original initialize failure; cleanup failures must not mask it.
            }
            setState(moduleId, {
                enableCompletion: MODULE_ENABLE_COMPLETION.FAILED,
                enabled: false,
                error: error && error.message ? error.message : String(error),
                state: MODULE_STATES.ERROR
            }, 'module:error');
            throw error;
        }
    };

    const getEnabledDependents = moduleId => registry.list()
        .filter(record => {
            const state = getStateInternal(record.manifest.id);
            return isEnableStageActive(state) && record.manifest.dependencies.some(dependency => (
                !dependency.optional && dependency.id === moduleId
            ));
        })
        .map(record => record.manifest.id);

    const enableModule = (moduleId, enableOptions = {}, stack = [], withinBatch = false) => {
        assertLifecycleMutationAllowed('enableModule', {allowDuringCompletion: true});
        if (!withinBatch && stack.length === 0 && enableBatchDepth === 0) {
            return runEnableBatch(() => enableModule(moduleId, enableOptions, stack, true));
        }
        const record = getRecord(moduleId);
        if (!record) throw new Error(`Unknown module: ${moduleId}`);
        const manifest = record.manifest;
        if (manifest.availability === MODULE_AVAILABILITY.PLANNED) {
            throw new Error(`Module "${moduleId}" is planned but not available yet.`);
        }
        const state = getStateInternal(moduleId);
        if (isModuleOperational(state)) return true;
        if (isEnableCompletionPending(state)) {
            if (!pendingEnableCompletions.has(moduleId)) {
                pendingEnableCompletions.set(moduleId, {silent: Boolean(enableOptions.silent)});
            }
            return true;
        }
        if (state.enabled && state.enableCompletion !== MODULE_ENABLE_COMPLETION.COMPLETED) {
            setState(moduleId, {
                enableCompletion: MODULE_ENABLE_COMPLETION.PENDING,
                enabled: false,
                error: null,
                state: MODULE_STATES.ENABLING
            }, 'module:enable-pending');
            pendingEnableCompletions.set(moduleId, {silent: Boolean(enableOptions.silent)});
            return true;
        }
        if (stack.indexOf(moduleId) !== -1) {
            throw new Error(`Circular module dependency: ${stack.concat(moduleId).join(' -> ')}`);
        }
        const nextStack = stack.concat(moduleId);
        manifest.dependencies.forEach(dependency => {
            const dependencyRecord = getRecord(dependency.id);
            if (!dependencyRecord) {
                if (dependency.optional) return;
                throw new Error(`Module "${moduleId}" requires missing module "${dependency.id}".`);
            }
            enableModule(dependency.id, Object.assign({}, enableOptions, {dependency: true}), nextStack, true);
        });
        initializeModule(moduleId, true);
        setState(moduleId, {
            enableCompletion: MODULE_ENABLE_COMPLETION.PENDING,
            enabled: false,
            error: null,
            state: MODULE_STATES.ENABLING
        }, 'module:enable-pending');
        pendingEnableCompletions.set(moduleId, {silent: Boolean(enableOptions.silent)});
        try {
            callHook(moduleId, 'enable');
            return true;
        } catch (error) {
            rollbackEnableStage(moduleId, error);
            throw error;
        }
    };

    const disposeModuleCapabilities = (moduleId, authority = hostAuthority) => {
        // Per-capability disposer closures intentionally use the module's client authority
        // and may therefore be unavailable during rollback/completion. They are only a
        // convenience for normal shutdown; authoritative cleanup is the provider-wide
        // revocation below. Clear the tracking set first so a failed lifecycle cannot retain
        // stale disposer closures.
        moduleCapabilityDisposers.delete(moduleId);
        capabilities.revokeByProvider(moduleId, authority);
    };

    const disableModule = (moduleId, disableOptions = {}) => {
        assertLifecycleMutationAllowed('disableModule');
        const record = getRecord(moduleId);
        if (!record) throw new Error(`Unknown module: ${moduleId}`);
        const manifest = record.manifest;
        const state = getStateInternal(moduleId);
        if (!isEnableStageActive(state)) {
            pendingEnableCompletions.delete(moduleId);
            return true;
        }
        if (manifest.required && !disableOptions.force) {
            throw new Error(`Required module "${moduleId}" cannot be disabled.`);
        }
        const dependents = getEnabledDependents(moduleId);
        if (dependents.length && !disableOptions.cascade) {
            throw new Error(`Module "${moduleId}" is required by: ${dependents.join(', ')}`);
        }
        if (disableOptions.cascade) {
            dependents.forEach(dependentId => disableModule(dependentId, Object.assign({}, disableOptions, {force: true})));
        }
        pendingEnableCompletions.delete(moduleId);
        try {
            callHook(moduleId, 'disable');
        } finally {
            disposeModuleCapabilities(moduleId);
            setState(moduleId, {
                enableCompletion: MODULE_ENABLE_COMPLETION.IDLE,
                enabled: false,
                error: null,
                state: MODULE_STATES.DISABLED
            }, 'module:disable');
            if (!disableOptions.silent) markProjectChanged({moduleId, type: 'module-disable'});
        }
        return true;
    };

    const initializeAll = () => {
        assertLifecycleMutationAllowed('initializeAll');
        registry.list().forEach(record => initializeModule(record.manifest.id));
        return true;
    };

    const enableDefaults = (enableOptions = {}) => {
        assertLifecycleMutationAllowed('enableDefaults', {allowDuringCompletion: true});
        return runEnableBatch(() => {
            registry.list()
                .filter(record => record.manifest.defaultEnabled || record.manifest.required)
                .forEach(record => enableModule(record.manifest.id, enableOptions, [], true));
            return true;
        });
    };

    const getModuleState = moduleId => {
        const state = getStateInternal(moduleId);
        return state ? cloneSerializable(state) : null;
    };

    const listModules = () => registry.list().map(record => ({
        manifest: record.manifest,
        state: getModuleState(record.manifest.id)
    }));

    const serializeProject = () => {
        const moduleData = dataStore.serialize();
        const modules = cloneSerializable(unknownProjectModules);
        listModules().forEach(entry => {
            const serializedByHook = callHook(entry.manifest.id, 'serializeProject');
            if (typeof serializedByHook !== 'undefined') {
                moduleData[entry.manifest.id] = cloneSerializable(serializedByHook);
            }
            modules[entry.manifest.id] = {
                enabled: isModuleOperational(entry.state),
                version: entry.manifest.version
            };
        });
        return {
            frameworkVersion: MODULE_FRAMEWORK_VERSION,
            moduleData,
            modules
        };
    };

    const resetProject = (resetOptions = {}) => {
        assertLifecycleMutationAllowed('resetProject');
        return runEnableBatch(() => {
        const previousSuppression = suppressProjectChanges;
        suppressProjectChanges = true;
        try {
            unknownProjectModules = {};
            registry.list().slice().reverse().forEach(record => {
                const state = getStateInternal(record.manifest.id);
                if (state && isEnableStageActive(state) && !record.manifest.required) {
                    disableModule(record.manifest.id, {cascade: true, force: true, silent: true});
                }
            });
            dataStore.clear({silent: true}, hostAuthority);
            registry.list().forEach(record => {
                const state = getStateInternal(record.manifest.id);
                state.error = null;
                if (!isModuleOperational(state)) {
                    state.enableCompletion = MODULE_ENABLE_COMPLETION.IDLE;
                    state.enabled = false;
                    state.state = state.initialized ? MODULE_STATES.DISABLED : MODULE_STATES.REGISTERED;
                }
            });
            enableDefaults({silent: true});
        } finally {
            suppressProjectChanges = previousSuppression;
        }
        emit({type: 'project:reset'});
        if (!resetOptions.silent) markProjectChanged({type: 'module-project-reset'});
        return true;
        });
    };

    const deserializeProject = snapshot => {
        assertLifecycleMutationAllowed('deserializeProject');
        return runEnableBatch(() => {
        const previousSuppression = suppressProjectChanges;
        suppressProjectChanges = true;
        try {
            resetProject({silent: true});
            const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
            dataStore.deserialize(source.moduleData || {}, {silent: true}, hostAuthority);
            const moduleRecords = source.modules && typeof source.modules === 'object' ? source.modules : {};
            unknownProjectModules = {};
            Object.keys(moduleRecords).forEach(moduleId => {
                const projectRecord = moduleRecords[moduleId];
                if (!registry.has(moduleId)) {
                    unknownProjectModules[moduleId] = cloneSerializable(projectRecord);
                    return;
                }
                if (!projectRecord || !projectRecord.enabled) return;
                const record = registry.get(moduleId);
                if (record.manifest.availability === MODULE_AVAILABILITY.PLANNED) return;
                enableModule(moduleId, {silent: true}, [], true);
            });
            // Complete the Registration -> Restore phase before module-specific
            // deserializers observe Runtime capabilities or restored semantic state.
            completePendingEnableHooks();
            registry.list().forEach(record => {
                const moduleData = dataStore.get(record.manifest.id, {});
                callHook(record.manifest.id, 'deserializeProject', moduleData);
            });
        } finally {
            suppressProjectChanges = previousSuppression;
        }
        emit({type: 'project:deserialize'});
        return true;
        });
    };

    const getSB3CompatibilityReport = (reportOptions = {}) => {
        const enabledOnly = reportOptions.enabledOnly !== false;
        const entries = listModules().filter(entry => !enabledOnly || entry.state.enabled);
        let overall = SB3_COMPATIBILITY_LEVELS.FULL;
        entries.forEach(entry => {
            const level = entry.manifest.compatibility.sb3.level;
            if (SB3_COMPATIBILITY_PRIORITY[level] > SB3_COMPATIBILITY_PRIORITY[overall]) overall = level;
        });
        return {
            modules: entries.map(entry => ({
                description: entry.manifest.compatibility.sb3.description,
                enabled: entry.state.enabled,
                id: entry.manifest.id,
                level: entry.manifest.compatibility.sb3.level,
                name: entry.manifest.name,
                strategy: entry.manifest.compatibility.sb3.strategy
            })),
            overall
        };
    };

    const dispose = () => {
        assertLifecycleMutationAllowed('dispose');
        suppressProjectChanges = true;
        try {
            registry.list().slice().reverse().forEach(record => {
                const state = getStateInternal(record.manifest.id);
                if (state && isEnableStageActive(state)) {
                    disableModule(record.manifest.id, {cascade: true, force: true, silent: true});
                }
                try {
                    callHook(record.manifest.id, 'dispose');
                } catch {
                    // Framework disposal should continue even when one module fails.
                }
            });
        } finally {
            suppressProjectChanges = false;
        }
        moduleSubscriptionDisposers.forEach((disposers, moduleId) => disposeModuleSubscriptions(moduleId));
        moduleAuthorities.clear();
        listeners.clear();
        disposed = true;
    };

    const hostMutation = (operation, callback, mutationOptions = {}) => (...args) => {
        assertHostSurfaceAllowed(operation, mutationOptions);
        return callback(...args);
    };

    api = Object.freeze({
        version: MODULE_FRAMEWORK_VERSION,
        client: getModuleClientFacade(HOST_CLIENT_FACADE_ID),
        deserializeProject: hostMutation('deserializeProject', deserializeProject),
        disableModule: hostMutation('disableModule', disableModule),
        dispose: hostMutation('dispose', dispose),
        enableDefaults: hostMutation('enableDefaults', enableDefaults),
        enableModule: hostMutation('enableModule', enableModule, {
            allowDuringCompletion: true
        }),
        getCapability: capabilityId => capabilities.get(capabilityId),
        getCapabilityRecord: capabilityId => capabilities.getRecord(capabilityId),
        getInfrastructureObserverErrorSnapshot: surface => {
            if (surface === 'capability') return capabilities.getObserverErrorSnapshot();
            if (surface === 'registry') return registry.getObserverErrorSnapshot();
            if (surface === 'data-store') return dataStore.getObserverErrorSnapshot();
            return null;
        },
        getModuleData: (moduleId, fallback) => dataStore.get(moduleId, fallback),
        getModuleRecord: moduleId => registry.get(moduleId),
        getObserverErrorSnapshot: () => observerErrors.getSnapshot(),
        getModuleState,
        getSB3CompatibilityReport,
        hasModule: moduleId => registry.has(moduleId),
        initializeAll: hostMutation('initializeAll', initializeAll),
        initializeModule: hostMutation('initializeModule', initializeModule),
        listCapabilities: () => capabilities.list(),
        listModules,
        provideCapability: hostMutation(
            'provideCapability',
            (providerModuleId, capabilityId, value, capabilityOptions) => capabilities.provide(
                providerModuleId,
                capabilityId,
                value,
                capabilityOptions,
                hostAuthority
            )
        ),
        registerModule: hostMutation('registerModule', registerModule),
        resetProject: hostMutation('resetProject', resetProject),
        revokeCapabilitiesByProvider: hostMutation(
            'revokeCapabilitiesByProvider',
            providerModuleId => capabilities.revokeByProvider(providerModuleId, hostAuthority)
        ),
        serializeProject: hostMutation('serializeProject', serializeProject),
        setModuleData: hostMutation(
            'setModuleData',
            (moduleId, value, setOptions) => dataStore.set(moduleId, value, setOptions, hostAuthority)
        ),
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        subscribeCapabilities: listener => capabilities.subscribe(listener),
        subscribeModuleData: listener => dataStore.subscribe(listener),
        subscribeRegistry: listener => registry.subscribe(listener),
        unregisterModule: hostMutation('unregisterModule', unregisterModule),
        updateModuleData: hostMutation(
            'updateModuleData',
            (moduleId, updater, updateOptions) => dataStore.update(moduleId, updater, updateOptions, hostAuthority)
        )
    });
    hostManagerInstances.add(api);

    return api;
};

module.exports = {
    createModuleManager
};
