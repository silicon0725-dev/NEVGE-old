const TITLE_BY_ACTION = Object.freeze({
    create: 'Unable to create runtime node',
    delete: 'Unable to delete runtime node',
    duplicate: 'Unable to duplicate runtime node',
    import: 'Runtime node recovery failed',
    move: 'Unable to move runtime node',
    register: 'Unable to register runtime node type',
    rename: 'Unable to rename runtime node',
    update: 'Unable to update runtime node'
});

const SUGGESTION_BY_CODE = Object.freeze({
    RUNTIME_COMPONENT_MIGRATION_FAILED: 'Keep the current project data unchanged, then repair or replace the failing migration provider.',
    RUNTIME_COMPONENT_MIGRATION_PATH_MISSING: 'Install or enable the component owner that provides every required schema migration edge.',
    RUNTIME_COMPONENT_MIGRATION_RESULT_INVALID: 'Update the migration provider to return portable data and optional extensionData only.',
    RUNTIME_COMPONENT_SCHEMA_DOWNGRADE_FORBIDDEN: 'Register the same or a newer component schema version; descriptor downgrades are not supported.',
    RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE: 'Remove every live instance of this component type before changing its descriptor schema version.',
    RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT: 'Use the schema version owned by the registered component type descriptor.',
    RUNTIME_COMPONENT_SCHEMA_VERSION_UNSUPPORTED: 'Open the project with a runtime that supports this newer component schema version.',
    RUNTIME_NODE_IMPORT_INVALID: 'Review the reported node records. The current Runtime Graph was left unchanged.',
    RUNTIME_NODE_MODEL_DISPOSED: 'Re-enable Scene System and try the operation again.',
    RUNTIME_NODE_NOT_FOUND: 'Refresh the Project Explorer and verify that the node still exists.',
    RUNTIME_NODE_SCOPE_MISMATCH: 'Move the node only within Global or within its owning Scene.',
    RUNTIME_NODE_SCENE_MISMATCH: 'Nodes cannot be parented across different scenes.',
    RUNTIME_NODE_TYPE_ALREADY_EXISTS: 'Use a unique type ID, or replace the existing registration with the same owner.',
    RUNTIME_NODE_TYPE_OWNER_MISMATCH: 'Only the module that owns this node type can replace it.',
    RUNTIME_NODE_TYPE_REPLACE_OWNER_REQUIRED: 'Declare the provider owner explicitly when replacing a node type.',
    RUNTIME_NODE_TYPE_MISSING: 'Install or re-enable the module that provides this node type.',
    RUNTIME_NODE_CYCLE: 'Choose a parent outside the node’s own descendant branch.'
});

const firstIssue = error => Array.isArray(error && error.errors) && error.errors.length ? error.errors[0] : null;

const presentRuntimeNodeError = (error, context = {}) => {
    const issue = firstIssue(error);
    const code = (issue && issue.code) || (error && error.code) || 'RUNTIME_NODE_OPERATION_FAILED';
    const rawMessage = (issue && issue.message) || (error && error.message) || String(error || 'Unknown error');
    const title = context.title || TITLE_BY_ACTION[context.action] || 'Runtime node operation failed';
    const subject = context.nodeName || context.typeId || context.nodeId || null;
    return Object.freeze({
        code,
        details: issue || null,
        message: subject ? `${subject}: ${rawMessage}` : rawMessage,
        suggestion: context.suggestion || SUGGESTION_BY_CODE[code] || 'Review the node configuration and try again.',
        title
    });
};

const formatRuntimeNodeError = (error, context = {}) => {
    const presented = presentRuntimeNodeError(error, context);
    return [presented.title, presented.message, presented.suggestion].filter(Boolean).join('\n\n');
};

module.exports = {
    formatRuntimeNodeError,
    presentRuntimeNodeError
};
