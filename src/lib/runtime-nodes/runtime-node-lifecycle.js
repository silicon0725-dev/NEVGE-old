const {
    COMPONENT_LIFECYCLE_STATES,
    NODE_LIFECYCLE_STATES,
    RUNTIME_NODE_LIFECYCLE_CONTRACT_ID,
    RUNTIME_NODE_LIFECYCLE_CONTRACT_VERSION
} = require('./constants');

const LIFECYCLE_ENTITY_KINDS = Object.freeze({
    COMPONENT: 'component',
    NODE: 'node'
});

const LIFECYCLE_PHASES = Object.freeze({
    ATTACH: 'attach',
    CREATE: 'create',
    DESTROY: 'destroy',
    DETACH: 'detach',
    DISABLE: 'disable',
    ENABLE: 'enable',
    READY: 'ready',
    REORDER: 'reorder'
});

const freezeTransitions = source => Object.freeze(Object.keys(source).reduce((result, state) => {
    result[state] = Object.freeze(source[state].slice());
    return result;
}, {}));

const NODE_LIFECYCLE_TRANSITIONS = freezeTransitions({
    [NODE_LIFECYCLE_STATES.CREATED]: [
        NODE_LIFECYCLE_STATES.ATTACHED,
        NODE_LIFECYCLE_STATES.READY,
        NODE_LIFECYCLE_STATES.DESTROYED
    ],
    [NODE_LIFECYCLE_STATES.ATTACHED]: [
        NODE_LIFECYCLE_STATES.READY,
        NODE_LIFECYCLE_STATES.DETACHED,
        NODE_LIFECYCLE_STATES.DESTROYED
    ],
    [NODE_LIFECYCLE_STATES.READY]: [
        NODE_LIFECYCLE_STATES.ACTIVE,
        NODE_LIFECYCLE_STATES.DISABLED,
        NODE_LIFECYCLE_STATES.DETACHED,
        NODE_LIFECYCLE_STATES.DESTROYED
    ],
    [NODE_LIFECYCLE_STATES.ACTIVE]: [
        NODE_LIFECYCLE_STATES.DISABLED,
        NODE_LIFECYCLE_STATES.DETACHED,
        NODE_LIFECYCLE_STATES.DESTROYED
    ],
    [NODE_LIFECYCLE_STATES.DISABLED]: [
        NODE_LIFECYCLE_STATES.ACTIVE,
        NODE_LIFECYCLE_STATES.DETACHED,
        NODE_LIFECYCLE_STATES.DESTROYED
    ],
    [NODE_LIFECYCLE_STATES.DETACHED]: [
        NODE_LIFECYCLE_STATES.ATTACHED,
        NODE_LIFECYCLE_STATES.DESTROYED
    ],
    [NODE_LIFECYCLE_STATES.DESTROYED]: []
});

const NODE_LIFECYCLE_CONDITIONAL_TRANSITIONS = Object.freeze({
    reattachAfterReady: Object.freeze({
        fromState: NODE_LIFECYCLE_STATES.ATTACHED,
        requiresReadyInvoked: true,
        toStates: Object.freeze([
            NODE_LIFECYCLE_STATES.ACTIVE,
            NODE_LIFECYCLE_STATES.DISABLED
        ])
    })
});

const COMPONENT_LIFECYCLE_TRANSITIONS = freezeTransitions({
    [COMPONENT_LIFECYCLE_STATES.CREATED]: [
        COMPONENT_LIFECYCLE_STATES.ATTACHED,
        COMPONENT_LIFECYCLE_STATES.DESTROYED
    ],
    [COMPONENT_LIFECYCLE_STATES.ATTACHED]: [
        COMPONENT_LIFECYCLE_STATES.READY,
        COMPONENT_LIFECYCLE_STATES.DETACHED,
        COMPONENT_LIFECYCLE_STATES.DESTROYED
    ],
    [COMPONENT_LIFECYCLE_STATES.READY]: [
        COMPONENT_LIFECYCLE_STATES.ACTIVE,
        COMPONENT_LIFECYCLE_STATES.DISABLED,
        COMPONENT_LIFECYCLE_STATES.DETACHED,
        COMPONENT_LIFECYCLE_STATES.DESTROYED
    ],
    [COMPONENT_LIFECYCLE_STATES.ACTIVE]: [
        COMPONENT_LIFECYCLE_STATES.DISABLED,
        COMPONENT_LIFECYCLE_STATES.DETACHED,
        COMPONENT_LIFECYCLE_STATES.DESTROYED
    ],
    [COMPONENT_LIFECYCLE_STATES.DISABLED]: [
        COMPONENT_LIFECYCLE_STATES.ACTIVE,
        COMPONENT_LIFECYCLE_STATES.DETACHED,
        COMPONENT_LIFECYCLE_STATES.DESTROYED
    ],
    [COMPONENT_LIFECYCLE_STATES.DETACHED]: [
        COMPONENT_LIFECYCLE_STATES.ATTACHED,
        COMPONENT_LIFECYCLE_STATES.DESTROYED
    ],
    [COMPONENT_LIFECYCLE_STATES.DESTROYED]: []
});

const normalizeLifecycleDetails = source => {
    const details = {};
    const allowedKeys = [
        'active',
        'componentId',
        'componentTypeId',
        'enabled',
        'entityKind',
        'fromState',
        'hookName',
        'index',
        'nodeId',
        'operation',
        'originKind',
        'eventType',
        'parentId',
        'phase',
        'previousRuntimeGeneration',
        'previousIndex',
        'previousParentId',
        'reason',
        'sceneId',
        'state',
        'toState'
    ];
    allowedKeys.forEach(key => {
        const value = source && source[key];
        if (typeof value === 'string' || typeof value === 'number' ||
            typeof value === 'boolean' || value === null) {
            details[key] = value;
        }
    });
    return details;
};

