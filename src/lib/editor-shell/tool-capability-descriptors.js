import {TOOL_ECOSYSTEM_AUTHORITIES} from './tool-ecosystem';
import {TOOL_IDS} from './tool-registry';
import {
    TOOL_CAPABILITY_ACCESS,
    TOOL_CAPABILITY_PRIVILEGES,
    TOOL_CAPABILITY_SCOPES,
    WORKSPACE_TOOL_CAPABILITIES,
    WorkspaceToolCapabilityHost
} from './tool-capability';

const CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS = Object.freeze([
    Object.freeze({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
        scope: TOOL_CAPABILITY_SCOPES.WORKSPACE,
        allowedAccess: [TOOL_CAPABILITY_ACCESS.QUERY],
        privilege: TOOL_CAPABILITY_PRIVILEGES.STANDARD,
        allowedAuthorities: [
            TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_READ,
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
            TOOL_ECOSYSTEM_AUTHORITIES.RESOURCE_COMMAND
        ],
        description: 'Query the portable Workspace Context snapshot without acquiring Project or Resource authority.'
    }),
    Object.freeze({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
        scope: TOOL_CAPABILITY_SCOPES.WORKSPACE,
        allowedAccess: [TOOL_CAPABILITY_ACCESS.QUERY, TOOL_CAPABILITY_ACCESS.MUTATE],
        privilege: TOOL_CAPABILITY_PRIVILEGES.STANDARD,
        allowedAuthorities: [
            TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_READ,
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
            TOOL_ECOSYSTEM_AUTHORITIES.RESOURCE_COMMAND
        ],
        description: 'Query or mutate state owned by the Workspace scope without acquiring Project authority.'
    }),
    Object.freeze({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_READ,
        scope: TOOL_CAPABILITY_SCOPES.PROJECT,
        allowedAccess: [TOOL_CAPABILITY_ACCESS.QUERY],
        privilege: TOOL_CAPABILITY_PRIVILEGES.STANDARD,
        allowedAuthorities: [
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_READ,
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND
        ],
        description: 'Query portable Project semantic data through a future Project capability provider.'
    }),
    Object.freeze({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
        scope: TOOL_CAPABILITY_SCOPES.PROJECT,
        allowedAccess: [TOOL_CAPABILITY_ACCESS.PROPOSE, TOOL_CAPABILITY_ACCESS.MUTATE],
        privilege: TOOL_CAPABILITY_PRIVILEGES.SENSITIVE,
        allowedAuthorities: [TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND],
        description: 'Submit or execute Project semantic commands through Project authority.'
    }),
    Object.freeze({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
        scope: TOOL_CAPABILITY_SCOPES.RESOURCE,
        allowedAccess: [TOOL_CAPABILITY_ACCESS.QUERY],
        privilege: TOOL_CAPABILITY_PRIVILEGES.STANDARD,
        allowedAuthorities: [
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
            TOOL_ECOSYSTEM_AUTHORITIES.RESOURCE_COMMAND
        ],
        description: 'Query ResourceId-addressed data without exposing backend resource handles.'
    }),
    Object.freeze({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_CONTENT_READ,
        scope: TOOL_CAPABILITY_SCOPES.RESOURCE,
        allowedAccess: [TOOL_CAPABILITY_ACCESS.QUERY],
        privilege: TOOL_CAPABILITY_PRIVILEGES.STANDARD,
        allowedAuthorities: [
            TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
            TOOL_ECOSYSTEM_AUTHORITIES.RESOURCE_COMMAND
        ],
        description: 'Read portable bounded image Resource content without exposing Scratch asset/backend handles.'
    }),
    Object.freeze({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
        scope: TOOL_CAPABILITY_SCOPES.RESOURCE,
        allowedAccess: [TOOL_CAPABILITY_ACCESS.PROPOSE, TOOL_CAPABILITY_ACCESS.MUTATE],
        privilege: TOOL_CAPABILITY_PRIVILEGES.SENSITIVE,
        allowedAuthorities: [TOOL_ECOSYSTEM_AUTHORITIES.RESOURCE_COMMAND],
        description: 'Submit or execute ResourceId-addressed mutations through Resource authority.'
    })
]);

const CORE_WORKSPACE_TOOL_CAPABILITY_DESCRIPTORS = Object.freeze([
    Object.freeze({
        schemaVersion: 1,
        toolId: TOOL_IDS.AGENT,
        requests: [
            Object.freeze({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                required: true
            })
        ]
    }),
    Object.freeze({
        schemaVersion: 1,
        toolId: TOOL_IDS.PAINT,
        requests: [
            Object.freeze({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                required: true
            }),
            Object.freeze({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                required: true
            }),
            Object.freeze({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_CONTENT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                required: true
            }),
            Object.freeze({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.PROPOSE,
                required: true
            }),
            Object.freeze({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                required: true
            })
        ]
    }),
    Object.freeze({
        schemaVersion: 1,
        toolId: TOOL_IDS.TODO,
        requests: [
            Object.freeze({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                required: true
            })
        ]
    })
]);

const createCoreWorkspaceToolCapabilityHost = ({toolRegistry, ecosystemRegistry}) => new WorkspaceToolCapabilityHost({
    toolRegistry,
    ecosystemRegistry,
    definitions: CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS,
    descriptors: CORE_WORKSPACE_TOOL_CAPABILITY_DESCRIPTORS
});

export {
    CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS,
    CORE_WORKSPACE_TOOL_CAPABILITY_DESCRIPTORS,
    createCoreWorkspaceToolCapabilityHost
};
