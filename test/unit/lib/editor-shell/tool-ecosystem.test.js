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
    ToolEcosystemRegistry,
    normalizeToolEcosystemManifest
} from '../../../../src/lib/editor-shell/tool-ecosystem';
import {
    POST_MVP_TOOL_IDS,
    createCoreToolEcosystemRegistry
} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';

const makeToolDefinition = id => ({
    schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
    id,
    title: 'Ecosystem Test',
    source: {kind: TOOL_SOURCE_KINDS.DEVELOPER, providerId: 'test'},
    singleton: true,
    window: {
        id: `${id}.window`,
        title: 'Ecosystem Test',
        role: 'supporting',
        defaultVisible: false,
        defaultPosition: {x: 0, y: 0},
        defaultSize: {width: 100, height: 100},
        minSize: {width: 50, height: 50},
        maxSize: {width: 500, height: 500},
        capabilities: {close: true, minimize: true, maximize: true, resize: true, persist: true}
    }
});

const makeManifest = overrides => ({
    schemaVersion: 1,
    toolId: 'ngvge.tool.ecosystem-test',
    title: 'Ecosystem Test',
    lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.PLANNED,
    origin: TOOL_ECOSYSTEM_ORIGINS.FIRST_PARTY,
    requiredServices: [],
    persistenceScopes: ['workspace'],
    authority: TOOL_ECOSYSTEM_AUTHORITIES.WORKSPACE_ONLY,
    ossIntake: {status: OSS_INTAKE_STATUS.NOT_APPLICABLE},
    ...overrides
});

describe('WS-8 Tool Ecosystem Contract', () => {
    test('keeps planned tools absent while activated OSS tools require admitted ToolRegistry identity', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystem = createCoreToolEcosystemRegistry(toolRegistry);
        expect(ecosystem.require(POST_MVP_TOOL_IDS.TODO).lifecycle).toBe('active');
        expect(ecosystem.require(POST_MVP_TOOL_IDS.TERMINAL).lifecycle).toBe('planned');
        expect(ecosystem.require(POST_MVP_TOOL_IDS.PAINT)).toMatchObject({
            lifecycle: 'active',
            authority: TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
            ossIntake: {status: 'approved', adrId: 'ADR-WS10A-SCRATCH-PAINT-INTAKE'}
        });
        expect(toolRegistry.has(POST_MVP_TOOL_IDS.TODO)).toBe(true);
        expect(toolRegistry.has(POST_MVP_TOOL_IDS.TERMINAL)).toBe(false);
        expect(toolRegistry.has(POST_MVP_TOOL_IDS.PAINT)).toBe(true);
    });

    test('admits the first-party Agent while preserving Terminal as a planned tool', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystem = createCoreToolEcosystemRegistry(toolRegistry);
        expect(ecosystem.require(TOOL_IDS.AGENT)).toMatchObject({
            lifecycle: 'active',
            authority: TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
            requiredServices: expect.arrayContaining(['workspace.context', 'agent.transaction'])
        });
        expect(ecosystem.require(POST_MVP_TOOL_IDS.TERMINAL).lifecycle).toBe('planned');
        expect(ecosystem.require(POST_MVP_TOOL_IDS.PAINT).lifecycle).toBe('active');
    });

    test('fails closed if a non-active ecosystem manifest leaks into ToolRegistry', () => {
        const toolRegistry = createCoreToolRegistry();
        toolRegistry.register(makeToolDefinition('ngvge.tool.ecosystem-test'));
        const ecosystem = new ToolEcosystemRegistry({toolRegistry});
        expect(() => ecosystem.register(makeManifest({}))).toThrow(/cannot leak into ToolRegistry/);
    });

    test('fails closed if an active manifest has no ToolRegistry definition', () => {
        const toolRegistry = createCoreToolRegistry();
        const ecosystem = new ToolEcosystemRegistry({toolRegistry});
        expect(() => ecosystem.register(makeManifest({lifecycle: 'active'}))).toThrow(/requires ToolRegistry/);
    });

    test('requires approved OSS Intake ADR before an OSS-wrapped tool can become active', () => {
        expect(() => normalizeToolEcosystemManifest(makeManifest({
            lifecycle: 'active',
            origin: 'oss-wrapped',
            ossIntake: {status: 'required', backendSelection: 'some-library'}
        }))).toThrow(/approved OSS Intake ADR/);
        expect(normalizeToolEcosystemManifest(makeManifest({
            lifecycle: 'active',
            origin: 'oss-wrapped',
            ossIntake: {status: 'approved', adrId: 'OSS-INTAKE-0001', backendSelection: 'some-library'}
        }))).toMatchObject({ossIntake: {status: 'approved', adrId: 'OSS-INTAKE-0001'}});
    });

    test('does not allow Project or Secret persistence scopes to be claimed by ecosystem tools', () => {
        expect(() => normalizeToolEcosystemManifest(makeManifest({persistenceScopes: ['secret']})))
            .toThrow(/unsupported value/);
        expect(() => normalizeToolEcosystemManifest(makeManifest({persistenceScopes: ['project']})))
            .toThrow(/unsupported value/);
    });
});
