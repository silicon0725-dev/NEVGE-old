const {validatePersistentData} = require('../persistence/persistent-data');
const {SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID} = require('./constants');
const {RUNTIME_NODE_EXTENSION_DATA_KEY} = require('../runtime-nodes/runtime-node-model-service');
const {
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
} = require('../scratch-sprite-adapter/constants');
const {cloneSerializable} = require('./scene-data-model');

const RUNTIME_NODE_ONLY_FIELDS = Object.freeze([
    'activeInHierarchy',
    'childIds',
    'enabledSelf',
    'family',
    'protected',
    'ready',
    'state'
]);
const RUNTIME_COMPONENT_ONLY_FIELDS = Object.freeze([
    'activeInHierarchy',
    'ownerId',
    'ready',
    'state'
]);
const SCRATCH_BINDING_RUNTIME_ONLY_FIELDS = Object.freeze([
    'lifecycle',
    'targetRuntimeId'
]);

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const addIssue = (issues, code, path, message, details = {}) => {
    issues.push(Object.assign({code, message, path}, details));
};

const auditRuntimeNodeState = (state, issues) => {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return;
    const nodes = Array.isArray(state.nodes) ? state.nodes : [];
    nodes.forEach((node, nodeIndex) => {
        if (!node || typeof node !== 'object' || Array.isArray(node)) return;
        const nodePath = `$.extensionData.${RUNTIME_NODE_EXTENSION_DATA_KEY}.nodes[${nodeIndex}]`;
        RUNTIME_NODE_ONLY_FIELDS.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(node, field)) {
                addIssue(
                    issues,
                    'SCENE_PERSISTENCE_RUNTIME_NODE_FIELD',
                    `${nodePath}.${field}`,
                    `Runtime-derived node field "${field}" must not be persisted.`,
                    {nodeId: node.id || null}
                );
            }
        });
        const components = Array.isArray(node.components) ? node.components : [];
        components.forEach((component, componentIndex) => {
            if (!component || typeof component !== 'object' || Array.isArray(component)) return;
            const componentPath = `${nodePath}.components[${componentIndex}]`;
            RUNTIME_COMPONENT_ONLY_FIELDS.forEach(field => {
                if (Object.prototype.hasOwnProperty.call(component, field)) {
                    addIssue(
                        issues,
                        'SCENE_PERSISTENCE_RUNTIME_COMPONENT_FIELD',
                        `${componentPath}.${field}`,
                        `Runtime-derived component field "${field}" must not be persisted.`,
                        {componentId: component.id || null, nodeId: node.id || null}
                    );
                }
            });
            if (component.typeId !== SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID ||
                !component.data || typeof component.data !== 'object') return;
            SCRATCH_BINDING_RUNTIME_ONLY_FIELDS.forEach(field => {
                if (Object.prototype.hasOwnProperty.call(component.data, field)) {
                    addIssue(
                        issues,
                        'SCENE_PERSISTENCE_SCRATCH_RUNTIME_FIELD',
                        `${componentPath}.data.${field}`,
                        `Scratch binding runtime field "${field}" must not be persisted.`,
                        {componentId: component.id || null, nodeId: node.id || null}
                    );
                }
            });
        });
    });
};

