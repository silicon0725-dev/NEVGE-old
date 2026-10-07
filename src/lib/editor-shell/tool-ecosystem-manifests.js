import {TOOL_IDS} from './tool-registry';
import {
    OSS_INTAKE_STATUS,
    TOOL_ECOSYSTEM_AUTHORITIES,
    TOOL_ECOSYSTEM_LIFECYCLE,
    TOOL_ECOSYSTEM_ORIGINS,
    TOOL_ECOSYSTEM_PERSISTENCE_SCOPES,
    TOOL_ECOSYSTEM_SERVICES,
    ToolEcosystemRegistry
} from './tool-ecosystem';

const POST_MVP_TOOL_IDS = Object.freeze({
    TODO: TOOL_IDS.TODO,
    TERMINAL: 'ngvge.tool.terminal',
    PAINT: TOOL_IDS.PAINT
});

const CORE_POST_MVP_TOOL_MANIFESTS = Object.freeze([
    Object.freeze({
        schemaVersion: 1,
        toolId: POST_MVP_TOOL_IDS.TODO,
        title: 'Todo',
        lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE,
        origin: TOOL_ECOSYSTEM_ORIGINS.FIRST_PARTY,
        requiredServices: [
            TOOL_ECOSYSTEM_SERVICES.WINDOW_MANAGER,
            TOOL_ECOSYSTEM_SERVICES.TOOL_PERSISTENCE
        ],
        persistenceScopes: [TOOL_ECOSYSTEM_PERSISTENCE_SCOPES.WORKSPACE],
        authority: TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
        ossIntake: {status: OSS_INTAKE_STATUS.NOT_APPLICABLE},
        notes: 'Reference Post-MVP tool proving ToolId, Workspace Window, Launchpad, ' +
            'and scoped persistence integration.'
    }),
    Object.freeze({
        schemaVersion: 1,
        toolId: POST_MVP_TOOL_IDS.TERMINAL,
        title: 'Better Terminal',
        lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.PLANNED,
        origin: TOOL_ECOSYSTEM_ORIGINS.OSS_WRAPPED,
        requiredServices: [
            TOOL_ECOSYSTEM_SERVICES.WINDOW_MANAGER,
            TOOL_ECOSYSTEM_SERVICES.TOOL_PERSISTENCE
        ],
        persistenceScopes: [
            TOOL_ECOSYSTEM_PERSISTENCE_SCOPES.WORKSPACE,
            TOOL_ECOSYSTEM_PERSISTENCE_SCOPES.SESSION
        ],
        authority: TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
        ossIntake: {
            status: OSS_INTAKE_STATUS.REQUIRED,
            backendSelection: 'unselected'
        },
        notes: 'Planned terminal frontend. Backend selection requires OSS Intake ADR before activation.'
    }),
    Object.freeze({
        schemaVersion: 1,
        toolId: POST_MVP_TOOL_IDS.PAINT,
        title: 'Better Paint / Costume Editor',
        lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE,
        origin: TOOL_ECOSYSTEM_ORIGINS.OSS_WRAPPED,
        requiredServices: [
            TOOL_ECOSYSTEM_SERVICES.WINDOW_MANAGER,
            TOOL_ECOSYSTEM_SERVICES.CONTEXT,
            TOOL_ECOSYSTEM_SERVICES.TOOL_PERSISTENCE,
            TOOL_ECOSYSTEM_SERVICES.PROJECT_LIFECYCLE,
            TOOL_ECOSYSTEM_SERVICES.RESOURCE_MANAGER
        ],
        persistenceScopes: [
            TOOL_ECOSYSTEM_PERSISTENCE_SCOPES.WORKSPACE,
            TOOL_ECOSYSTEM_PERSISTENCE_SCOPES.USER
        ],
        authority: TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
        ossIntake: {
            status: OSS_INTAKE_STATUS.APPROVED,
            adrId: 'ADR-WS10A-SCRATCH-PAINT-INTAKE',
            backendSelection: 'scratch-paint@2.1.61'
        },
        notes: 'Active reviewed Project-command paint system. Native Costume/Backdrop is the primary presentation; ' +
            'the standalone Paint window remains a compatibility/development surface during migration. ' +
            'Project/Resource mutation remains behind WS-9 capability, transaction, and Review policy.'
    })
]);

const CORE_CONTEXT_CONSUMER_TOOL_MANIFESTS = Object.freeze([
    Object.freeze({
        schemaVersion: 1,
        toolId: TOOL_IDS.AGENT,
        title: 'NGVGE Agent',
        lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE,
        origin: TOOL_ECOSYSTEM_ORIGINS.FIRST_PARTY,
        requiredServices: [
            TOOL_ECOSYSTEM_SERVICES.WINDOW_MANAGER,
            TOOL_ECOSYSTEM_SERVICES.CONTEXT,
            TOOL_ECOSYSTEM_SERVICES.NODE_COMMAND,
            TOOL_ECOSYSTEM_SERVICES.AGENT_TRANSACTION
        ],
        persistenceScopes: [TOOL_ECOSYSTEM_PERSISTENCE_SCOPES.SESSION],
        authority: TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
        ossIntake: {status: OSS_INTAKE_STATUS.NOT_APPLICABLE},
        notes: 'First-party review-first Agent. Workspace Context is query-only and Project mutation remains behind ' +
            'the reviewed Agent transaction boundary.'
    })
]);

const CORE_WORKSPACE_TOOL_ECOSYSTEM_MANIFESTS = Object.freeze([
    ...CORE_POST_MVP_TOOL_MANIFESTS,
    ...CORE_CONTEXT_CONSUMER_TOOL_MANIFESTS
]);

const createCoreToolEcosystemRegistry = toolRegistry => new ToolEcosystemRegistry({
    toolRegistry,
    manifests: CORE_WORKSPACE_TOOL_ECOSYSTEM_MANIFESTS
});

export {
    POST_MVP_TOOL_IDS,
    CORE_POST_MVP_TOOL_MANIFESTS,
    CORE_CONTEXT_CONSUMER_TOOL_MANIFESTS,
    CORE_WORKSPACE_TOOL_ECOSYSTEM_MANIFESTS,
    createCoreToolEcosystemRegistry
};
