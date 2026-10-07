import {clonePersistentDTO} from '../../core/persistent';
import {createStableNodeId} from '../identity/host-stable-id-factory';
import {migrateLegacyTargetDerivedNodeIdsInProjectSections} from '../project-nodes/legacy-node-identity-migration';
import {installProjectLifecycleHost} from '../project-lifecycle';
import {getInspectorRegistry} from './inspector-registry';

const NGVGE_DATA_KEY = 'ngvge';
const NGVGE_DATA_VERSION = 1;
const PERSISTENCE_PROPERTY = 'ngvgeProjectPersistence';
const LIFECYCLE_HOOK_ID = 'ngvge.project-lifecycle.project-persistence@1';

const cloneSerializable = value => {
    if (value === null || typeof value === 'undefined') return value;
    return clonePersistentDTO(value);
};

const hasSerializableValue = value => value !== null && typeof value !== 'undefined';

const getOriginalTargets = runtime => (
    runtime && Array.isArray(runtime.targets) ?
        runtime.targets.filter(target => target && target.isOriginal) : []
);

const getSectionContext = (vm, registry, phase, archive = null) => ({
    archive,
    phase,
    registry,
    runtime: vm.runtime,
    vm
});

const getExtensionURLMap = runtime => {
    const extensionManager = runtime && runtime.extensionManager;
    if (!extensionManager || typeof extensionManager.getExtensionURLs !== 'function') return {};
    return extensionManager.getExtensionURLs() || {};
};

const addRequiredExtensions = (projectJSON, requiredExtensionIds, runtime) => {
    if (!requiredExtensionIds.size) return;
    const existingExtensions = Array.isArray(projectJSON.extensions) ? projectJSON.extensions : [];
    projectJSON.extensions = Array.from(new Set(existingExtensions.concat(Array.from(requiredExtensionIds))));

    const extensionURLs = getExtensionURLMap(runtime);
    requiredExtensionIds.forEach(extensionId => {
        if (!extensionURLs[extensionId]) return;
        if (!projectJSON.extensionURLs) projectJSON.extensionURLs = {};
        projectJSON.extensionURLs[extensionId] = extensionURLs[extensionId];
    });
};

const serializeProjectData = (vm, registry) => {
    const projectSections = {};
    const requiredExtensionIds = new Set();
    const context = getSectionContext(vm, registry, 'serialize');

    registry.listSections().forEach(section => {
        if (typeof section.serializeProject !== 'function') return;
        try {
            const value = section.serializeProject(context);
            if (!hasSerializableValue(value)) return;
            projectSections[section.id] = cloneSerializable(value);
            if (section.extensionId) requiredExtensionIds.add(section.extensionId);
        } catch {
            // A third-party inspector section should not prevent the project from saving.
        }
    });

    return {projectSections, requiredExtensionIds};
};

const serializeTargetData = (target, vm, registry) => {
    const sections = {};
    const requiredExtensionIds = new Set();
    const context = getSectionContext(vm, registry, 'serialize');

    registry.getSections(target, context).forEach(section => {
        if (typeof section.serializeTarget !== 'function') return;
        try {
            const value = section.serializeTarget(target, context);
            if (!hasSerializableValue(value)) return;
            sections[section.id] = cloneSerializable(value);
            if (section.extensionId) requiredExtensionIds.add(section.extensionId);
        } catch {
            // A third-party inspector section should not prevent the project from saving.
        }
    });

    if (!Object.keys(sections).length) return {data: null, requiredExtensionIds};
    return {
        data: {
            sections,
            version: NGVGE_DATA_VERSION
        },
        requiredExtensionIds
    };
};

