const REGISTRY_PROPERTY = 'ngvgeNodeTypeRegistry';
const REGISTRY_VERSION = 1;

const cloneValue = value => JSON.parse(JSON.stringify(value));

const validateNodeType = nodeType => {
    if (!nodeType || typeof nodeType !== 'object') {
        throw new TypeError('Node type must be an object');
    }
    if (typeof nodeType.id !== 'string' || !nodeType.id.length) {
        throw new TypeError('Node type must have a non-empty string id');
    }
    if (typeof nodeType.label !== 'string' || !nodeType.label.length) {
        throw new TypeError(`Node type "${nodeType.id}" must have a label`);
    }
    if (nodeType.defaults && typeof nodeType.defaults !== 'object') {
        throw new TypeError(`Node type "${nodeType.id}" defaults must be an object`);
    }
    if (nodeType.fields && !Array.isArray(nodeType.fields)) {
        throw new TypeError(`Node type "${nodeType.id}" fields must be an array`);
    }
};

const normalizeNodeType = nodeType => Object.assign({
    allowChildren: true,
    category: 'Other',
    defaults: {},
    fields: [],
    hidden: false,
    icon: '◇',
    family: '2d',
    order: 0,
    pluginId: null
}, nodeType, {
    defaults: cloneValue(nodeType.defaults || {}),
    fields: cloneValue(nodeType.fields || [])
});

