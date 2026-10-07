/* eslint-disable import/no-commonjs, strict */
'use strict';

const {AUTHORITY_MODES, createAuthorityRegistry} = require('../../core/authority');

const EXTENSION_CONTAINMENT_DOMAIN_ID = 'ngvge.extension.containment';
const EXTENSION_CONTAINMENT_AUTHORITY_ID = 'authority:ngvge.extension-containment-host';
const EXTENSION_CONTAINMENT_AUTHORITY_REGISTRATION = Object.freeze({
    authorityId: EXTENSION_CONTAINMENT_AUTHORITY_ID,
    domain: EXTENSION_CONTAINMENT_DOMAIN_ID,
    mode: AUTHORITY_MODES.WRITER
});

const createExtensionContainmentAuthorityRegistry = () => createAuthorityRegistry([
    EXTENSION_CONTAINMENT_AUTHORITY_REGISTRATION
]);

module.exports = {
    EXTENSION_CONTAINMENT_AUTHORITY_ID,
    EXTENSION_CONTAINMENT_AUTHORITY_REGISTRATION,
    EXTENSION_CONTAINMENT_DOMAIN_ID,
    createExtensionContainmentAuthorityRegistry
};
