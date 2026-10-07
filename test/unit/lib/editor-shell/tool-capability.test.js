import {
    TOOL_IDS,
    createCoreToolRegistry,
    TOOL_DEFINITION_SCHEMA_VERSION,
    TOOL_SOURCE_KINDS
} from '../../../../src/lib/editor-shell/tool-registry';
import {
    OSS_INTAKE_STATUS,
    TOOL_ECOSYSTEM_AUTHORITIES,
    TOOL_ECOSYSTEM_LIFECYCLE,
    TOOL_ECOSYSTEM_ORIGINS,
    ToolEcosystemRegistry
} from '../../../../src/lib/editor-shell/tool-ecosystem';
import {createCoreToolEcosystemRegistry, POST_MVP_TOOL_IDS} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';
import {
    TOOL_CAPABILITY_ACCESS,
    TOOL_CAPABILITY_PRIVILEGES,
    TOOL_CAPABILITY_SCOPES,
    WORKSPACE_TOOL_CAPABILITIES,
    WORKSPACE_TOOL_CAPABILITY_HOST_ID,
    WorkspaceToolCapabilityHost,
    normalizeToolCapabilityDescriptor,
    normalizeToolCapabilityDefinition
} from '../../../../src/lib/editor-shell/tool-capability';
import {
    CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS,
    createCoreWorkspaceToolCapabilityHost
} from '../../../../src/lib/editor-shell/tool-capability-descriptors';

const makeToolDefinition = id => ({
    schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
    id,
    title: 'Capability Test',
    source: {kind: TOOL_SOURCE_KINDS.DEVELOPER, providerId: 'test'},
    singleton: true,
    window: {
        id: `${id}.window`,
        title: 'Capability Test',
        role: 'supporting',
        defaultVisible: false,
        defaultPosition: {x: 0, y: 0},
        defaultSize: {width: 100, height: 100},
        minSize: {width: 50, height: 50},
        maxSize: {width: 500, height: 500},
        capabilities: {close: true, minimize: true, maximize: true, resize: true, persist: true}
    }
});

const makeManifest = ({toolId, lifecycle = TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE, authority}) => ({
    schemaVersion: 1,
    toolId,
    title: 'Capability Test',
    lifecycle,
    origin: TOOL_ECOSYSTEM_ORIGINS.FIRST_PARTY,
    requiredServices: [],
    persistenceScopes: ['workspace'],
    authority,
    ossIntake: {status: OSS_INTAKE_STATUS.NOT_APPLICABLE}
});

const createHostForTool = ({
    toolId = 'ngvge.tool.capability-test',
    lifecycle = TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE,
    authority = TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
    request = {
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
        access: TOOL_CAPABILITY_ACCESS.MUTATE,
        required: true
    }
} = {}) => {
    const toolRegistry = createCoreToolRegistry();
    if (lifecycle === TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE) toolRegistry.register(makeToolDefinition(toolId));
    const ecosystemRegistry = new ToolEcosystemRegistry({toolRegistry});
    ecosystemRegistry.register(makeManifest({toolId, lifecycle, authority}));
    return new WorkspaceToolCapabilityHost({
        toolRegistry,
        ecosystemRegistry,
        definitions: CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS,
        descriptors: [{schemaVersion: 1, toolId, requests: [request]}]
    });
};

