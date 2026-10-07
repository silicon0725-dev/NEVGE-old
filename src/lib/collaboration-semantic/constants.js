/* eslint-disable import/no-commonjs, strict */
'use strict';

const COLLABORATION_SEMANTIC_VERSION = 1;
const COLLABORATION_SEMANTIC_HOST_ID = 'ngvge.collaboration-semantic-host@1';
const COLLABORATION_SEMANTIC_CLIENT_ID = 'ngvge.collaboration-semantic-client@1';
const COLLABORATION_SEMANTIC_RUNTIME_PROPERTY = 'ngvgeCollaborationSemantic';
const COLLABORATION_OPERATION_SCHEMA = 'ngvge.collaboration-operation/v1';

const COLLABORATION_OPERATION_TYPES = Object.freeze({
    EXTENSION_LOAD: 'ExtensionLoad',
    EXTENSION_REORDER: 'ExtensionReorder',
    EXTENSION_UNLOAD: 'ExtensionUnload',
    NODE_DESTROY: 'NodeDestroy',
    NODE_RENAME: 'NodeRename',
    NODE_TRANSFORM_PATCH: 'NodeTransformPatch'
});

const COLLABORATION_OPERATION_ORIGINS = Object.freeze({
    LEGACY_WIRE: 'legacy-wire',
    LOCAL: 'local',
    REMOTE: 'remote'
});

module.exports = {
    COLLABORATION_OPERATION_ORIGINS,
    COLLABORATION_OPERATION_SCHEMA,
    COLLABORATION_OPERATION_TYPES,
    COLLABORATION_SEMANTIC_CLIENT_ID,
    COLLABORATION_SEMANTIC_HOST_ID,
    COLLABORATION_SEMANTIC_RUNTIME_PROPERTY,
    COLLABORATION_SEMANTIC_VERSION
};
