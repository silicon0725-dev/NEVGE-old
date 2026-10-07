const RUNTIME_NODE_MODEL_VERSION = 1;
const RUNTIME_NODE_MODEL_API_VERSION = '1.3.1';
const RUNTIME_NODE_MODEL_CAPABILITY_ID = 'ngvge.runtime-node-model';
const RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID = 'ngvge.runtime-node-type-registration';
const RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID = 'ngvge.runtime-node-persistence-controller';
const RUNTIME_NODE_LOCAL_HOST_CAPABILITY_ID = 'ngvge.runtime-node-local-host';
const RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID = 'ngvge.runtime-node-snapshot';
const RUNTIME_NODE_LIFECYCLE_CONTRACT_ID = 'ngvge.runtime-node-lifecycle';
const RUNTIME_NODE_LIFECYCLE_CONTRACT_VERSION = '1';
const RUNTIME_COMPONENT_CONTRACT_ID = 'ngvge.runtime-component';
const RUNTIME_COMPONENT_CONTRACT_VERSION = '1';

const NODE_SCOPES = Object.freeze({
    GLOBAL: 'global',
    SCENE: 'scene'
});

const NODE_FAMILIES = Object.freeze({
    NODE: 'node',
    NODE_2D: '2d',
    ROOT: 'root',
    SERVICE: 'service'
});

const NODE_LIFECYCLE_STATES = Object.freeze({
    CREATED: 'created',
    ATTACHED: 'attached',
    READY: 'ready',
    ACTIVE: 'active',
    DISABLED: 'disabled',
    DETACHED: 'detached',
    DESTROYED: 'destroyed'
});

const COMPONENT_LIFECYCLE_STATES = Object.freeze({
    CREATED: 'created',
    ATTACHED: 'attached',
    READY: 'ready',
    ACTIVE: 'active',
    DISABLED: 'disabled',
    DETACHED: 'detached',
    DESTROYED: 'destroyed'
});

const BUILTIN_RUNTIME_NODE_TYPE_IDS = Object.freeze({
    GLOBAL_ROOT: 'ngvge.global-root',
    NODE: 'ngvge.node',
    NODE_2D: 'ngvge.node2d',
    SCENE_ROOT: 'ngvge.scene-root',
    SERVICE_NODE: 'ngvge.service-node',
    UNKNOWN_NODE: 'ngvge.unknown-node'
});

const SEMANTIC_RUNTIME_NODE_TYPE_IDS = Object.freeze({
    SPRITE: 'ngvge.sprite-node'
});

const GLOBAL_ROOT_NODE_ID = 'runtime-node:global-root';
const getSceneRootNodeId = sceneId => `runtime-node:scene-root:${sceneId}`;

module.exports = {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_LIFECYCLE_STATES,
    GLOBAL_ROOT_NODE_ID,
    NODE_FAMILIES,
    NODE_LIFECYCLE_STATES,
    NODE_SCOPES,
    RUNTIME_COMPONENT_CONTRACT_ID,
    RUNTIME_COMPONENT_CONTRACT_VERSION,
    RUNTIME_NODE_MODEL_API_VERSION,
    RUNTIME_NODE_LIFECYCLE_CONTRACT_ID,
    RUNTIME_NODE_LIFECYCLE_CONTRACT_VERSION,
    RUNTIME_NODE_LOCAL_HOST_CAPABILITY_ID,
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_MODEL_VERSION,
    RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID,
    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
    SEMANTIC_RUNTIME_NODE_TYPE_IDS,
    getSceneRootNodeId
};
