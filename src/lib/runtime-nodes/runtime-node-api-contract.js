const {
    RUNTIME_NODE_LOCAL_HOST_CAPABILITY_ID,
    RUNTIME_NODE_MODEL_API_VERSION,
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID,
    RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID
} = require('./constants');
const {RUNTIME_NODE_LIFECYCLE_CONTRACT} = require('./runtime-node-lifecycle');
const {RUNTIME_COMPONENT_CONTRACT} = require('./runtime-component-contract');
const {RUNTIME_NODE_SNAPSHOT_CONTRACT} = require('./runtime-node-snapshot-contract');

const freezeList = values => Object.freeze(values.slice());
const freezeDescriptors = values => Object.freeze(values.map(value => Object.freeze(Object.assign({}, value))));

const RUNTIME_NODE_MODEL_PORTABLE_QUERY_METHODS = freezeList([
    'canSetParent',
    'createReference',
    'exportState',
    'getApiContract',
    'getChildren',
    'getComponentSnapshot',
    'getDebugSnapshot',
    'getGlobalRoot',
    'getGraphSnapshot',
    'getImportStatus',
    'getNodeSnapshot',
    'getNodeType',
    'getNodeTypeRegistryRevision',
    'getParent',
    'getSceneRoot',
    'getSceneSnapshot',
    'getStatus',
    'listNodes',
    'listNodeTypes',
    'querySubtree',
    'resolveReference',
    'validatePersistentState'
]);

const RUNTIME_NODE_MODEL_PORTABLE_MUTATION_METHODS = freezeList([
    'addComponent',
    'createNode',
    'destroyNode',
    'detachNode',
    'duplicateNode',
    'patchComponent',
    'patchNode',
    'patchNodeMetadata',
    'removeComponent',
    'reorderChild',
    'setComponentData',
    'setComponentEnabled',
    'setNodeEnabled',
    'setParent'
]);

const RUNTIME_NODE_MODEL_LOCAL_METHODS = freezeList([
    'subscribe'
]);

const RUNTIME_NODE_MODEL_COMPATIBILITY_ALIASES = freezeDescriptors([
    {method: 'getNode', replacement: 'getNodeSnapshot'},
    {method: 'getComponent', replacement: 'getComponentSnapshot'},
    {method: 'patchComponentData', replacement: 'patchComponent'},
    {method: 'renameNode', replacement: 'patchNode'}
]);

const RUNTIME_NODE_MODEL_METADATA_KEYS = freezeList([
    'apiVersion',
    'capabilityId',
    'nodeScopes',
    'version'
]);

const RUNTIME_NODE_MODEL_COMPATIBILITY_ALIAS_METHODS = freezeList(
    RUNTIME_NODE_MODEL_COMPATIBILITY_ALIASES.map(alias => alias.method)
);

const RUNTIME_NODE_MODEL_PUBLIC_SURFACE_KEYS = freezeList([
    ...RUNTIME_NODE_MODEL_METADATA_KEYS,
    ...RUNTIME_NODE_MODEL_PORTABLE_QUERY_METHODS,
    ...RUNTIME_NODE_MODEL_PORTABLE_MUTATION_METHODS,
    ...RUNTIME_NODE_MODEL_LOCAL_METHODS,
    ...RUNTIME_NODE_MODEL_COMPATIBILITY_ALIAS_METHODS
].sort());

const RUNTIME_NODE_TYPE_REGISTRATION_METHODS = freezeList([
    'bindComponentMigration',
    'bindNodeTypeProvider',
    'getComponentTypeDescriptor',
    'getNodeTypeDescriptor',
    'listComponentMigrations',
    'listComponentTypeDescriptors',
    'listNodeTypeDescriptors',
    'registerComponentTypeDescriptor',
    'registerNodeTypeDescriptor',
    'reifyUnknownNodes',
    'unbindComponentMigration',
    'unbindNodeTypeProvider',
    'unregisterComponentTypeDescriptor',
    'unregisterNodeTypeDescriptor'
]);

const RUNTIME_NODE_PERSISTENCE_CONTROLLER_METHODS = freezeList([
    'exportState',
    'importState',
    'persistState',
    'synchronizeScenes'
]);

const RUNTIME_NODE_LOCAL_HOST_METHODS = freezeList([
    'dispose',
    'traverse'
]);

const methodDescriptor = (name, portability, options = {}) => Object.freeze({
    acceptsCallback: options.acceptsCallback === true,
    argumentsSerializable: options.argumentsSerializable !== false,
    name,
    portability,
    resultSerializable: options.resultSerializable !== false,
    returnsFunction: options.returnsFunction === true
});

