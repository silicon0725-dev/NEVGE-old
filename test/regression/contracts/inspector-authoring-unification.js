'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.resolve(__dirname, '../../..', relative), 'utf8');

const assertInspectorAuthoringUnificationContract = () => {
    const inspector = read('src/components/project-inspector/project-inspector.jsx');
    const reducer = read('src/reducers/project-inspector.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const preferences = read('src/lib/editor-visualization/collider-gizmo-preferences.js');

    assert.match(inspector, /createTransform2DEditorClient/);
    assert.match(inspector, /runtime-node:scratch-appearance/);
    assert.match(inspector, /Sprite Appearance/);
    assert.match(inspector, /COLLIDER2D_SHAPE_TYPES\.CONVEX_POLYGON/);
    assert.match(inspector, /COLLIDER_GIZMO_VISIBILITY\.HIDDEN/);
    assert.match(reducer, /runtime-node:transform/);
    assert.match(reducer, /runtime-node:collider2d/);
    assert.match(gizmo, /gizmoPreferences\.shouldShow/);
    assert.match(preferences, /WeakMap/);
    assert.doesNotMatch(preferences, /PatchCollider2D|exportState|serialize/);

    return {
        colliderGizmoEditorOnly: true,
        colliderShapeInspectorAuthoring: true,
        runtimeSectionsDefaultVisible: true,
        scratchAppearanceExplicitCompatibility: true,
        transformSemanticCommandPathPreserved: true
    };
};

module.exports = {assertInspectorAuthoringUnificationContract};
