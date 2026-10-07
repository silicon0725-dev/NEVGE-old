/* eslint-disable import/no-commonjs, strict */
'use strict';

const {createCompatibilityAnalyzer} = require('./compatibility-analyzer');
const {createScratchBackendCapabilitySnapshot} = require('./compatibility-backend-scan');
const {createScratchProjectCompatibilitySnapshot} = require('./compatibility-project-scan');
const {getLegacyRuntimeSettingsCompatibilityService} = require('./legacy-runtime-settings-compatibility');
const {getRuntimePolicyClient} = require('./runtime-policy-runtime-integration');

const RUNTIME_COMPATIBILITY_SERVICE_ID = 'ngvge.runtime-compatibility-service@1';
const RUNTIME_COMPATIBILITY_PROPERTY = 'ngvgeRuntimeCompatibilityService';
const servicesByRuntime = new WeakMap();

const getLegacySnapshot = runtime => {
    const service = getLegacyRuntimeSettingsCompatibilityService(runtime);
    if (!service) return null;
    return Object.freeze({
        diagnostics: service.getDiagnostics(),
        migrationRecords: service.getMigrationRecords(),
        precedenceSnapshot: service.getPrecedenceSnapshot()
    });
};

const createRuntimeCompatibilityService = (vm, options = {}) => {
    if (!vm || !vm.runtime) throw new TypeError('Runtime compatibility service requires a Scratch VM runtime.');
    const runtimePolicy = getRuntimePolicyClient(vm.runtime);
    if (!runtimePolicy) throw new Error('Runtime Policy service must be installed before Compatibility Analyzer.');
    const analyzer = options.analyzer || createCompatibilityAnalyzer(options);
    const extensionDescriptors = Array.isArray(options.extensionDescriptors) ?
        options.extensionDescriptors.slice() :
        [];

    const buildInput = policy => Object.freeze({
        backend: createScratchBackendCapabilitySnapshot(vm),
        legacy: getLegacySnapshot(vm.runtime),
        policy,
        project: createScratchProjectCompatibilitySnapshot(vm, {extensionDescriptors})
    });

    return Object.freeze({
        analyzerId: analyzer.id,
        analyzeCurrent: () => analyzer.analyze(buildInput(runtimePolicy.getSnapshot())),
        id: RUNTIME_COMPATIBILITY_SERVICE_ID,
        previewPolicy: policy => analyzer.analyze(buildInput(policy)),
        scanBackend: () => createScratchBackendCapabilitySnapshot(vm),
        scanProject: () => createScratchProjectCompatibilitySnapshot(vm, {extensionDescriptors})
    });
};

const installRuntimeCompatibilityService = (vm, options = {}) => {
    if (!vm || !vm.runtime) return null;
    const current = servicesByRuntime.get(vm.runtime) || vm.runtime[RUNTIME_COMPATIBILITY_PROPERTY];
    if (current && current.id === RUNTIME_COMPATIBILITY_SERVICE_ID) return current;
    const service = createRuntimeCompatibilityService(vm, options);
    servicesByRuntime.set(vm.runtime, service);
    if (!Object.prototype.hasOwnProperty.call(vm.runtime, RUNTIME_COMPATIBILITY_PROPERTY)) {
        Object.defineProperty(vm.runtime, RUNTIME_COMPATIBILITY_PROPERTY, {
            configurable: false,
            enumerable: false,
            value: service,
            writable: false
        });
    }
    return service;
};

const getRuntimeCompatibilityService = runtime => (
    runtime ? servicesByRuntime.get(runtime) || runtime[RUNTIME_COMPATIBILITY_PROPERTY] || null : null
);

module.exports = {
    RUNTIME_COMPATIBILITY_PROPERTY,
    RUNTIME_COMPATIBILITY_SERVICE_ID,
    createRuntimeCompatibilityService,
    getRuntimeCompatibilityService,
    installRuntimeCompatibilityService
};
