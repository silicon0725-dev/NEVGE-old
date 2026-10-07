/* eslint-disable import/no-commonjs, strict */
'use strict';

const {AUTHORITY_MODES, createAuthorityRegistry} = require('../../core/authority');

const COLLABORATION_SEMANTIC_DOMAIN_ID = 'ngvge.collaboration.semantic';
const COLLABORATION_SEMANTIC_AUTHORITY_ID = 'authority:ngvge.collaboration-semantic-host';
const COLLABORATION_SEMANTIC_AUTHORITY_REGISTRATION = Object.freeze({
    authorityId: COLLABORATION_SEMANTIC_AUTHORITY_ID,
    domain: COLLABORATION_SEMANTIC_DOMAIN_ID,
    mode: AUTHORITY_MODES.WRITER
});

const createCollaborationSemanticAuthorityRegistry = () => createAuthorityRegistry([
    COLLABORATION_SEMANTIC_AUTHORITY_REGISTRATION
]);

module.exports = {
    COLLABORATION_SEMANTIC_AUTHORITY_ID,
    COLLABORATION_SEMANTIC_AUTHORITY_REGISTRATION,
    COLLABORATION_SEMANTIC_DOMAIN_ID,
    createCollaborationSemanticAuthorityRegistry
};
