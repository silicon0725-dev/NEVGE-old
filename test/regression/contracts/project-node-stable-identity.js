'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const NODE_DATABASE = path.join(ROOT, 'src/lib/project-nodes/node-database.js');
const MIGRATION = path.join(ROOT, 'src/lib/project-nodes/legacy-node-identity-migration.js');
const CORE_IDENTITY = path.join(ROOT, 'src/core/identity/stable-identity.js');
const PROJECT_PERSISTENCE = path.join(ROOT, 'src/lib/project-inspector/project-persistence.js');

const assertProjectNodeStableIdentityContract = () => {
    const database = fs.readFileSync(NODE_DATABASE, 'utf8');
    const migration = fs.readFileSync(MIGRATION, 'utf8');
    const identity = fs.readFileSync(CORE_IDENTITY, 'utf8');
    const projectPersistence = fs.readFileSync(PROJECT_PERSISTENCE, 'utf8');

    assert.match(database, /DATABASE_VERSION\s*=\s*4\b/, 'Project Node persistence version must remain v4+');
    assert.match(database, /createStableNodeId/, 'Project Nodes must be allocated by the NGVGE Stable Identity factory');
    assert.match(database, /migrateLegacyTargetDerivedNodeIds/, 'legacy target-derived NodeIds must remain migration-only input');
    assert.doesNotMatch(database, /getTargetNodeId/, 'active Project Node code must not derive NodeId from target.id');
    assert.doesNotMatch(database, /target-node:/, 'active Project Node persistence must not embed the legacy target-node identity format');
    assert.match(database, /delete\s+serialized\.targetId/, 'target runtime identity must not enter persisted Node records');
    assert.match(migration, /target-node:/, 'legacy format recognition must remain isolated in migration code');
    assert.match(migration, /migrateLegacyTargetDerivedNodeIdsInProjectSections/, 'legacy migration must remap NodeId references across NGVGE project sections');
    assert.match(projectPersistence, /migrateLegacyTargetDerivedNodeIdsInProjectSections/, 'Project persistence must apply cross-section legacy identity migration before section restore');
    assert.doesNotMatch(identity, /Scratch|target-node:|targetId/, 'Core identity semantics must remain backend independent');

    return {
        canonicalNodeOwnership: true,
        crossSectionReferenceMigration: true,
        legacyFormatMigrationOnly: true,
        projectNodePersistenceVersion: 4,
        scratchIdentityExcludedFromCore: true
    };
};

module.exports = {
    assertProjectNodeStableIdentityContract
};