describe('WS-9A Tool Capability Schema & Admission Foundation', () => {
    test('creates the core host and admits Todo only to its declared Workspace state capability', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
        const host = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
        const lease = host.admit(POST_MVP_TOOL_IDS.TODO);
        expect(host.id).toBe(WORKSPACE_TOOL_CAPABILITY_HOST_ID);
        expect(lease.isActive()).toBe(true);
        expect(lease.assert(WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE, TOOL_CAPABILITY_ACCESS.MUTATE))
            .toMatchObject({scope: 'workspace', privilege: 'standard'});
        expect(() => lease.assert(WORKSPACE_TOOL_CAPABILITIES.PROJECT_READ, TOOL_CAPABILITY_ACCESS.QUERY))
            .toThrow(/was not declared/);
    });

    test('admits Agent only to explicit Context query capability', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
        const host = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
        const lease = host.admit(TOOL_IDS.AGENT);
        expect(lease.assert(WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ, TOOL_CAPABILITY_ACCESS.QUERY))
            .toMatchObject({scope: 'workspace', privilege: 'standard'});
        expect(() => lease.assert(WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND, TOOL_CAPABILITY_ACCESS.MUTATE))
            .toThrow(/was not declared/);
    });

    test('revokes active leases immediately when ToolRegistry unregisters the Tool', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
        const host = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
        const lease = host.admit(TOOL_IDS.AGENT);
        const revoked = [];
        lease.subscribeRevocation(event => revoked.push(event));
        expect(toolRegistry.unregister(TOOL_IDS.AGENT)).toBe(true);
        expect(lease.isActive()).toBe(false);
        expect(lease.getRevokeReason()).toBe('tool-unregistered');
        expect(revoked).toEqual([expect.objectContaining({toolId: TOOL_IDS.AGENT, reason: 'tool-unregistered'})]);
        expect(() => lease.assert(WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ, TOOL_CAPABILITY_ACCESS.QUERY))
            .toThrow(/revoked/);
    });

    test('host disposal revokes all leases and prevents new admission', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
        const host = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
        const lease = host.admit(TOOL_IDS.AGENT);
        expect(host.dispose()).toBe(true);
        expect(lease.isActive()).toBe(false);
        expect(lease.getRevokeReason()).toBe('host-disposed');
        expect(() => host.admit(TOOL_IDS.AGENT)).toThrow(/disposed/);
    });

    test('fails closed for planned ecosystem tools even when their ToolId is reserved', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
        const host = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
        expect(() => host.admit(POST_MVP_TOOL_IDS.TERMINAL)).toThrow(/Only active ecosystem tools/);
        expect(() => host.admit(POST_MVP_TOOL_IDS.TERMINAL)).toThrow(/Only active ecosystem tools/);
    });

    test('rejects undeclared or authority-incompatible capability requests at descriptor registration', () => {
        expect(() => createHostForTool({
            authority: TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
            request: {
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                required: true
            }
        })).toThrow(/cannot request/);
        expect(() => createHostForTool({
            request: {
                capabilityId: 'ngvge.workspace-capability.not-registered',
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                required: true
            }
        })).toThrow(/not registered/);
    });

    test('keeps capability schema portable and rejects backend or arbitrary fields', () => {
        expect(() => normalizeToolCapabilityDefinition({
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
            scope: TOOL_CAPABILITY_SCOPES.WORKSPACE,
            allowedAccess: [TOOL_CAPABILITY_ACCESS.QUERY],
            privilege: TOOL_CAPABILITY_PRIVILEGES.STANDARD,
            allowedAuthorities: [TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY],
            description: 'test',
            renderer: {}
        })).toThrow(/unsupported field/);
        expect(() => normalizeToolCapabilityDescriptor({
            schemaVersion: 1,
            toolId: 'ngvge.tool.test',
            requests: [],
            vm: {}
        })).toThrow(/unsupported field/);
    });

    test('revokes leases so stale tool references cannot continue capability checks', () => {
        const host = createHostForTool();
        const lease = host.admit('ngvge.tool.capability-test');
        expect(lease.has(WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE, TOOL_CAPABILITY_ACCESS.MUTATE)).toBe(true);
        expect(host.revoke(lease.id, 'window-disposed')).toBe(true);
        expect(lease.isActive()).toBe(false);
        expect(lease.getRevokeReason()).toBe('window-disposed');
        expect(() => lease.assert(WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE)).toThrow(/revoked/);
    });

    test('revokeTool invalidates every lease for one tool without touching another tool', () => {
        const firstToolId = 'ngvge.tool.capability-first';
        const secondToolId = 'ngvge.tool.capability-second';
        const toolRegistry = createCoreToolRegistry();
        toolRegistry.register(makeToolDefinition(firstToolId));
        toolRegistry.register(makeToolDefinition(secondToolId));
        const ecosystemRegistry = new ToolEcosystemRegistry({toolRegistry});
        ecosystemRegistry.register(makeManifest({
            toolId: firstToolId,
            authority: TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY
        }));
        ecosystemRegistry.register(makeManifest({
            toolId: secondToolId,
            authority: TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY
        }));
        const request = {
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
            access: TOOL_CAPABILITY_ACCESS.QUERY,
            required: true
        };
        const host = new WorkspaceToolCapabilityHost({
            toolRegistry,
            ecosystemRegistry,
            definitions: CORE_WORKSPACE_TOOL_CAPABILITY_DEFINITIONS,
            descriptors: [
                {schemaVersion: 1, toolId: firstToolId, requests: [request]},
                {schemaVersion: 1, toolId: secondToolId, requests: [request]}
            ]
        });
        const firstA = host.admit(firstToolId);
        const firstB = host.admit(firstToolId);
        const second = host.admit(secondToolId);
        expect(host.revokeTool(firstToolId, 'tool-disabled')).toBe(2);
        expect(firstA.isActive()).toBe(false);
        expect(firstB.isActive()).toBe(false);
        expect(second.isActive()).toBe(true);
    });
});
