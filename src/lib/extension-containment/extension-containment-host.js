/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    EXTENSION_CONTAINMENT_VERSION,
    EXTENSION_HOST_KINDS
} = require('./constants');
const {
    EXTENSION_CONTAINMENT_DOMAIN_ID,
    createExtensionContainmentAuthorityRegistry
} = require('./extension-containment-authority');
const {normalizeExtensionDescriptor} = require('./extension-descriptor');

const EXTENSION_CONTAINMENT_HOST_ID = 'ngvge.extension-containment-host@1';
const EXTENSION_CONTAINMENT_CLIENT_ID = 'ngvge.extension-containment-client@1';
const EXTENSION_CONTAINMENT_RUNTIME_PROPERTY = 'ngvgeExtensionContainment';
const controllersByVM = new WeakMap();

const cloneDiagnostic = diagnostic => Object.freeze(Object.assign({}, diagnostic));

const createExtensionContainmentHost = vm => {
    if (!vm || typeof vm !== 'object') {
        throw new TypeError('Extension Containment Host requires a VM object.');
    }
    const authorityRegistry = createExtensionContainmentAuthorityRegistry();
    const descriptors = new Map();
    const hosts = new Map();
    const diagnostics = [];
    let revision = 0;

    const listHosts = () => Object.freeze(Array.from(hosts.values())
        .map(host => Object.freeze(Object.assign({}, host)))
        .sort((a, b) => a.hostKind.localeCompare(b.hostKind)));
    const listDescriptors = hostKind => Object.freeze(Array.from(descriptors.values())
        .filter(descriptor => !hostKind || descriptor.hostKind === hostKind)
        .sort((a, b) => a.descriptorId.localeCompare(b.descriptorId)));

    const client = Object.freeze({
        clientId: EXTENSION_CONTAINMENT_CLIENT_ID,
        getAuthority: () => authorityRegistry.getWriter(EXTENSION_CONTAINMENT_DOMAIN_ID),
        getDescriptor: descriptorId => descriptors.get(String(descriptorId)) || null,
        getRevision: () => revision,
        hostId: EXTENSION_CONTAINMENT_HOST_ID,
        listDescriptors,
        listDiagnostics: () => Object.freeze(diagnostics.map(cloneDiagnostic)),
        listHosts,
        version: EXTENSION_CONTAINMENT_VERSION
    });

    const controller = {
        client,
        recordDiagnostic (diagnostic) {
            const normalized = Object.freeze({
                code: diagnostic && typeof diagnostic.code === 'string' ? diagnostic.code : 'LEX_DIAGNOSTIC',
                descriptorId: diagnostic && typeof diagnostic.descriptorId === 'string' ? diagnostic.descriptorId : null,
                detail: diagnostic && typeof diagnostic.detail === 'string' ? diagnostic.detail : '',
                hostKind: diagnostic && Object.values(EXTENSION_HOST_KINDS).includes(diagnostic.hostKind) ?
                    diagnostic.hostKind : null,
                severity: diagnostic && typeof diagnostic.severity === 'string' ? diagnostic.severity : 'info',
                timestamp: Date.now()
            });
            diagnostics.push(normalized);
            if (diagnostics.length > 500) diagnostics.shift();
            revision += 1;
            return normalized;
        },
        registerHost (definition) {
            if (!definition || !Object.values(EXTENSION_HOST_KINDS).includes(definition.hostKind)) {
                throw new TypeError('Extension host registration requires a valid hostKind.');
            }
            if (typeof definition.hostId !== 'string' || !definition.hostId.trim()) {
                throw new TypeError('Extension host registration requires a non-empty hostId.');
            }
            const current = hosts.get(definition.hostKind);
            if (current && current.hostId !== definition.hostId) {
                const error = new Error(`Extension host kind "${definition.hostKind}" already has host "${current.hostId}".`);
                error.code = 'LEX_HOST_KIND_WRITER_CONFLICT';
                throw error;
            }
            if (current) return current;
            const record = Object.freeze({hostId: definition.hostId.trim(), hostKind: definition.hostKind});
            hosts.set(record.hostKind, record);
            revision += 1;
            return record;
        },
        removeDescriptor (descriptorId) {
            const removed = descriptors.delete(String(descriptorId));
            if (removed) revision += 1;
            return removed;
        },
        upsertDescriptor (descriptor) {
            const normalized = normalizeExtensionDescriptor(descriptor);
            if (!hosts.has(normalized.hostKind)) {
                const error = new Error(`Extension host kind "${normalized.hostKind}" is not registered.`);
                error.code = 'LEX_HOST_NOT_REGISTERED';
                throw error;
            }
            descriptors.set(normalized.descriptorId, normalized);
            revision += 1;
            return normalized;
        }
    };
    return controller;
};

const installExtensionContainmentHost = vm => {
    let controller = controllersByVM.get(vm);
    if (!controller) {
        controller = createExtensionContainmentHost(vm);
        controllersByVM.set(vm, controller);
        if (vm.runtime && !Object.prototype.hasOwnProperty.call(vm.runtime, EXTENSION_CONTAINMENT_RUNTIME_PROPERTY)) {
            Object.defineProperty(vm.runtime, EXTENSION_CONTAINMENT_RUNTIME_PROPERTY, {
                configurable: false,
                enumerable: false,
                value: controller.client,
                writable: false
            });
        }
    }
    return controller.client;
};

const getExtensionContainmentController = vm => {
    installExtensionContainmentHost(vm);
    return controllersByVM.get(vm);
};

module.exports = {
    EXTENSION_CONTAINMENT_CLIENT_ID,
    EXTENSION_CONTAINMENT_HOST_ID,
    EXTENSION_CONTAINMENT_RUNTIME_PROPERTY,
    createExtensionContainmentHost,
    getExtensionContainmentController,
    installExtensionContainmentHost
};
