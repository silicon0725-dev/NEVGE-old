const {clonePortableData} = require('./portable-data');

const isObjectLike = value => Boolean(value) && typeof value === 'object';

const formatPathPart = property => {
    if (typeof property === 'symbol') return `[${String(property)}]`;
    const key = String(property);
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
};

const cloneAssignedPortableValue = value => clonePortableData(value, {allowTopLevelUndefined: true});

const createGuardedSemanticValue = (value, options = {}) => {
    const assertMutation = typeof options.assertMutation === 'function' ? options.assertMutation : () => true;
    const normalizeAssigned = typeof options.normalizeAssigned === 'function' ?
        options.normalizeAssigned : cloneAssignedPortableValue;
    const didMutate = typeof options.didMutate === 'function' ? options.didMutate : () => {};
    const operationPrefix = typeof options.operationPrefix === 'string' && options.operationPrefix ?
        options.operationPrefix : 'semantic-value';
    const rootPath = typeof options.rootPath === 'string' && options.rootPath ? options.rootPath : '$';
    const proxyCache = new WeakMap();

    const wrap = (target, path) => {
        if (!isObjectLike(target)) return target;
        if (proxyCache.has(target)) return proxyCache.get(target);
        const proxy = new Proxy(target, {
            defineProperty (current, property, descriptor) {
                assertMutation(`${operationPrefix}.defineProperty`, `${path}${formatPathPart(property)}`);
                if (!descriptor || Object.prototype.hasOwnProperty.call(descriptor, 'get') ||
                    Object.prototype.hasOwnProperty.call(descriptor, 'set')) {
                    throw new TypeError('Runtime semantic portable values do not support accessor properties.');
                }
                const nextDescriptor = Object.assign({}, descriptor);
                if (Object.prototype.hasOwnProperty.call(nextDescriptor, 'value')) {
                    nextDescriptor.value = normalizeAssigned(
                        nextDescriptor.value,
                        `${path}${formatPathPart(property)}`,
                        property
                    );
                    if (nextDescriptor.configurable === false && isObjectLike(nextDescriptor.value)) {
                        throw new TypeError(
                            'Runtime semantic portable values cannot expose non-configurable object properties.'
                        );
                    }
                }
                const changed = Reflect.defineProperty(current, property, nextDescriptor);
                if (changed) didMutate(`${operationPrefix}.defineProperty`, `${path}${formatPathPart(property)}`);
                return changed;
            },
            deleteProperty (current, property) {
                assertMutation(`${operationPrefix}.delete`, `${path}${formatPathPart(property)}`);
                const changed = Reflect.deleteProperty(current, property);
                if (changed) didMutate(`${operationPrefix}.delete`, `${path}${formatPathPart(property)}`);
                return changed;
            },
            get (current, property, receiver) {
                return wrap(Reflect.get(current, property, receiver), `${path}${formatPathPart(property)}`);
            },
            getOwnPropertyDescriptor (current, property) {
                const descriptor = Reflect.getOwnPropertyDescriptor(current, property);
                if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return descriptor;
                return Object.assign({}, descriptor, {
                    value: wrap(descriptor.value, `${path}${formatPathPart(property)}`)
                });
            },
            preventExtensions () {
                assertMutation(`${operationPrefix}.preventExtensions`, path);
                throw new TypeError('Runtime semantic portable values cannot be made non-extensible directly.');
            },
            set (current, property, nextValue) {
                const propertyPath = `${path}${formatPathPart(property)}`;
                assertMutation(`${operationPrefix}.set`, propertyPath);
                const normalized = normalizeAssigned(nextValue, propertyPath, property);
                const changed = Reflect.set(current, property, normalized, current);
                if (changed) didMutate(`${operationPrefix}.set`, propertyPath);
                return changed;
            },
            setPrototypeOf () {
                assertMutation(`${operationPrefix}.setPrototypeOf`, path);
                throw new TypeError('Runtime semantic portable values cannot change prototype.');
            }
        });
        proxyCache.set(target, proxy);
        return proxy;
    };

    return wrap(value, rootPath);
};

module.exports = {
    cloneAssignedPortableValue,
    createGuardedSemanticValue
};
