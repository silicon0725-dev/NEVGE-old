#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const paths = {
    core: path.join(ROOT, 'src/core/identity/stable-identity.js'),
    hostFactory: path.join(ROOT, 'src/lib/identity/host-stable-id-factory.js'),
    migration: path.join(ROOT, 'src/lib/project-nodes/legacy-node-identity-migration.js'),
    nodeDatabase: path.join(ROOT, 'src/lib/project-nodes/node-database.js'),
    projectPersistence: path.join(ROOT, 'src/lib/project-inspector/project-persistence.js')
};

const failures = [];
const requireFile = (name, filePath) => {
    if (!fs.existsSync(filePath)) {
        failures.push(`${name} missing: ${path.relative(ROOT, filePath)}`);
        return '';
    }
    return fs.readFileSync(filePath, 'utf8');
};

const core = requireFile('Stable Identity core contract', paths.core);
const hostFactory = requireFile('Host stable-id factory', paths.hostFactory);
const migration = requireFile('Legacy identity migration', paths.migration);
const nodeDatabase = requireFile('Project Node database', paths.nodeDatabase);
const projectPersistence = requireFile('Project persistence boundary', paths.projectPersistence);

const assertContains = (source, pattern, message) => {
    if (!pattern.test(source)) failures.push(message);
};
const assertNotContains = (source, pattern, message) => {
    if (pattern.test(source)) failures.push(message);
};

assertContains(core, /STABLE_ID_SCHEMA\s*=\s*['"]ngvge-stable-identity\/v1['"]/, 'Core identity schema v1 is not declared.');
for (const kind of ['NODE', 'SCENE', 'RESOURCE', 'MODULE', 'COMPONENT_TYPE', 'BINDING', 'TRANSACTION']) {
    assertContains(core, new RegExp(`\\b${kind}\\s*:`), `Stable identity kind ${kind} is missing.`);
}
assertContains(core, /@typedef\s+\{string\}\s+NodeId/, 'NodeId semantic type declaration is missing.');
assertContains(core, /@typedef\s+\{string\}\s+SceneId/, 'SceneId semantic type declaration is missing.');
assertContains(core, /@typedef\s+\{string\}\s+ResourceId/, 'ResourceId semantic type declaration is missing.');
assertContains(core, /@typedef\s+\{string\}\s+BindingId/, 'BindingId semantic type declaration is missing.');

assertContains(hostFactory, /createStableIdentity/, 'Host identity factory must delegate formatting/validation to src/core/identity.');
assertContains(nodeDatabase, /DATABASE_VERSION\s*=\s*4\b/, 'Project Node database must persist Stable Identity schema as database version 4.');
assertContains(nodeDatabase, /createStableNodeId/, 'Project Node database must allocate NGVGE-owned stable NodeIds.');
assertContains(nodeDatabase, /migrateLegacyTargetDerivedNodeIds/, 'Project Node database must migrate legacy target-derived identities on load.');
assertNotContains(nodeDatabase, /getTargetNodeId/, 'Project Node database must not derive NodeId from Scratch target id.');
assertNotContains(nodeDatabase, /target-node:/, 'Legacy target-node identities must not be generated or embedded by the active Project Node database.');
assertContains(nodeDatabase, /delete\s+serialized\.targetId/, 'Scratch target runtime identity must remain excluded from persisted Node Tree records.');

assertContains(migration, /LEGACY_TARGET_NODE_PREFIX\s*=\s*['"]target-node:['"]/, 'Legacy migration must explicitly recognize the historical target-node format.');
assertContains(migration, /remapIdentityReferences/, 'Legacy migration must remap internal identity references, not only record ids.');
assertContains(migration, /migrateLegacyTargetDerivedNodeIdsInProjectSections/, 'Legacy migration must support cross-section NodeId reference remapping.');
assertContains(projectPersistence, /migrateLegacyTargetDerivedNodeIdsInProjectSections/, 'Project persistence must remap legacy NodeId references before section deserialization.');
assertNotContains(core, /Scratch|target-node:|targetId/, 'Core Stable Identity contract must not know Scratch target identity semantics.');

if (failures.length) {
    console.error(`ARC-C001 Stable Identity Gate FAIL (${failures.length} violation(s))`);
    failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
    process.exit(1);
}

console.log('ARC-C001 Stable Identity Gate PASS: canonical identity contract, host entropy boundary, v4 Project Node ownership, and transactional legacy target-id migration are present.');
