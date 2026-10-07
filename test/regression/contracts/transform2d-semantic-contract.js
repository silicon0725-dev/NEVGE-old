const assert = require('assert');
const fs = require('fs');
const path = require('path');

const assertTransform2DSemanticContract = () => {
    const transform = require('../../../src/core/transform2d');
    const {createAuthorityRegistry} = require('../../../src/core/authority');
    const {validatePersistentDTO} = require('../../../src/core/persistent');
    const {validateProtocolDTO} = require('../../../src/core/protocol');
    const {createSchemaRegistry, validateSchemaDescriptor} = require('../../../src/core/schema');

    assert.strictEqual(transform.TRANSFORM2D_TYPE_ID, 'ngvge.transform2d');
    assert.strictEqual(transform.TRANSFORM2D_SCHEMA_VERSION, 1);
    assert.strictEqual(validateSchemaDescriptor(transform.TRANSFORM2D_SCHEMA_DESCRIPTOR).valid, true);

    const schemaRegistry = createSchemaRegistry();
    transform.registerTransform2DSchema(schemaRegistry);
    assert.strictEqual(schemaRegistry.get('ngvge.transform2d', 1).version, 1);

    const authorityRegistry = createAuthorityRegistry();
    transform.registerTransform2DAuthority(authorityRegistry);
    assert.strictEqual(authorityRegistry.getWriter('Transform2D').authorityId, 'scratch.compat.transform');
    assert.strictEqual(
        authorityRegistry.get('Transform2D', 'ngvge.semantic.transform').projectionDirection,
        'authority-to-projection'
    );

    const persistent = transform.normalizeTransform2D({position: [9, 8], rotation: 7, scale: [1, 1]});
    assert.strictEqual(validatePersistentDTO(persistent).valid, true);
    assert.strictEqual(transform.validateTransform2D(Object.assign({}, persistent, {
        targetRuntimeId: 'volatile'
    })).valid, false);

    const command = transform.createTransform2DPatchComponentCommand({
        componentId: 'component-transform-abcdefgh',
        nodeId: 'ngvge:node:abcdefgh',
        patch: {rotation: 15}
    });
    assert.strictEqual(command.type, 'PatchComponent');
    assert.strictEqual(validateProtocolDTO(command).valid, true);

    const source = fs.readFileSync(path.resolve(__dirname, '../../../src/core/transform2d/transform2d-contract.js'), 'utf8');
    assert.doesNotMatch(source, /scratch-vm|scratch-render|targetRuntimeId|_allDrawables|_allSkins|_drawThese|BitmapSkin|Drawable/);

    return {
        editorMutationExpressibleAsPatchComponent: true,
        persistentDTOGate: true,
        scratchCompatibilityAuthorityDeclared: true,
        scratchTargetExcludedFromComponentData: true,
        versionedSchema: true
    };
};

module.exports = {
    assertTransform2DSemanticContract
};