const RUNTIME_NODE_MODEL_METHOD_DESCRIPTORS = freezeDescriptors([
    ...RUNTIME_NODE_MODEL_PORTABLE_QUERY_METHODS.map(name => methodDescriptor(name, 'portable')),
    ...RUNTIME_NODE_MODEL_PORTABLE_MUTATION_METHODS.map(name => methodDescriptor(name, 'portable')),
    ...RUNTIME_NODE_MODEL_LOCAL_METHODS.map(name => methodDescriptor(name, 'local-only', {
        acceptsCallback: name === 'subscribe',
        argumentsSerializable: false,
        resultSerializable: false,
        returnsFunction: name === 'subscribe'
    })),
    ...RUNTIME_NODE_MODEL_COMPATIBILITY_ALIAS_METHODS.map(name => methodDescriptor(name, 'compatibility'))
]);

const RUNTIME_NODE_MODEL_API_CONTRACT = Object.freeze({
    apiVersion: RUNTIME_NODE_MODEL_API_VERSION,
    capabilityId: RUNTIME_NODE_MODEL_CAPABILITY_ID,
    compatibilityAliases: RUNTIME_NODE_MODEL_COMPATIBILITY_ALIASES,
    componentContract: RUNTIME_COMPONENT_CONTRACT,
    lifecycleContract: RUNTIME_NODE_LIFECYCLE_CONTRACT,
    localMethods: RUNTIME_NODE_MODEL_LOCAL_METHODS,
    metadataKeys: RUNTIME_NODE_MODEL_METADATA_KEYS,
    methodDescriptors: RUNTIME_NODE_MODEL_METHOD_DESCRIPTORS,
    mutationResultContract: Object.freeze({
        errorIsPortableData: true,
        fields: freezeList(['applied', 'error', 'persisted', 'snapshot']),
        commitEventsAfterPersistence: true,
        failedMutationApplied: false,
        multiCommandTransactions: false,
        rollbackPreservesRuntimeGeneration: true,
        transactionSemantics: 'single-command-atomic'
    }),
    portableMutationMethods: RUNTIME_NODE_MODEL_PORTABLE_MUTATION_METHODS,
    portableQueryMethods: RUNTIME_NODE_MODEL_PORTABLE_QUERY_METHODS,
    publicSurfaceKeys: RUNTIME_NODE_MODEL_PUBLIC_SURFACE_KEYS,
    returnsMutableRuntimeInstances: false,
    snapshotContract: Object.freeze({
        backendHandlesAllowed: false,
        deepFrozen: true,
        plainDataOnly: true,
        runtimeInstancesAllowed: false
    }),
    splitCapabilities: Object.freeze({
        localHost: Object.freeze({
            capabilityId: RUNTIME_NODE_LOCAL_HOST_CAPABILITY_ID,
            methods: RUNTIME_NODE_LOCAL_HOST_METHODS,
            portability: 'local-only'
        }),
        persistenceController: Object.freeze({
            capabilityId: RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID,
            methods: RUNTIME_NODE_PERSISTENCE_CONTROLLER_METHODS,
            portability: 'internal'
        }),
        snapshotQuery: Object.freeze({
            capabilityId: RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
            contract: RUNTIME_NODE_SNAPSHOT_CONTRACT,
            methods: RUNTIME_NODE_SNAPSHOT_CONTRACT.methods,
            portability: 'portable'
        }),
        typeRegistration: Object.freeze({
            capabilityId: RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
            methods: RUNTIME_NODE_TYPE_REGISTRATION_METHODS,
            portability: 'restricted-host'
        })
    })
});

module.exports = {
    RUNTIME_NODE_LOCAL_HOST_METHODS,
    RUNTIME_NODE_MODEL_API_CONTRACT,
    RUNTIME_NODE_MODEL_API_VERSION,
    RUNTIME_NODE_MODEL_COMPATIBILITY_ALIASES,
    RUNTIME_NODE_MODEL_COMPATIBILITY_ALIAS_METHODS,
    RUNTIME_NODE_MODEL_LOCAL_METHODS,
    RUNTIME_NODE_MODEL_METADATA_KEYS,
    RUNTIME_NODE_MODEL_METHOD_DESCRIPTORS,
    RUNTIME_NODE_MODEL_PORTABLE_MUTATION_METHODS,
    RUNTIME_NODE_MODEL_PORTABLE_QUERY_METHODS,
    RUNTIME_NODE_MODEL_PUBLIC_SURFACE_KEYS,
    RUNTIME_NODE_PERSISTENCE_CONTROLLER_METHODS,
    RUNTIME_NODE_TYPE_REGISTRATION_METHODS
};