const createScenePersistenceReviewService = (
    sceneDataModel,
    runtimeNodeModel,
    scratchSpriteAdapter
) => {
    let lastReport = null;

    const audit = () => {
        const issues = [];
        const warnings = [];
        let project = null;
        try {
            project = sceneDataModel.readProject();
        } catch (error) {
            addIssue(issues, 'SCENE_PERSISTENCE_PROJECT_READ_FAILED', '$', error.message || String(error));
        }

        if (project) {
            const plainValidation = validatePersistentData(project);
            plainValidation.issues.forEach(issue => issues.push(Object.assign({}, cloneSerializable(issue), {
                sourceCode: issue.code,
                code: 'SCENE_PERSISTENCE_PLAIN_DATA_INVALID'
            })));

            const sceneValidation = sceneDataModel.validateProject(project);
            (sceneValidation.errors || []).forEach(issue => issues.push(Object.assign({}, cloneSerializable(issue), {
                sourceCode: issue.code,
                code: `SCENE_PERSISTENCE_${issue.code}`
            })));
            (sceneValidation.warnings || []).forEach(issue => warnings.push(cloneSerializable(issue)));

            const extensionData = project.extensionData && typeof project.extensionData === 'object' ?
                project.extensionData : {};
            const runtimeState = extensionData[RUNTIME_NODE_EXTENSION_DATA_KEY];
            if (runtimeState) {
                auditRuntimeNodeState(runtimeState, issues);
                try {
                    runtimeNodeModel.validatePersistentState(runtimeState);
                } catch (error) {
                    const importIssues = Array.isArray(error && error.errors) ? error.errors : [];
                    if (importIssues.length) {
                        importIssues.forEach(issue => issues.push(Object.assign({}, cloneSerializable(issue), {
                            sourceCode: issue.code,
                            code: `SCENE_PERSISTENCE_${issue.code}`,
                            path: issue.path || `$.extensionData.${RUNTIME_NODE_EXTENSION_DATA_KEY}`
                        })));
                    } else {
                        addIssue(
                            issues,
                            'SCENE_PERSISTENCE_RUNTIME_STATE_INVALID',
                            `$.extensionData.${RUNTIME_NODE_EXTENSION_DATA_KEY}`,
                            error.message || String(error)
                        );
                    }
                }
            }

            project.scenes.forEach((scene, index) => {
                if (!scene.snapshot || !scene.snapshot.metadata) return;
                const snapshotSceneId = scene.snapshot.metadata.sceneId;
                if (snapshotSceneId && snapshotSceneId !== scene.id) {
                    addIssue(
                        issues,
                        'SCENE_PERSISTENCE_SNAPSHOT_SCENE_MISMATCH',
                        `$.scenes[${index}].snapshot.metadata.sceneId`,
                        `Scene snapshot belongs to "${snapshotSceneId}" instead of "${scene.id}".`,
                        {sceneId: scene.id, snapshotSceneId}
                    );
                }
            });

            if (extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY] && scratchSpriteAdapter &&
                typeof scratchSpriteAdapter.validatePersistentBindings === 'function') {
                const bindingValidation = scratchSpriteAdapter.validatePersistentBindings();
                (bindingValidation.issues || []).forEach(issue => issues.push(cloneSerializable(issue)));
            }
        }

        const report = {
            issueCount: issues.length,
            issues,
            reviewedAt: new Date().toISOString(),
            valid: issues.length === 0,
            warningCount: warnings.length,
            warnings
        };
        lastReport = deepFreeze(report);
        return lastReport;
    };

    return Object.freeze({
        capabilityId: SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID,
        assertValid: () => {
            const report = audit();
            if (report.valid) return report;
            const error = new Error(`Scene persistence review failed with ${report.issueCount} issue${report.issueCount === 1 ? '' : 's'}.`);
            error.code = 'SCENE_PERSISTENCE_REVIEW_FAILED';
            error.report = report;
            throw error;
        },
        audit,
        dispose: () => {
            lastReport = null;
        },
        getLastReport: () => lastReport,
        runtimeOnlyFields: Object.freeze({
            component: RUNTIME_COMPONENT_ONLY_FIELDS,
            node: RUNTIME_NODE_ONLY_FIELDS,
            scratchBinding: SCRATCH_BINDING_RUNTIME_ONLY_FIELDS
        })
    });
};

module.exports = {
    RUNTIME_COMPONENT_ONLY_FIELDS,
    RUNTIME_NODE_ONLY_FIELDS,
    SCRATCH_BINDING_RUNTIME_ONLY_FIELDS,
    auditRuntimeNodeState,
    createScenePersistenceReviewService
};
