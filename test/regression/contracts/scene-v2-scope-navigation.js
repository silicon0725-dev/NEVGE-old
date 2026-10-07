'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const readSource = relativePath => fs.readFileSync(path.join(__dirname, '..', '..', '..', relativePath), 'utf8');

const assertSceneV2ScopeNavigationContract = async () => {
    const explorerSource = readSource('src/components/project-explorer/project-explorer.jsx');
    const selectorSource = readSource('src/components/scene-selector/scene-selector.jsx');
    const controllerSource = readSource('src/lib/scene-system/scene-controller.js');
    const serializerSource = readSource('src/lib/scene-system/scene-snapshot-serializer.js');
    const projectionSource = readSource('src/lib/project-explorer/scene-snapshot-projection.js');

    assert(
        explorerSource.includes('getSceneSnapshotProjection'),
        'Project Explorer must project inactive Scene snapshots instead of hiding scene-local editor nodes.'
    );
    assert(
        explorerSource.includes("controller.execute('enter'"),
        'Project Explorer scene navigation must use the explicit Enter Scene controller command.'
    );
    assert(
        explorerSource.includes("enterSceneLabel={nodeContextMenu.enterSceneId === activeSceneId ? 'Current Scene' : 'Enter Scene'}"),
        'Scene root context menus must expose Enter Scene as an explicit navigation action.'
    );
    assert.strictEqual(
        explorerSource.includes('runtimeNodeModel.getChildren(parentId)'),
        false,
        'Project Explorer must not perform one Runtime capability getChildren() call per rendered node.'
    );
    assert(
        controllerSource.includes("case 'enter':") && controllerSource.includes("case 'load':"),
        'Scene Controller must keep enter as the semantic navigation command while preserving load compatibility.'
    );
    assert(
        serializerSource.includes('editorProjection: createSceneEditorProjection(projectJSON)'),
        'Scene snapshots must persist a lightweight editor projection for inactive-scene tree rendering.'
    );
    assert(
        projectionSource.includes("source = 'metadata'") && projectionSource.includes("source = 'payload'"),
        'Inactive-scene projection must prefer metadata and retain a fallback for older V2 snapshots.'
    );
    assert(
        selectorSource.includes('externalBusyRefreshTimerRef') && selectorSource.includes('refreshView();'),
        'SceneSelector must recover from externally-started navigation rather than retaining stale busy state.'
    );

    return {
        enterSceneContextAction: true,
        inactiveSceneProjection: true,
        metadataProjectionFastPath: true,
        runtimeChildrenLocalIndex: true,
        selectorExternalBusyRecovery: true
    };
};

module.exports = {
    assertSceneV2ScopeNavigationContract
};
