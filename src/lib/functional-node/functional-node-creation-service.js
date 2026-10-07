'use strict';

const {
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_CREATION_CONTRACT,
    createFunctionalNodeCreationPlan,
    getFunctionalNodeArchetype,
    isFunctionalNodeArchetypeCreatable,
    listCreatableFunctionalNodeArchetypes
} = require('../../core/functional-node');

const FUNCTIONAL_NODE_CREATION_CAPABILITY_ID = 'ngvge.functional-node-creation';
const FUNCTIONAL_NODE_CREATION_CAPABILITY_VERSION = 1;

const normalizeScope = value => (
    typeof value === 'string' && value.trim() ? value.trim() : 'scene'
);

const clonePortable = value => JSON.parse(JSON.stringify(value));

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const createFunctionalNodeCreationService = options => {
    const runtimeNodeModel = options && options.runtimeNodeModel;
    const scratchSpriteAdapter = options && options.scratchSpriteAdapter;
    const camera2DAvailable = Boolean(options && options.camera2DAvailable);
    const collider2DAvailable = Boolean(options && options.collider2DAvailable);
    const characterController2DAvailable = Boolean(options && options.characterController2DAvailable);
    const tileSetResources = options && options.tileSetResources;
    const tileMapLayer2DAvailable = Boolean(options && options.tileMapLayer2DAvailable);
    const physics2DRuntime = options && options.physics2DRuntime;
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeType !== 'function') {
        const error = new TypeError('Functional Node creation requires the Runtime Node Model capability.');
        error.code = 'NGVGE_FUNCTIONAL_NODE_RUNTIME_MODEL_REQUIRED';
        throw error;
    }

    const scratchCompatibilityAvailable = Boolean(
        scratchSpriteAdapter &&
        typeof scratchSpriteAdapter.getBindingByNodeId === 'function' &&
        typeof scratchSpriteAdapter.reconcileActiveScene === 'function'
    );

    const isProviderAvailable = archetypeId => {
        if (archetypeId === FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D) return camera2DAvailable;
        if (archetypeId === FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D ||
            archetypeId === FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D) return collider2DAvailable;
        if (archetypeId === FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D) return tileMapLayer2DAvailable;
        if (archetypeId === FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D) {
            return collider2DAvailable && characterController2DAvailable;
        }
        if (archetypeId === FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D) {
            const status = physics2DRuntime && typeof physics2DRuntime.getStatus === 'function' ? physics2DRuntime.getStatus() : null;
            return collider2DAvailable && Boolean(status && status.backendReady);
        }
        return true;
    };

    const canUseRuntimeType = (runtimeTypeId, scope) => {
        const runtimeType = runtimeNodeModel.getNodeType(runtimeTypeId);
        return Boolean(
            runtimeType &&
            !runtimeType.abstract &&
            Array.isArray(runtimeType.allowedScopes) &&
            runtimeType.allowedScopes.indexOf(scope) !== -1
        );
    };

    const listArchetypes = listOptions => {
        const scope = normalizeScope(listOptions && listOptions.scope);
        if (scope !== 'scene') return Object.freeze([]);
        return Object.freeze(listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable})
            .filter(descriptor => isProviderAvailable(descriptor.id))
            .filter(descriptor => canUseRuntimeType(descriptor.baseRuntimeTypeId, scope))
            .map(descriptor => deepFreeze(Object.assign({}, clonePortable(descriptor), {
                abstract: false,
                allowedScopes: ['scene'],
                defaultScope: 'scene',
                owner: 'ngvge.scene-system',
                version: '1'
            }))));
    };

    const getArchetype = archetypeId => {
        if (!isFunctionalNodeArchetypeCreatable(archetypeId, {scratchCompatibilityAvailable}) ||
            !isProviderAvailable(archetypeId)) return null;
        const archetype = getFunctionalNodeArchetype(archetypeId);
        if (!archetype || !canUseRuntimeType(archetype.baseRuntimeTypeId, 'scene')) return null;
        return listArchetypes({scope: 'scene'}).find(entry => entry.id === archetypeId) || null;
    };

    const createPlan = (archetypeId, planOptions = {}) => {
        const scope = normalizeScope(planOptions.scope);
        if (scope !== 'scene') {
            const error = new Error('Functional 2D archetypes can currently only be created in scene scope.');
            error.code = 'NGVGE_FUNCTIONAL_NODE_SCOPE_UNSUPPORTED';
            error.scope = scope;
            throw error;
        }
        if (!isProviderAvailable(archetypeId)) {
            const error = new Error(`Functional Node runtime provider is unavailable: ${archetypeId}`);
            error.code = 'NGVGE_FUNCTIONAL_NODE_PROVIDER_UNAVAILABLE';
            error.archetypeId = archetypeId;
            throw error;
        }
        const plan = createFunctionalNodeCreationPlan(archetypeId, {scratchCompatibilityAvailable});
        if (!canUseRuntimeType(plan.runtimeTypeId, scope)) {
            const error = new Error(`Functional Node runtime type is unavailable: ${plan.runtimeTypeId}`);
            error.code = 'NGVGE_FUNCTIONAL_NODE_RUNTIME_TYPE_UNAVAILABLE';
            error.runtimeTypeId = plan.runtimeTypeId;
            throw error;
        }
        const createOptions = clonePortable(plan.options || {});
        if (archetypeId === FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D && tileSetResources &&
            typeof tileSetResources.ensureDefaultTileSet === 'function') {
            const tileSet = tileSetResources.ensureDefaultTileSet();
            const component = Array.isArray(createOptions.components) ? createOptions.components.find(item => (
                item && item.typeId === 'ngvge.tilemap-layer2d'
            )) : null;
            if (component && tileSet && tileSet.resourceId) {
                component.data = Object.assign({}, component.data || {}, {tileSetResourceId: tileSet.resourceId});
            }
        }
        const archetype = getFunctionalNodeArchetype(archetypeId);
        if (typeof planOptions.name === 'string' && planOptions.name.trim()) {
            createOptions.name = planOptions.name.trim();
        } else if (archetype && typeof archetype.label === 'string' && archetype.label.trim()) {
            createOptions.name = archetype.label.trim();
        }
        if (typeof planOptions.sceneId === 'string' && planOptions.sceneId.trim()) createOptions.sceneId = planOptions.sceneId.trim();
        createOptions.scope = scope;
        return deepFreeze(Object.assign({}, clonePortable(plan), {options: createOptions}));
    };

    return Object.freeze({
        capabilityId: FUNCTIONAL_NODE_CREATION_CAPABILITY_ID,
        version: FUNCTIONAL_NODE_CREATION_CAPABILITY_VERSION,
        contract: FUNCTIONAL_NODE_CREATION_CONTRACT,
        createPlan,
        getArchetype,
        isArchetype: archetypeId => Boolean(getArchetype(archetypeId)),
        listArchetypes,
        getStatus: () => Object.freeze({
            camera2DAvailable,
            characterController2DAvailable,
            collider2DAvailable,
            tileMapLayer2DAvailable,
            physics2DBackendReady: Boolean(physics2DRuntime && typeof physics2DRuntime.getStatus === 'function' && physics2DRuntime.getStatus().backendReady),
            creatableArchetypeIds: listArchetypes({scope: 'scene'}).map(item => item.id),
            scratchCompatibilityAvailable
        })
    });
};

module.exports = {
    FUNCTIONAL_NODE_CREATION_CAPABILITY_ID,
    FUNCTIONAL_NODE_CREATION_CAPABILITY_VERSION,
    createFunctionalNodeCreationService
};
