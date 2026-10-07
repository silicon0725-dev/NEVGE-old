#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const {TILESET_CONTRACT, TILESET_RESOURCE_TYPE_ID} = require('../../src/core/tileset');
const {TILEMAP_LAYER2D_CONTRACT, TILEMAP_LAYER2D_TYPE_ID, setTileMapCell} = require('../../src/core/tilemap-layer2d');
const {FUNCTIONAL_NODE_ARCHETYPE_IDS, createFunctionalNodeCreationPlan, listCreatableFunctionalNodeArchetypes} = require('../../src/core/functional-node');
const {TILESET_RESOURCE_CAPABILITY_ID, TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID, TILEMAP_AUTHORING_TOOLS} = require('../../src/lib/tilemap-system');

const checks = [];
const check = (title, fn) => { fn(); checks.push(title); };

check('TileSet is a global ResourceId resource type', () => {
    assert.strictEqual(TILESET_RESOURCE_TYPE_ID, 'ngvge.tileset-resource');
    assert.strictEqual(TILESET_CONTRACT.identity.resourceIdAuthority, 'ngvge:resource:*');
});
check('TileSet rejects backend texture identity', () => assert.strictEqual(TILESET_CONTRACT.identity.backendTextureHandlePersistent, false));
check('TileSet texture binding is ResourceId-only', () => assert.strictEqual(TILESET_CONTRACT.textureBinding.authority, 'ResourceId'));
check('TileSet does not own image bytes', () => assert.strictEqual(TILESET_CONTRACT.textureBinding.imageBytesEmbeddedInTileSet, false));
check('TileMap native authoring is Sparse Chunk', () => assert.strictEqual(TILEMAP_LAYER2D_CONTRACT.persistence.authoringSource, 'sparse-chunks'));
check('Scratch List authoring authority is forbidden', () => assert.strictEqual(TILEMAP_LAYER2D_CONTRACT.persistence.scratchListAuthoringSourceForbidden, true));
check('TileMap owns only a TileSet ResourceId binding', () => assert.strictEqual(TILEMAP_LAYER2D_CONTRACT.resourceBinding.resourceContentOwnedByNode, false));
check('TileMapLayer2D has a stable native component id', () => assert.strictEqual(TILEMAP_LAYER2D_TYPE_ID, 'ngvge.tilemap-layer2d'));
check('TileMapLayer2D has graduated as a Functional Node archetype', () => {
    const ids = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: true}).map(item => item.id);
    assert(ids.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D));
    assert(ids.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D));
});
check('TileMap creation provisions Transform2D + TileMapLayer2D', () => {
    const plan = createFunctionalNodeCreationPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D, {scratchCompatibilityAvailable: false});
    assert.deepStrictEqual(plan.options.components.map(item => item.typeId), ['ngvge.transform2d', TILEMAP_LAYER2D_TYPE_ID]);
});
check('Negative coordinates enter negative chunks', () => {
    const layer = setTileMapCell({}, -1, -1, {tileId: 1});
    assert.strictEqual(layer.chunks[0].chunkX, -1);
    assert.strictEqual(layer.chunks[0].chunkY, -1);
});
check('TileSet Runtime capability is explicit', () => assert.strictEqual(TILESET_RESOURCE_CAPABILITY_ID, 'ngvge.tileset-resource-runtime'));
check('TileMap Runtime capability is explicit', () => assert.strictEqual(TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID, 'ngvge.tilemap-layer2d-runtime'));
check('Core editor tools include paint, fill, select, random variant and terrain', () => {
    ['pencil', 'eraser', 'picker', 'rectangle', 'line', 'flood-fill', 'select', 'paste', 'random-variant', 'terrain']
        .forEach(value => assert(Object.values(TILEMAP_AUTHORING_TOOLS).includes(value)));
});
check('Tile collision is projected into the shared Collider Runtime', () => {
    const source = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
    assert(source.includes('registerExternalColliderProvider'));
    assert(source.includes("sourceKind: 'tilemap'"));
});
check('TileMap exposes navigation projection foundation', () => assert(read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js').includes('listNavigationProjections')));
check('Stage contains passive TileMap runtime rendering', () => {
    const stage = read('src/components/stage/stage.jsx');
    assert(stage.includes('TileMap2DRenderer'));
    assert(read('src/components/stage/tilemap2d-renderer.jsx').includes('data-ngvge-tilemap-runtime-renderer'));
});
check('Stage contains direct TileMap authoring overlay', () => assert(read('src/components/stage/tilemap2d-editor.jsx').includes('data-ngvge-tilemap-editor')));
check('TileMap authoring commits through the command capability', () => {
    const source = read('src/components/stage/tilemap2d-editor.jsx');
    assert(source.includes('createTileMapLayer2DEditorClient'));
    assert(source.includes('patchComponent'));
});
check('Inspector exposes TileMap and TileSet authoring', () => {
    const source = read('src/components/project-inspector/project-inspector.jsx');
    assert(source.includes('TileMapLayer2D'));
    assert(source.includes('TileSet Resource'));
    assert(source.includes('Custom Data JSON'));
});
check('Tile collision debug reuses the existing Collider2D Gizmo', () => {
    const source = read('src/components/stage/collider2d-gizmo.jsx');
    assert(source.includes("sourceKind !== 'tilemap'"));
});
check('SB3 compatibility remains bake/partial rather than native', () => {
    assert.strictEqual(TILEMAP_LAYER2D_CONTRACT.persistence.scratchProjection, 'bake');
    assert.strictEqual(TILESET_CONTRACT.persistence.scratchProjection, 'bake-or-partial');
});
check('Architecture document forbids Scratch List source authority', () => assert(read('docs/architecture/WS-10N7-TILESET-TILEMAPLAYER2D.md').includes('Scratch List')));
check('Browser Evidence is frozen after user-confirmed verification', () => {
    const verification = read('docs/validation/WS-10N7-TILESET-TILEMAPLAYER2D-VERIFICATION.md');
    assert(verification.includes('BROWSER VERIFIED'));
    assert(verification.includes('USER-CONFIRMED PASS'));
});
check('Full physics backend is not claimed in N7', () => assert(read('docs/architecture/WS-10N7-TILESET-TILEMAPLAYER2D.md').includes('no Rapier2D/Box2D identity')));

console.log(`WS-10N7 TileSet Resource + TileMapLayer2D Conformance PASS (${checks.length}/${checks.length}).`);