const transitionsFor = entityKind => {
    if (entityKind === LIFECYCLE_ENTITY_KINDS.NODE) return NODE_LIFECYCLE_TRANSITIONS;
    if (entityKind === LIFECYCLE_ENTITY_KINDS.COMPONENT) return COMPONENT_LIFECYCLE_TRANSITIONS;
    throw new TypeError(`Unknown lifecycle entity kind: ${entityKind}`);
};

const assertLifecycleTransition = (entityKind, fromState, toState, context = {}) => {
    const transitions = transitionsFor(entityKind);
    const allowed = transitions[fromState];
    const reattach = NODE_LIFECYCLE_CONDITIONAL_TRANSITIONS.reattachAfterReady;
    const conditionallyAllowed = entityKind === LIFECYCLE_ENTITY_KINDS.NODE &&
        fromState === reattach.fromState &&
        reattach.toStates.includes(toState) &&
        context.readyInvoked === true;
    if ((!allowed || !allowed.includes(toState)) && !conditionallyAllowed) {
        const error = new Error(`Invalid ${entityKind} lifecycle transition: ${fromState} -> ${toState}`);
        error.code = 'RUNTIME_LIFECYCLE_TRANSITION_INVALID';
        error.entityKind = entityKind;
        error.fromState = fromState;
        error.toState = toState;
        throw error;
    }
    return true;
};

const RUNTIME_NODE_LIFECYCLE_CONTRACT = Object.freeze({
    contractId: RUNTIME_NODE_LIFECYCLE_CONTRACT_ID,
    contractVersion: RUNTIME_NODE_LIFECYCLE_CONTRACT_VERSION,
    componentStates: COMPONENT_LIFECYCLE_STATES,
    componentTransitions: COMPONENT_LIFECYCLE_TRANSITIONS,
    destroyOrder: Object.freeze([
        'descendants-child-first',
        'disable-active-subtree',
        'detach-node',
        'detach-components',
        'destroy-components',
        'destroy-node'
    ]),
    entityKinds: LIFECYCLE_ENTITY_KINDS,
    eventSchema: Object.freeze({
        orderingIdentity: '(runtimeGeneration, sequence)',
        portableDataOnly: true,
        sequenceMonotonicPerGeneration: true,
        fields: Object.freeze([
            'type', 'lifecycleContractVersion', 'runtimeGeneration', 'sequence', 'entityKind', 'phase',
            'nodeId', 'componentId', 'componentTypeId', 'fromState', 'toState',
            'parentId', 'previousParentId', 'index', 'previousIndex', 'reason',
            'hookName', 'state', 'code', 'error', 'operation', 'originKind', 'eventType',
            'previousRuntimeGeneration'
        ])
    }),
    eventType: 'lifecycle',
    hookErrorEventType: 'lifecycle:error',
    hookReentrancyErrorCode: 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION',
    replacementEventType: 'runtime:replaced',
    hookErrorPolicy: 'isolate-and-report',
    hookObservationBoundary: Object.freeze({
        componentValue: 'detached-deep-frozen-plain-snapshot',
        graphExposed: false,
        nodeValue: 'detached-deep-frozen-plain-snapshot',
        queryFacade: 'read-only',
        resources: 'provider-owned-local-context'
    }),
    hookPortability: 'local-provider-only',
    hookReentrancyPolicy: 'reject-synchronous-runtime-semantic-mutation',
    observerReentrancyPolicy: Object.freeze({
        diagnostic: 'local-only-no-recursive-event',
        errorCode: 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION',
        policy: 'reject-synchronous-runtime-semantic-mutation',
        scope: 'public-capability-observer-dispatch'
    }),
    nodeConditionalTransitions: NODE_LIFECYCLE_CONDITIONAL_TRANSITIONS,
    nodeStates: NODE_LIFECYCLE_STATES,
    nodeTransitions: NODE_LIFECYCLE_TRANSITIONS,
    phases: LIFECYCLE_PHASES,
    readySemantics: 'once-per-instance',
    runtimeGenerationSemantics: 'increment-on-successful-runtime-graph-replacement',
    detachSemantics: Object.freeze({
        componentDetachMeans: 'component-owner-relationship-removed',
        nodeDetachMeans: 'node-parent-hierarchy-relationship-removed',
        nodeDetachRemovesComponentOwnership: false
    }),
    reparentSemantics: Object.freeze({
        componentOwnershipChanges: false,
        componentReadyRepeats: false,
        nodeReadyRepeats: false,
        sequence: Object.freeze(['disable', 'detach', 'attach', 'enable-or-disable'])
    }),
    reorderSemantics: Object.freeze({
        attachRepeats: false,
        detachRepeats: false,
        readyRepeats: false,
        stateChanges: false
    })
});

module.exports = {
    COMPONENT_LIFECYCLE_TRANSITIONS,
    LIFECYCLE_ENTITY_KINDS,
    LIFECYCLE_PHASES,
    NODE_LIFECYCLE_CONDITIONAL_TRANSITIONS,
    NODE_LIFECYCLE_TRANSITIONS,
    RUNTIME_NODE_LIFECYCLE_CONTRACT,
    assertLifecycleTransition,
    normalizeLifecycleDetails
};
