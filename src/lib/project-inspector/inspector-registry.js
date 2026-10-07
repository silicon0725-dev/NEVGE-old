const REGISTRY_PROPERTY = 'ngvgeInspector';

const validateSection = section => {
    if (!section || typeof section !== 'object') {
        throw new TypeError('Inspector section must be an object');
    }
    if (typeof section.id !== 'string' || !section.id.length) {
        throw new TypeError('Inspector section must have a non-empty string id');
    }
    if (typeof section.label !== 'string' || !section.label.length) {
        throw new TypeError(`Inspector section "${section.id}" must have a label`);
    }
    if (typeof section.getFields !== 'function') {
        throw new TypeError(`Inspector section "${section.id}" must implement getFields`);
    }
    if (typeof section.setValue !== 'function') {
        throw new TypeError(`Inspector section "${section.id}" must implement setValue`);
    }
};

const createInspectorRegistry = () => {
    const sections = new Map();
    const listeners = new Set();

    const emit = change => {
        listeners.forEach(listener => listener(change));
    };

    return {
        version: 1,
        register (section) {
            validateSection(section);
            sections.set(section.id, section);
            emit({type: 'registry', sectionId: section.id});
            return () => {
                if (sections.get(section.id) === section) {
                    sections.delete(section.id);
                    emit({type: 'registry', sectionId: section.id});
                }
            };
        },
        unregister (sectionId) {
            const removed = sections.delete(sectionId);
            if (removed) emit({type: 'registry', sectionId});
            return removed;
        },
        getSection (sectionId) {
            return sections.get(sectionId) || null;
        },
        getSections (target, context) {
            return Array.from(sections.values())
                .filter(section => (
                    typeof section.appliesTo !== 'function' || section.appliesTo(target, context)
                ))
                .sort((sectionA, sectionB) => {
                    const orderA = Number.isFinite(sectionA.order) ? sectionA.order : 0;
                    const orderB = Number.isFinite(sectionB.order) ? sectionB.order : 0;
                    if (orderA !== orderB) return orderA - orderB;
                    return sectionA.id.localeCompare(sectionB.id);
                });
        },
        listSections () {
            return Array.from(sections.values());
        },
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        notify (change) {
            emit(Object.assign({type: 'value'}, change));
        }
    };
};

const getInspectorRegistry = runtime => {
    if (!runtime) return null;

    const currentRegistry = runtime[REGISTRY_PROPERTY];
    if (
        currentRegistry &&
        currentRegistry.version === 1 &&
        typeof currentRegistry.register === 'function' &&
        typeof currentRegistry.getSections === 'function'
    ) {
        return currentRegistry;
    }

    const registry = createInspectorRegistry();
    runtime[REGISTRY_PROPERTY] = registry;
    return registry;
};

export {
    REGISTRY_PROPERTY,
    createInspectorRegistry,
    getInspectorRegistry,
    validateSection
};
