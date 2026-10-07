/* eslint-disable import/no-commonjs, strict */
'use strict';

const {createSchemaRegistry, SCHEMA_PROPERTY_PERSISTENCE} = require('../../core/schema');
const {RUNTIME_POLICY_SET_SCHEMA_VERSION, RUNTIME_POLICY_SET_TYPE_ID} = require('./constants');

const objectProperty = persistence => Object.freeze({
    persistence,
    type: 'object'
});

const RUNTIME_POLICY_SET_SCHEMA = Object.freeze({
    properties: Object.freeze({
        schemaVersion: Object.freeze({persistence: SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT, type: 'number'}),
        profileId: Object.freeze({persistence: SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT, type: 'string'}),
        execution: objectProperty(SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT),
        presentation: objectProperty(SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT),
        safety: objectProperty(SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT),
        scratchCompatibility: objectProperty(SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT),
        executionBackend: objectProperty(SCHEMA_PROPERTY_PERSISTENCE.RUNTIME_ONLY),
        backendHints: objectProperty(SCHEMA_PROPERTY_PERSISTENCE.RUNTIME_ONLY)
    }),
    typeId: RUNTIME_POLICY_SET_TYPE_ID,
    version: RUNTIME_POLICY_SET_SCHEMA_VERSION
});

const createRuntimePolicySchemaRegistry = () => createSchemaRegistry([RUNTIME_POLICY_SET_SCHEMA]);

module.exports = {
    RUNTIME_POLICY_SET_SCHEMA,
    createRuntimePolicySchemaRegistry
};
