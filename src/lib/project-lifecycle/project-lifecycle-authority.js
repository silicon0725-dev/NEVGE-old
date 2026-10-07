/* eslint-disable import/no-commonjs, strict */
'use strict';

const {AUTHORITY_MODES, createAuthorityRegistry} = require('../../core/authority');

const PROJECT_LIFECYCLE_DOMAIN_ID = 'ngvge.project.lifecycle';
const PROJECT_LIFECYCLE_AUTHORITY_ID = 'authority:ngvge.project-lifecycle-host';
const PROJECT_LIFECYCLE_AUTHORITY_REGISTRATION = Object.freeze({
    authorityId: PROJECT_LIFECYCLE_AUTHORITY_ID,
    domain: PROJECT_LIFECYCLE_DOMAIN_ID,
    mode: AUTHORITY_MODES.WRITER
});

const createProjectLifecycleAuthorityRegistry = () => createAuthorityRegistry([
    PROJECT_LIFECYCLE_AUTHORITY_REGISTRATION
]);

module.exports = {
    PROJECT_LIFECYCLE_AUTHORITY_ID,
    PROJECT_LIFECYCLE_AUTHORITY_REGISTRATION,
    PROJECT_LIFECYCLE_DOMAIN_ID,
    createProjectLifecycleAuthorityRegistry
};
