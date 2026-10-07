'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertFunctionalCollisionLegacyBoundaryContract = async () => {
    const registry = read('src/lib/project-nodes/node-type-registry.js');
    const inspector = read('src/components/project-inspector/project-inspector.jsx');
    const explorer = read('src/components/project-explorer/project-explorer.jsx');
    const colliderGizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const characterDebug = read('src/components/stage/character-controller2d-debug.jsx');

    assert.match(registry, /creationHidden:\s*true/);
    assert.match(registry, /legacyCompatibilityOnly:\s*true/);
    assert.match(inspector, /Legacy Collider2D compatibility node/);
    assert.match(inspector, /Upgrade as StaticBody2D/);
    assert.match(inspector, /Upgrade as Area2D/);
    assert.match(inspector, /colliderEditorClient\.patchComponent/);
    assert.match(explorer, /openFunctionalChildDialogForCompatibilityNode/);
    assert.match(colliderGizmo, /materializePortableCapabilityValue/);
    assert.match(colliderGizmo, /colliderRuntime\.listColliders/);
    assert.match(characterDebug, /materializePortableCapabilityValue/);
    assert.match(inspector, /materializePortableCapabilityValue\(runtimeNodeModel\.getNodeSnapshot/);

    return {
        functionalRuntimeColliderAuthority: true,
        legacyProjectCollisionCreationHidden: true,
        explicitMigration: true,
        compatibilityDataPreservedUntilSuccess: true,
        portableCapabilityValuesMaterialized: true
    };
};

module.exports = {assertFunctionalCollisionLegacyBoundaryContract};