const injectProjectData = (projectJSON, vm, registry, targetId) => {
    if (!projectJSON || typeof projectJSON !== 'object') return projectJSON;
    const requiredExtensionIds = new Set();
    const originalTargets = getOriginalTargets(vm.runtime);

    if (targetId) {
        const target = vm.runtime.getTargetById(targetId);
        if (target) {
            const serialized = serializeTargetData(target, vm, registry);
            if (serialized.data) projectJSON[NGVGE_DATA_KEY] = serialized.data;
            serialized.requiredExtensionIds.forEach(id => requiredExtensionIds.add(id));
        }
    } else {
        const projectData = serializeProjectData(vm, registry);
        projectData.requiredExtensionIds.forEach(id => requiredExtensionIds.add(id));
        if (Object.keys(projectData.projectSections).length) {
            projectJSON[NGVGE_DATA_KEY] = {
                projectSections: projectData.projectSections,
                version: NGVGE_DATA_VERSION
            };
        }

        if (Array.isArray(projectJSON.targets)) {
            projectJSON.targets.forEach((serializedTarget, index) => {
                const target = originalTargets[index];
                if (!target || !serializedTarget) return;
                const serialized = serializeTargetData(target, vm, registry);
                if (serialized.data) serializedTarget[NGVGE_DATA_KEY] = serialized.data;
                serialized.requiredExtensionIds.forEach(id => requiredExtensionIds.add(id));
            });
        }
    }

    addRequiredExtensions(projectJSON, requiredExtensionIds, vm.runtime);
    return projectJSON;
};

const extractProjectData = projectJSON => {
    if (!projectJSON || typeof projectJSON !== 'object') return null;

    const rawProjectData = projectJSON[NGVGE_DATA_KEY];
    const projectData = rawProjectData ? cloneSerializable(rawProjectData) : null;
    if (projectData && projectData.projectSections && typeof projectData.projectSections === 'object') {
        const migration = migrateLegacyTargetDerivedNodeIdsInProjectSections(
            projectData.projectSections,
            createStableNodeId
        );
        projectData.projectSections = migration.data;
    }
    const targetData = Array.isArray(projectJSON.targets) ?
        projectJSON.targets.map(target => (
            target && target[NGVGE_DATA_KEY] ? cloneSerializable(target[NGVGE_DATA_KEY]) : null
        )) : [projectData ? cloneSerializable(projectData) : null];

    if (!projectData && !targetData.some(Boolean)) return null;
    return {
        projectData: projectData ? cloneSerializable(projectData) : null,
        targetData
    };
};

