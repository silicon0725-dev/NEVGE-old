const SERVICE_FACADE_KIND = 'ngvge.module-service-facade';

const {
    createRuntimeBoundaryError,
    isRuntimeBoundaryError
} = require('../runtime-errors/runtime-error-contract');

const isObjectLike = value => Boolean(value && (typeof value === 'object' || typeof value === 'function'));

const createSanitizedBoundaryError = ({code, direction, operation, serviceId, thrown}) =>
    createRuntimeBoundaryError({
        code,
        direction,
        message: `Module boundary operation "${operation}" for "${serviceId}" failed across ${direction}.`,
        operation,
        serviceId,
        thrown
    });

const createServiceFacadeFactory = options => {
    const assertActive = typeof options.assertActive === 'function' ? options.assertActive : () => {};
    const serviceId = options.serviceId;
    const boundaryKind = options.boundaryKind === 'capability' ? 'capability' : 'service';
    const resolveValue = typeof options.resolveValue === 'function' ? options.resolveValue : () => null;
    const hostFailureCode = boundaryKind === 'capability' ?
        'MODULE_CAPABILITY_PROVIDER_OPERATION_FAILED' : 'MODULE_SERVICE_HOST_OPERATION_FAILED';
    const callbackFailureCode = boundaryKind === 'capability' ?
        'MODULE_CAPABILITY_CALLBACK_FAILED' : 'MODULE_SERVICE_CALLBACK_FAILED';
    const rawToFacade = new WeakMap();
    const facadeToRaw = new WeakMap();
    const methodCache = new WeakMap();
    const callbackCache = new WeakMap();
    const moduleArgumentCache = new WeakMap();
    const promiseLikeRaw = new WeakSet();
    const promiseRejectionCallbackCache = new WeakMap();
    const localArrayMethodCache = new WeakMap();
    const localArrayCallbackMethods = new Set([
        'every',
        'filter',
        'find',
        'findIndex',
        'forEach',
        'map',
        'reduce',
        'reduceRight',
        'some'
    ]);
    // Subscription teardown functions are consumer-owned cleanup leases, not retained
    // capability methods. They must remain callable after provider revocation so UI/framework
    // cleanup (for example React passive-effect destroy) can release observers without
    // reopening the provider's business authority.
    const teardownMethodNames = new Set(['subscribe']);
    if (typeof Array.prototype.findLast === 'function') localArrayCallbackMethods.add('findLast');
    if (typeof Array.prototype.findLastIndex === 'function') localArrayCallbackMethods.add('findLastIndex');

    const assertServiceActive = operation => assertActive(`service:${serviceId}:${operation}`);

    const isPromiseLikeValue = value => {
        if (!isObjectLike(value)) return false;
        try {
            if (value instanceof Promise) return true;
        } catch {
            // Continue with descriptor-only detection for cross-realm values.
        }
        let current = value;
        const visited = new Set();
        for (let depth = 0; current && depth < 16; depth++) {
            if (visited.has(current)) return false;
            visited.add(current);
            let descriptor;
            try {
                descriptor = Reflect.getOwnPropertyDescriptor(current, 'then');
            } catch {
                return false;
            }
            if (descriptor) {
                return Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
                    typeof descriptor.value === 'function';
            }
            try {
                current = Reflect.getPrototypeOf(current);
            } catch {
                return false;
            }
        }
        return false;
    };

    const sanitizeHostThrown = (thrown, operation) => {
        if (isRuntimeBoundaryError(thrown)) return thrown;
        return createSanitizedBoundaryError({
            code: hostFailureCode,
            direction: 'host-to-module',
            operation,
            serviceId,
            thrown
        });
    };

    const sanitizeCallbackThrown = (thrown, operation) => {
        if (isRuntimeBoundaryError(thrown)) return thrown;
        return createSanitizedBoundaryError({
            code: callbackFailureCode,
            direction: 'module-to-host',
            operation,
            serviceId,
            thrown
        });
    };

    const invokeHostOperation = (operation, callback) => {
        try {
            return callback();
        } catch (thrown) {
            throw sanitizeHostThrown(thrown, operation);
        }
    };

    const createStructureError = operation => {
        assertServiceActive(operation);
        return createRuntimeBoundaryError({
            code: 'MODULE_SERVICE_FACADE_STRUCTURE_FORBIDDEN',
            direction: 'module-local',
            message: `Module service facade structure mutation "${operation}" is forbidden.`,
            operation,
            portableDetails: {thrownType: 'none'},
            serviceId
        });
    };

    const isPlainRecord = value => {
        if (!value || typeof value !== 'object') return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    };

    const convertCallbackResult = (result, operation) => {
        if (isPromiseLikeValue(result)) {
            return Promise.resolve(result).then(
                resolved => {
                    assertServiceActive(`${operation}:resolve`);
                    try {
                        return toServiceArgument(resolved);
                    } catch (thrown) {
                        throw sanitizeCallbackThrown(thrown, `${operation}:resolve`);
                    }
                },
                thrown => {
                    assertServiceActive(`${operation}:reject`);
                    throw sanitizeCallbackThrown(thrown, `${operation}:async`);
                }
            );
        }
        try {
            return toServiceArgument(result);
        } catch (thrown) {
            throw sanitizeCallbackThrown(thrown, `${operation}:return`);
        }
    };

    const createCallbackWrapper = (callback, operation, transformArguments = args => args.map(wrap)) => {
        const wrapped = function (...args) {
            assertServiceActive(operation);
            let result;
            try {
                const thisValue = wrap(this);
                result = Reflect.apply(callback, thisValue, transformArguments(args));
            } catch (thrown) {
                throw sanitizeCallbackThrown(thrown, operation);
            }
            return convertCallbackResult(result, operation);
        };
        return Object.freeze(wrapped);
    };

    const wrapCallback = callback => {
        if (callbackCache.has(callback)) return callbackCache.get(callback);
        const wrapped = createCallbackWrapper(callback, 'callback');
        callbackCache.set(callback, wrapped);
        return wrapped;
    };

    const wrapPromiseRejectionCallback = (callback, operation) => {
        if (typeof callback !== 'function') return toServiceArgument(callback);
        if (!promiseRejectionCallbackCache.has(callback)) {
            promiseRejectionCallbackCache.set(callback, new Map());
        }
        const wrappers = promiseRejectionCallbackCache.get(callback);
        if (wrappers.has(operation)) return wrappers.get(operation);
        const wrapped = createCallbackWrapper(callback, operation, args => {
            if (!args.length) return [];
            return [sanitizeHostThrown(args[0], operation)].concat(args.slice(1).map(wrap));
        });
        wrappers.set(operation, wrapped);
        return wrapped;
    };

    const toHostMethodArguments = (receiver, key, args) => {
        if (!promiseLikeRaw.has(receiver)) return args.map(toServiceArgument);
        if (key === 'then') {
            return args.map((value, index) => index === 1 ?
                wrapPromiseRejectionCallback(value, 'promise:reject') : toServiceArgument(value));
        }
        if (key === 'catch') {
            return args.map((value, index) => index === 0 ?
                wrapPromiseRejectionCallback(value, 'promise:reject') : toServiceArgument(value));
        }
        return args.map(toServiceArgument);
    };

    const toServiceArgument = value => {
        if (isRuntimeBoundaryError(value)) return value;
        if (facadeToRaw.has(value)) return facadeToRaw.get(value);
        if (typeof value === 'function') return wrapCallback(value);
        if (!value || typeof value !== 'object') return value;
        if (!Array.isArray(value) && !isPlainRecord(value)) {
            const error = new TypeError(
                `Module service "${serviceId}" only accepts portable plain-data objects, arrays, callbacks, or values returned by the same service facade.`
            );
            error.code = 'MODULE_SERVICE_ARGUMENT_UNSUPPORTED';
            error.serviceId = serviceId;
            throw error;
        }
        if (moduleArgumentCache.has(value)) return moduleArgumentCache.get(value);
        const clone = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
        moduleArgumentCache.set(value, clone);
        Reflect.ownKeys(value).forEach(key => {
            if (Array.isArray(value) && key === 'length') return;
            const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
            if (!descriptor) return;
            const nextDescriptor = {
                configurable: true,
                enumerable: Boolean(descriptor.enumerable)
            };
            if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                nextDescriptor.value = toServiceArgument(descriptor.value);
                nextDescriptor.writable = true;
            } else {
                if (typeof descriptor.get === 'function') nextDescriptor.get = wrapCallback(descriptor.get);
                if (typeof descriptor.set === 'function') nextDescriptor.set = wrapCallback(descriptor.set);
            }
            Reflect.defineProperty(clone, key, nextDescriptor);
        });
        return clone;
    };

    const toServiceDescriptor = descriptor => {
        const next = Object.assign({}, descriptor);
        if (Object.prototype.hasOwnProperty.call(next, 'value')) next.value = toServiceArgument(next.value);
        if (typeof next.get === 'function') next.get = wrapCallback(next.get);
        if (typeof next.set === 'function') next.set = wrapCallback(next.set);
        return next;
    };

    const isLocalArrayCallbackMethod = (receiver, key, method) => (
        Array.isArray(receiver) &&
        typeof key === 'string' &&
        localArrayCallbackMethods.has(key) &&
        Array.prototype[key] === method
    );

    const getLocalArrayCallbackMethod = (receiver, facade, key, method) => {
        if (!localArrayMethodCache.has(receiver)) localArrayMethodCache.set(receiver, new Map());
        const methods = localArrayMethodCache.get(receiver);
        const current = methods.get(key);
        if (current && current.raw === method) return current.facade;
        const localMethod = function (...args) {
            assertServiceActive(`array-local:${String(key)}`);
            return Reflect.apply(method, facade, args);
        };
        Object.freeze(localMethod);
        methods.set(key, {facade: localMethod, raw: method});
        return localMethod;
    };

    const createTeardownLease = (rawDisposer, operation) => {
        let released = false;
        const teardown = function () {
            if (released) return false;
            released = true;
            const result = invokeHostOperation(operation, () => Reflect.apply(rawDisposer, undefined, []));
            // A teardown lease may report primitive completion state, but it must never become
            // a post-revocation transport for another host object.
            return isObjectLike(result) ? undefined : result;
        };
        return Object.freeze(teardown);
    };

    const getMethod = (receiver, key, method) => {
        if (!methodCache.has(receiver)) methodCache.set(receiver, new Map());
        const methods = methodCache.get(receiver);
        const current = methods.get(key);
        if (current && current.raw === method) return current.facade;
        const facade = function (...args) {
            assertServiceActive(`call:${String(key)}`);
            const serviceArgs = toHostMethodArguments(receiver, key, args);
            const result = invokeHostOperation(
                `call:${String(key)}`,
                () => Reflect.apply(method, receiver, serviceArgs)
            );
            if (teardownMethodNames.has(key) && typeof result === 'function') {
                return createTeardownLease(result, `teardown:${String(key)}`);
            }
            return wrap(result);
        };
        Object.freeze(facade);
        methods.set(key, {facade, raw: method});
        return facade;
    };

    const createObjectFacade = raw => {
        const facadeTarget = Object.create(null);
        const facade = new Proxy(facadeTarget, {
            defineProperty: (target, key, descriptor) => {
                assertServiceActive(`defineProperty:${String(key)}`);
                const serviceDescriptor = toServiceDescriptor(descriptor);
                return invokeHostOperation(
                    `defineProperty:${String(key)}`,
                    () => Reflect.defineProperty(raw, key, serviceDescriptor)
                );
            },
            deleteProperty: (target, key) => {
                assertServiceActive(`delete:${String(key)}`);
                return invokeHostOperation(`delete:${String(key)}`, () => Reflect.deleteProperty(raw, key));
            },
            get: (target, key) => {
                assertServiceActive(`get:${String(key)}`);
                if (key === Symbol.toStringTag) return 'ModuleServiceFacade';
                if (key === Symbol.for(SERVICE_FACADE_KIND)) return true;
                const value = invokeHostOperation(
                    `get:${String(key)}`,
                    () => Reflect.get(raw, key, raw)
                );
                if (typeof value === 'function') {
                    if (isLocalArrayCallbackMethod(raw, key, value)) {
                        return getLocalArrayCallbackMethod(raw, facade, key, value);
                    }
                    if (key === 'then') promiseLikeRaw.add(raw);
                    return getMethod(raw, key, value);
                }
                return wrap(value);
            },
            getOwnPropertyDescriptor: (target, key) => {
                assertServiceActive(`descriptor:${String(key)}`);
                const descriptor = invokeHostOperation(
                    `descriptor:${String(key)}`,
                    () => Reflect.getOwnPropertyDescriptor(raw, key)
                );
                if (!descriptor) return undefined;
                const facadeDescriptor = {
                    configurable: true,
                    enumerable: Boolean(descriptor.enumerable)
                };
                if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                    facadeDescriptor.value = typeof descriptor.value === 'function' ?
                        getMethod(raw, key, descriptor.value) : wrap(descriptor.value);
                    facadeDescriptor.writable = Boolean(descriptor.writable);
                } else {
                    if (typeof descriptor.get === 'function') {
                        facadeDescriptor.get = getMethod(raw, `get:${String(key)}`, descriptor.get);
                    }
                    if (typeof descriptor.set === 'function') {
                        facadeDescriptor.set = getMethod(raw, `set:${String(key)}`, descriptor.set);
                    }
                }
                return facadeDescriptor;
            },
            getPrototypeOf: () => {
                assertServiceActive('getPrototypeOf');
                invokeHostOperation('getPrototypeOf', () => Reflect.getPrototypeOf(raw));
                return null;
            },
            has: (target, key) => {
                assertServiceActive(`has:${String(key)}`);
                return invokeHostOperation(`has:${String(key)}`, () => Reflect.has(raw, key));
            },
            isExtensible: () => {
                assertServiceActive('isExtensible');
                invokeHostOperation('isExtensible', () => Reflect.isExtensible(raw));
                return true;
            },
            ownKeys: () => {
                assertServiceActive('ownKeys');
                return invokeHostOperation('ownKeys', () => Reflect.ownKeys(raw));
            },
            preventExtensions: () => {
                throw createStructureError('preventExtensions');
            },
            set: (target, key, value) => {
                assertServiceActive(`set:${String(key)}`);
                const serviceValue = toServiceArgument(value);
                return invokeHostOperation(
                    `set:${String(key)}`,
                    () => Reflect.set(raw, key, serviceValue, raw)
                );
            },
            setPrototypeOf: () => {
                throw createStructureError('setPrototypeOf');
            }
        });
        rawToFacade.set(raw, facade);
        facadeToRaw.set(facade, raw);
        return facade;
    };

    const createFunctionFacade = raw => {
        const facadeTarget = function () {};
        const protectedKeys = new Set(Reflect.ownKeys(facadeTarget).filter(key => {
            const descriptor = Reflect.getOwnPropertyDescriptor(facadeTarget, key);
            return descriptor && descriptor.configurable === false;
        }));
        const facade = new Proxy(facadeTarget, {
            apply: (target, thisValue, args) => {
                assertServiceActive('call');
                const serviceArgs = args.map(toServiceArgument);
                return wrap(invokeHostOperation('call', () => Reflect.apply(raw, undefined, serviceArgs)));
            },
            construct: (target, args) => {
                assertServiceActive('construct');
                const serviceArgs = args.map(toServiceArgument);
                return wrap(invokeHostOperation('construct', () => Reflect.construct(raw, serviceArgs)));
            },
            defineProperty: (target, key, descriptor) => {
                assertServiceActive(`defineProperty:${String(key)}`);
                if (protectedKeys.has(key)) throw createStructureError(`defineProperty:${String(key)}`);
                const serviceDescriptor = toServiceDescriptor(descriptor);
                return invokeHostOperation(
                    `defineProperty:${String(key)}`,
                    () => Reflect.defineProperty(raw, key, serviceDescriptor)
                );
            },
            deleteProperty: (target, key) => {
                assertServiceActive(`delete:${String(key)}`);
                if (protectedKeys.has(key)) return false;
                return invokeHostOperation(`delete:${String(key)}`, () => Reflect.deleteProperty(raw, key));
            },
            get: (target, key) => {
                assertServiceActive(`get:${String(key)}`);
                if (protectedKeys.has(key)) return Reflect.get(facadeTarget, key, facadeTarget);
                if (key === Symbol.toStringTag) return 'ModuleServiceFunctionFacade';
                if (key === Symbol.for(SERVICE_FACADE_KIND)) return true;
                const value = invokeHostOperation(
                    `get:${String(key)}`,
                    () => Reflect.get(raw, key, raw)
                );
                if (typeof value === 'function') {
                    if (key === 'then') promiseLikeRaw.add(raw);
                    return getMethod(raw, key, value);
                }
                return wrap(value);
            },
            getOwnPropertyDescriptor: (target, key) => {
                assertServiceActive(`descriptor:${String(key)}`);
                if (protectedKeys.has(key)) return Reflect.getOwnPropertyDescriptor(facadeTarget, key);
                const descriptor = invokeHostOperation(
                    `descriptor:${String(key)}`,
                    () => Reflect.getOwnPropertyDescriptor(raw, key)
                );
                if (!descriptor) return undefined;
                const facadeDescriptor = {
                    configurable: true,
                    enumerable: Boolean(descriptor.enumerable)
                };
                if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                    facadeDescriptor.value = typeof descriptor.value === 'function' ?
                        getMethod(raw, key, descriptor.value) : wrap(descriptor.value);
                    facadeDescriptor.writable = Boolean(descriptor.writable);
                } else {
                    if (typeof descriptor.get === 'function') {
                        facadeDescriptor.get = getMethod(raw, `get:${String(key)}`, descriptor.get);
                    }
                    if (typeof descriptor.set === 'function') {
                        facadeDescriptor.set = getMethod(raw, `set:${String(key)}`, descriptor.set);
                    }
                }
                return facadeDescriptor;
            },
            getPrototypeOf: () => {
                assertServiceActive('getPrototypeOf');
                invokeHostOperation('getPrototypeOf', () => Reflect.getPrototypeOf(raw));
                return Function.prototype;
            },
            has: (target, key) => {
                assertServiceActive(`has:${String(key)}`);
                if (protectedKeys.has(key)) return true;
                return invokeHostOperation(`has:${String(key)}`, () => Reflect.has(raw, key));
            },
            isExtensible: () => {
                assertServiceActive('isExtensible');
                invokeHostOperation('isExtensible', () => Reflect.isExtensible(raw));
                return true;
            },
            ownKeys: () => {
                assertServiceActive('ownKeys');
                const rawKeys = invokeHostOperation('ownKeys', () => Reflect.ownKeys(raw));
                return Array.from(new Set(Reflect.ownKeys(facadeTarget).concat(rawKeys)));
            },
            preventExtensions: () => {
                throw createStructureError('preventExtensions');
            },
            set: (target, key, value) => {
                assertServiceActive(`set:${String(key)}`);
                if (protectedKeys.has(key)) return false;
                const serviceValue = toServiceArgument(value);
                return invokeHostOperation(
                    `set:${String(key)}`,
                    () => Reflect.set(raw, key, serviceValue, raw)
                );
            },
            setPrototypeOf: () => {
                throw createStructureError('setPrototypeOf');
            }
        });
        rawToFacade.set(raw, facade);
        facadeToRaw.set(facade, raw);
        return facade;
    };

    function wrap (value) {
        if (isRuntimeBoundaryError(value)) return value;
        const resolved = resolveValue(value);
        if (resolved && resolved.handled) return resolved.value;
        if (!isObjectLike(value)) return value;
        if (facadeToRaw.has(value)) return value;
        if (rawToFacade.has(value)) return rawToFacade.get(value);
        if (isPromiseLikeValue(value)) promiseLikeRaw.add(value);
        return typeof value === 'function' ? createFunctionFacade(value) : createObjectFacade(value);
    }

    return Object.freeze({
        wrap
    });
};

module.exports = {
    SERVICE_FACADE_KIND,
    createServiceFacadeFactory
};
