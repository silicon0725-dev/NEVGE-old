'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    PersistentDTOValidationError,
    clonePersistentDTO,
    validatePersistentDTO
} = require('../../../src/core/persistent');

const ROOT = path.resolve(__dirname, '../../..');
const LEGACY_PERSISTENCE = path.join(ROOT, 'src/lib/persistence/persistent-data.js');
const PROJECT_PERSISTENCE = path.join(ROOT, 'src/lib/project-inspector/project-persistence.js');
const CORE_PERSISTENT = path.join(ROOT, 'src/core/persistent/persistent-dto.js');

const assertPersistentDTOBoundaryContract = () => {
    const core = fs.readFileSync(CORE_PERSISTENT, 'utf8');
    const legacy = fs.readFileSync(LEGACY_PERSISTENCE, 'utf8');
    const project = fs.readFileSync(PROJECT_PERSISTENCE, 'utf8');

    assert.match(core, /ngvge-persistent-dto\/v1/, 'Core Persistent DTO schema must remain explicit and versioned');
    assert.doesNotMatch(core, /Scratch|React|document\.|window\.|scratch-vm/, 'Core Persistent DTO semantics must remain backend independent');
    assert.match(legacy, /require\('\.\.\/\.\.\/core\/persistent'\)/, 'Legacy persistence API must remain a compatibility facade over Core');
    assert.match(project, /from '\.\.\/\.\.\/core\/persistent'/, 'Project Persistence must consume Core Persistent DTO authority');
    assert.match(project, /clonePersistentDTO\(value\)/, 'Project Persistence must validate before cloning section DTOs');
    assert.doesNotMatch(project, /JSON\.parse\(JSON\.stringify\(value\)\)/, 'Project Persistence must not silently sanitize invalid DTOs');

    const invalid = {kept: true, droppedByJSON: undefined};
    const result = validatePersistentDTO(invalid);
    assert.strictEqual(result.valid, false, 'invalid DTO must fail closed');
    assert(result.issues.some(issue => issue.code === 'persistent.value.undefined'));
    assert.throws(() => clonePersistentDTO(invalid), PersistentDTOValidationError);

    return {
        backendIndependentCore: true,
        projectPersistenceConsumesCore: true,
        invalidDataFailsClosed: true,
        jsonSanitizationForbidden: true
    };
};

module.exports = {
    assertPersistentDTOBoundaryContract
};
