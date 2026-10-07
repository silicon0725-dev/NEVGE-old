import {
    STABLE_ID_KINDS,
    assertStableIdentity
} from '../../core/identity';

const LEGACY_TARGET_NODE_PREFIX = 'target-node:';
const NODE_TREE_SECTION_ID = 'ngvge-node-tree';
const MAX_ID_FACTORY_ATTEMPTS = 64;

const cloneSerializable = value => JSON.parse(JSON.stringify(value));

const isLegacyTargetDerivedNodeId = value => (
    typeof value === 'string' && value.startsWith(LEGACY_TARGET_NODE_PREFIX) && value.length > LEGACY_TARGET_NODE_PREFIX.length
);

const createUniqueStableNodeId = (nodeIdFactory, usedIds) => {
    for (let attempt = 0; attempt < MAX_ID_FACTORY_ATTEMPTS; attempt++) {
        const candidate = nodeIdFactory();
        assertStableIdentity(candidate, STABLE_ID_KINDS.NODE);
        if (!usedIds.has(candidate)) {
            usedIds.add(candidate);
            return candidate;
        }
    }
    const error = new Error('Unable to allocate a unique canonical NGVGE NodeId while migrating legacy target identities.');
    error.code = 'NGVGE_NODE_ID_MIGRATION_EXHAUSTED';
    throw error;
};

const remapIdentityReferences = (value, aliases) => {
    if (typeof value === 'string') return aliases.get(value) || value;
    if (Array.isArray(value)) return value.map(item => remapIdentityReferences(item, aliases));
    if (!value || typeof value !== 'object') return value;

    const output = {};
    Object.keys(value).forEach(key => {
        const nextKey = aliases.get(key) || key;
        output[nextKey] = remapIdentityReferences(value[key], aliases);
    });
    return output;
};

const migrateLegacyTargetDerivedNodeIds = (input, nodeIdFactory) => {
    if (typeof nodeIdFactory !== 'function') {
        throw new TypeError('Legacy Project Node identity migration requires a canonical NodeId factory.');
    }
    const source = input && typeof input === 'object' ? cloneSerializable(input) : {};
    const records = Array.isArray(source.nodes) ? source.nodes : [];
    const usedIds = new Set(
        records.map(record => record && typeof record.id === 'string' ? record.id : null).filter(Boolean)
    );
    const aliases = new Map();

    records.forEach(record => {
        const legacyId = record && record.id;
        if (!isLegacyTargetDerivedNodeId(legacyId) || aliases.has(legacyId)) return;
        usedIds.delete(legacyId);
        aliases.set(legacyId, createUniqueStableNodeId(nodeIdFactory, usedIds));
    });

    if (!aliases.size) {
        return {
            aliases,
            data: source,
            migratedNodeCount: 0
        };
    }

    return {
        aliases,
        data: remapIdentityReferences(source, aliases),
        migratedNodeCount: aliases.size
    };
};

const migrateLegacyTargetDerivedNodeIdsInProjectSections = (input, nodeIdFactory) => {
    const source = input && typeof input === 'object' ? cloneSerializable(input) : {};
    const nodeTree = source[NODE_TREE_SECTION_ID];
    if (!nodeTree || typeof nodeTree !== 'object') {
        return {
            aliases: new Map(),
            data: source,
            migratedNodeCount: 0
        };
    }

    const migration = migrateLegacyTargetDerivedNodeIds(nodeTree, nodeIdFactory);
    if (!migration.aliases.size) {
        return {
            aliases: migration.aliases,
            data: source,
            migratedNodeCount: 0
        };
    }

    return {
        aliases: migration.aliases,
        data: remapIdentityReferences(source, migration.aliases),
        migratedNodeCount: migration.migratedNodeCount
    };
};

export {
    LEGACY_TARGET_NODE_PREFIX,
    NODE_TREE_SECTION_ID,
    isLegacyTargetDerivedNodeId,
    migrateLegacyTargetDerivedNodeIds,
    migrateLegacyTargetDerivedNodeIdsInProjectSections
};