const createNodeTypeRegistry = () => {
    const nodeTypes = new Map();
    const listeners = new Set();

    const emit = change => {
        listeners.forEach(listener => listener(change));
    };

    return {
        version: REGISTRY_VERSION,
        register (nodeType) {
            validateNodeType(nodeType);
            const normalized = normalizeNodeType(nodeType);
            nodeTypes.set(normalized.id, normalized);
            emit({nodeTypeId: normalized.id, type: 'register'});
            return () => {
                if (nodeTypes.get(normalized.id) === normalized) {
                    nodeTypes.delete(normalized.id);
                    emit({nodeTypeId: normalized.id, type: 'unregister'});
                }
            };
        },
        unregister (nodeTypeId) {
            const removed = nodeTypes.delete(nodeTypeId);
            if (removed) emit({nodeTypeId, type: 'unregister'});
            return removed;
        },
        getType (nodeTypeId) {
            const nodeType = nodeTypes.get(nodeTypeId);
            return nodeType ? normalizeNodeType(nodeType) : null;
        },
        listTypes (options = {}) {
            const includeHidden = Boolean(options.includeHidden);
            const includeDeprecatedCompatibility = Boolean(options.includeDeprecatedCompatibility);
            return Array.from(nodeTypes.values())
                .filter(nodeType => includeHidden || !nodeType.hidden)
                .filter(nodeType => includeDeprecatedCompatibility || !nodeType.creationHidden)
                .sort((typeA, typeB) => {
                    const categoryComparison = typeA.category.localeCompare(typeB.category);
                    if (categoryComparison !== 0) return categoryComparison;
                    if (typeA.order !== typeB.order) return typeA.order - typeB.order;
                    return typeA.label.localeCompare(typeB.label);
                })
                .map(normalizeNodeType);
        },
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};

const registerBuiltinNodeTypes = registry => {
    const builtins = [
        {
            allowChildren: true,
            category: 'Core',
            defaults: {
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                x: 0,
                y: 0
            },
            fields: [
                {id: 'x', label: 'X', step: 1, type: 'number'},
                {id: 'y', label: 'Y', step: 1, type: 'number'},
                {id: 'rotation', label: 'Rotation', step: 1, type: 'number'},
                {id: 'scaleX', label: 'Scale X', step: 0.01, type: 'number'},
                {id: 'scaleY', label: 'Scale Y', step: 0.01, type: 'number'}
            ],
            family: '2d',
            icon: '◇',
            id: 'ngvge.node2d',
            label: 'Node2D',
            order: 10
        },
        {
            allowChildren: true,
            category: 'Physics',
            creationHidden: true,
            deprecated: true,
            legacyCompatibilityOnly: true,
            defaults: {
                bodyType: 'dynamic',
                fixedRotation: false,
                gravityScale: 1,
                linearDamping: 0,
                mass: 1
            },
            fields: [
                {
                    id: 'bodyType',
                    label: 'Body Type',
                    options: [
                        {label: 'Static', value: 'static'},
                        {label: 'Kinematic', value: 'kinematic'},
                        {label: 'Dynamic', value: 'dynamic'}
                    ],
                    type: 'select'
                },
                {id: 'mass', label: 'Mass', min: 0.001, step: 0.1, type: 'number'},
                {id: 'gravityScale', label: 'Gravity Scale', step: 0.1, type: 'number'},
                {id: 'linearDamping', label: 'Linear Damping', min: 0, step: 0.1, type: 'number'},
                {id: 'fixedRotation', label: 'Fixed Rotation', type: 'boolean'}
            ],
            family: '2d',
            icon: '◉',
            id: 'ngvge.physics-body2d',
            label: 'Legacy PhysicsBody2D',
            order: 20
        },
        {
            allowChildren: false,
            category: 'Physics',
            creationHidden: true,
            deprecated: true,
            legacyCompatibilityOnly: true,
            defaults: {
                collisionLayer: 1,
                collisionMask: 1,
                height: 48,
                isTrigger: false,
                offsetX: 0,
                offsetY: 0,
                radius: 24,
                shape: 'rectangle',
                width: 48
            },
            fields: [
                {
                    id: 'shape',
                    label: 'Shape',
                    options: [
                        {label: 'Rectangle', value: 'rectangle'},
                        {label: 'Circle', value: 'circle'},
                        {label: 'Polygon', value: 'polygon'}
                    ],
                    type: 'select'
                },
                {id: 'offsetX', label: 'Offset X', step: 1, type: 'number'},
                {id: 'offsetY', label: 'Offset Y', step: 1, type: 'number'},
                {id: 'width', label: 'Width', min: 0, step: 1, type: 'number'},
                {id: 'height', label: 'Height', min: 0, step: 1, type: 'number'},
                {id: 'radius', label: 'Radius', min: 0, step: 1, type: 'number'},
                {id: 'isTrigger', label: 'Trigger', type: 'boolean'},
                {id: 'collisionLayer', label: 'Collision Layer', min: 1, step: 1, type: 'number'},
                {id: 'collisionMask', label: 'Collision Mask', min: 1, step: 1, type: 'number'}
            ],
            family: '2d',
            icon: '⬚',
            id: 'ngvge.collider2d',
            label: 'Legacy Collider2D',
            order: 30
        },
        {
            allowChildren: false,
            category: 'Utility',
            defaults: {
                rotation: 0,
                x: 0,
                y: 0
            },
            fields: [
                {id: 'x', label: 'X', step: 1, type: 'number'},
                {id: 'y', label: 'Y', step: 1, type: 'number'},
                {id: 'rotation', label: 'Rotation', step: 1, type: 'number'}
            ],
            family: '2d',
            icon: '✚',
            id: 'ngvge.marker2d',
            label: 'Marker2D',
            order: 40
        },
        {
            allowChildren: true,
            category: 'User Interface',
            defaults: {
                anchorX: 0,
                anchorY: 0,
                height: 100,
                visible: true,
                width: 200,
                x: 0,
                y: 0
            },
            family: 'ui',
            fields: [
                {id: 'x', label: 'X', step: 1, type: 'number'},
                {id: 'y', label: 'Y', step: 1, type: 'number'},
                {id: 'width', label: 'Width', min: 0, step: 1, type: 'number'},
                {id: 'height', label: 'Height', min: 0, step: 1, type: 'number'},
                {id: 'anchorX', label: 'Anchor X', min: 0, max: 1, step: 0.01, type: 'number'},
                {id: 'anchorY', label: 'Anchor Y', min: 0, max: 1, step: 0.01, type: 'number'},
                {id: 'visible', label: 'Visible', type: 'boolean'}
            ],
            icon: '▤',
            id: 'ngvge.control',
            label: 'Control',
            order: 10
        },
        {
            allowChildren: true,
            category: 'Internal',
            defaults: {},
            fields: [],
            hidden: true,
            icon: '▣',
            id: 'ngvge.stage-target',
            label: 'Stage',
            order: -100
        },
        {
            allowChildren: true,
            category: 'Internal',
            defaults: {},
            fields: [],
            hidden: true,
            icon: '●',
            id: 'ngvge.sprite-target',
            label: 'Sprite',
            order: -90
        }
    ];

    builtins.forEach(nodeType => registry.register(nodeType));
    return registry;
};

const getNodeTypeRegistry = runtime => {
    if (!runtime) return null;
    const current = runtime[REGISTRY_PROPERTY];
    if (
        current &&
        current.version === REGISTRY_VERSION &&
        typeof current.register === 'function' &&
        typeof current.listTypes === 'function'
    ) {
        return current;
    }

    const registry = registerBuiltinNodeTypes(createNodeTypeRegistry());
    runtime[REGISTRY_PROPERTY] = registry;
    return registry;
};

export {
    REGISTRY_PROPERTY,
    REGISTRY_VERSION,
    createNodeTypeRegistry,
    getNodeTypeRegistry,
    registerBuiltinNodeTypes,
    validateNodeType
};