const createProjectPersistence = (vm, registry = getInspectorRegistry(vm.runtime)) => {
    let pendingSnapshot = null;
    let unsubscribeRegistry = null;
    let unsubscribeLifecycle = null;
    const pendingDeserializeSnapshots = new Map();
    const lifecycle = installProjectLifecycleHost(vm);

    const applyPending = () => {
        if (!pendingSnapshot) return false;
        const context = getSectionContext(
            vm,
            registry,
            'deserialize',
            pendingSnapshot.archive || null
        );
        const availableSections = new Map(registry.listSections().map(section => [section.id, section]));
        let appliedAny = false;

        const projectSections = pendingSnapshot.projectData && pendingSnapshot.projectData.projectSections;
        const normalizedProjectSections = projectSections && typeof projectSections === 'object' ?
            projectSections : {};
        Object.keys(normalizedProjectSections).forEach(sectionId => {
            if (pendingSnapshot.appliedProjectSections.has(sectionId)) return;
            const section = availableSections.get(sectionId);
            if (!section || typeof section.deserializeProject !== 'function') return;
            try {
                section.deserializeProject(cloneSerializable(normalizedProjectSections[sectionId]), context);
                pendingSnapshot.appliedProjectSections.add(sectionId);
                appliedAny = true;
            } catch {
                pendingSnapshot.appliedProjectSections.add(sectionId);
            }
        });

        // Some editor-owned sections represent scene-local state. If an imported
        // project intentionally omits such a section, retaining the previous
        // in-memory value would leak data from the previously loaded scene.
        availableSections.forEach((section, sectionId) => {
            if (!section || section.clearOnMissing !== true ||
                pendingSnapshot.appliedProjectSections.has(sectionId) ||
                Object.prototype.hasOwnProperty.call(normalizedProjectSections, sectionId)) return;
            try {
                if (typeof section.resetProject === 'function') {
                    section.resetProject(context);
                } else if (typeof section.deserializeProject === 'function') {
                    section.deserializeProject(null, context);
                } else {
                    return;
                }
                pendingSnapshot.appliedProjectSections.add(sectionId);
                appliedAny = true;
            } catch {
                pendingSnapshot.appliedProjectSections.add(sectionId);
            }
        });

        const originalTargets = getOriginalTargets(vm.runtime);
        pendingSnapshot.targetData.forEach((targetSnapshot, targetIndex) => {
            if (!targetSnapshot || !targetSnapshot.sections) return;
            const target = originalTargets[targetIndex];
            if (!target) return;
            Object.keys(targetSnapshot.sections).forEach(sectionId => {
                const applicationKey = `${targetIndex}:${sectionId}`;
                if (pendingSnapshot.appliedTargetSections.has(applicationKey)) return;
                const section = availableSections.get(sectionId);
                if (!section || typeof section.deserializeTarget !== 'function') return;
                try {
                    section.deserializeTarget(
                        target,
                        cloneSerializable(targetSnapshot.sections[sectionId]),
                        context
                    );
                    pendingSnapshot.appliedTargetSections.add(applicationKey);
                    appliedAny = true;
                } catch {
                    pendingSnapshot.appliedTargetSections.add(applicationKey);
                }
            });
        });

        if (appliedAny) {
            if (typeof vm.emitTargetsUpdate === 'function') vm.emitTargetsUpdate(false);
            registry.notify({type: 'persistence:restore'});
        }
        return appliedAny;
    };

    const queueSnapshot = (snapshot, applyImmediately = true, archive = null) => {
        if (!snapshot) {
            pendingSnapshot = null;
            return;
        }
        pendingSnapshot = Object.assign(snapshot, {
            archive,
            appliedProjectSections: new Set(),
            appliedTargetSections: new Set()
        });
        if (applyImmediately) applyPending();
    };

    if (lifecycle) {
        unsubscribeLifecycle = lifecycle.registerHook({
            id: LIFECYCLE_HOOK_ID,
            priority: 100,
            afterSerializeProjectJSON: (context, serialized) => {
                if (typeof serialized !== 'string') return serialized;
                try {
                    const projectJSON = JSON.parse(serialized);
                    injectProjectData(projectJSON, vm, registry, context.args[0]);
                    return JSON.stringify(projectJSON);
                } catch {
                    return serialized;
                }
            },
            beforeDeserialize: context => {
                const projectJSON = context.args[0];
                const archive = context.args[1] || null;
                const snapshot = extractProjectData(projectJSON) || {
                    projectData: null,
                    targetData: Array.isArray(projectJSON && projectJSON.targets) ?
                        projectJSON.targets.map(() => null) : []
                };
                pendingDeserializeSnapshots.set(context.operationId, {archive, snapshot});
            },
            afterDeserialize: context => {
                const pending = pendingDeserializeSnapshots.get(context.operationId);
                pendingDeserializeSnapshots.delete(context.operationId);
                if (!pending) return;
                queueSnapshot(pending.snapshot, context.rootKind !== 'load', pending.archive);
            },
            deserializeError: context => {
                pendingDeserializeSnapshots.delete(context.operationId);
            },
            afterLoad: () => applyPending(),
            loadError: () => {
                pendingSnapshot = null;
                pendingDeserializeSnapshots.clear();
            }
        });
    }

    unsubscribeRegistry = registry.subscribe(change => {
        const active = lifecycle ? lifecycle.getState().activeOperation : null;
        const isProjectLoadActive = active && active.rootKind === 'load';
        if (!isProjectLoadActive && change && change.type === 'registry') applyPending();
    });

    return {
        version: 1,
        applyPending,
        dispose () {
            if (unsubscribeRegistry) unsubscribeRegistry();
            if (unsubscribeLifecycle) unsubscribeLifecycle();
            unsubscribeRegistry = null;
            unsubscribeLifecycle = null;
            pendingDeserializeSnapshots.clear();
        },
        getPendingSnapshot: () => pendingSnapshot,
        injectProjectData: (projectJSON, targetId) => injectProjectData(projectJSON, vm, registry, targetId),
        queueSnapshot
    };
};

const installProjectPersistence = vm => {
    if (!vm || !vm.runtime) return null;
    const current = vm[PERSISTENCE_PROPERTY];
    if (current && current.version === 1) return current;
    const persistence = createProjectPersistence(vm);
    vm[PERSISTENCE_PROPERTY] = persistence;
    return persistence;
};

export {
    NGVGE_DATA_KEY,
    NGVGE_DATA_VERSION,
    PERSISTENCE_PROPERTY,
    addRequiredExtensions,
    createProjectPersistence,
    extractProjectData,
    injectProjectData,
    installProjectPersistence,
    serializeProjectData,
    serializeTargetData
};
