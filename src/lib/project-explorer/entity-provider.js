const ENTITY_PROVIDER_ID = 'entities';
const ENTITIES_ROOT_NODE_ID = 'provider:entities';
const TARGET_NODE_PREFIX = 'target:';

const getTargetNodeId = targetId => `${TARGET_NODE_PREFIX}${targetId}`;

const getTargetIdFromNodeId = nodeId => (
    typeof nodeId === 'string' && nodeId.indexOf(TARGET_NODE_PREFIX) === 0 ?
        nodeId.slice(TARGET_NODE_PREFIX.length) :
        null
);

const compareSprites = (spriteA, spriteB) => {
    const orderA = Number.isFinite(spriteA.order) ? spriteA.order : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(spriteB.order) ? spriteB.order : Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) return orderA - orderB;

    const nameA = typeof spriteA.name === 'string' ? spriteA.name : '';
    const nameB = typeof spriteB.name === 'string' ? spriteB.name : '';
    const nameComparison = nameA.localeCompare(nameB);

    if (nameComparison !== 0) return nameComparison;
    return spriteA.id.localeCompare(spriteB.id);
};

const createTargetNode = (target, options = {}) => ({
    id: getTargetNodeId(target.id),
    targetId: target.id,
    kind: options.isStage ? 'stage' : 'sprite',
    label: target.name || options.fallbackLabel || target.id,
    icon: options.isStage ? '▣' : '●',
    hasChildren: false
});

const createEntityProvider = options => {
    const stage = options && options.stage ? options.stage : {};
    const sprites = options && options.sprites ? options.sprites : {};
    const stageLabel = options && options.stageLabel ? options.stageLabel : 'Stage';

    const entityNodes = [];

    if (stage.id) {
        entityNodes.push(createTargetNode(stage, {
            fallbackLabel: stageLabel,
            isStage: true
        }));
    }

    Object.keys(sprites)
        .map(spriteId => sprites[spriteId])
        .filter(sprite => sprite && sprite.id)
        .sort(compareSprites)
        .forEach(sprite => {
            entityNodes.push(createTargetNode(sprite));
        });

    return {
        id: ENTITY_PROVIDER_ID,
        order: 10,
        getRootNode: () => ({
            id: ENTITIES_ROOT_NODE_ID,
            kind: 'provider-root',
            label: 'Entities',
            icon: '◫',
            hasChildren: true
        }),
        getChildren: nodeId => (
            nodeId === ENTITIES_ROOT_NODE_ID ? entityNodes : []
        )
    };
};

export {
    ENTITY_PROVIDER_ID,
    ENTITIES_ROOT_NODE_ID,
    TARGET_NODE_PREFIX,
    createEntityProvider,
    getTargetNodeId,
    getTargetIdFromNodeId
};
