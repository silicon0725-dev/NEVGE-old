/* eslint-disable import/no-commonjs, strict */
'use strict';

let implementation = null;

const registerLegacyAddonDomBridge = bridge => {
    if (!bridge || typeof bridge.refreshAfterDomRemount !== 'function') {
        throw new TypeError('Legacy Addon DOM bridge must expose refreshAfterDomRemount().');
    }
    implementation = bridge;
    return () => {
        if (implementation === bridge) implementation = null;
    };
};

const refreshLegacyAddonDomAfterRemount = () => {
    if (!implementation) return false;
    implementation.refreshAfterDomRemount();
    return true;
};

const hasLegacyAddonDomBridge = () => Boolean(implementation);

module.exports = {
    hasLegacyAddonDomBridge,
    refreshLegacyAddonDomAfterRemount,
    registerLegacyAddonDomBridge
};
