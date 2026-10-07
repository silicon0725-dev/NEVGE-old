import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {
    TOOL_ECOSYSTEM_AUTHORITIES,
    TOOL_ECOSYSTEM_LIFECYCLE,
    TOOL_ECOSYSTEM_ORIGINS,
} from '../../../../src/lib/editor-shell/tool-ecosystem';
import {createCoreToolEcosystemRegistry} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';
import {createCoreWorkspaceToolCapabilityHost} from '../../../../src/lib/editor-shell/tool-capability-descriptors';
import {
    TOOL_CAPABILITY_ACCESS,
    WORKSPACE_TOOL_CAPABILITIES
} from '../../../../src/lib/editor-shell/tool-capability';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';
import {WorkspaceToolPersistenceService} from '../../../../src/lib/editor-shell/workspace-tool-persistence';
import {
    WORKSPACE_CAPABILITY_PROVIDER_STATES
} from '../../../../src/lib/editor-shell/workspace-capability-provider';
import {
    CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS,
    createCoreWorkspaceCapabilityProviderRegistry
} from '../../../../src/lib/editor-shell/workspace-capability-providers';
import {
    RESOURCE_COMMAND_KINDS,
    normalizeResourceCommand
} from '../../../../src/lib/editor-shell/workspace-project-resource-capabilities';

const RESOURCE_ID = 'ngvge:resource:12345678-abcd-4abc-9abc-123456789abc';

const addToolManifest = (ecosystemRegistry, toolId, authority) => ecosystemRegistry.register({
    schemaVersion: 1,
    toolId,
    title: `Test ${toolId}`,
    lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE,
    origin: TOOL_ECOSYSTEM_ORIGINS.FIRST_PARTY,
    requiredServices: [],
    persistenceScopes: [],
    authority,
    ossIntake: {status: 'not-applicable'},
    notes: 'WS-9F capability test consumer.'
});

const privilegedMutationReviewPolicy = Object.freeze({
    getSurfacePolicy: (capabilityId, access) => {
        if (capabilityId === WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND && access === TOOL_CAPABILITY_ACCESS.MUTATE) {
            return Object.freeze({
                mode: 'direct-denied',
                code: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED',
                message: 'Direct Resource mutation is disabled for Workspace Tools.'
            });
        }
        return Object.freeze({mode: 'not-required', code: null, message: null});
    }
});

const createFixture = () => {
    const toolRegistry = createCoreToolRegistry();
    const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
    addToolManifest(ecosystemRegistry, TOOL_IDS.ASSETS, TOOL_ECOSYSTEM_AUTHORITIES.RESOURCE_COMMAND);
    const capabilityHost = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
    capabilityHost.registerToolDescriptor({
        schemaVersion: 1,
        toolId: TOOL_IDS.ASSETS,
        requests: [{
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY,
            required: true
        }, {
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE,
            required: true
        }, {
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE,
            required: true
        }]
    });
    const contextService = new WorkspaceContextService();
    const persistenceService = new WorkspaceToolPersistenceService();
    const lifecycleState = {
        activeOperation: null,
        hostId: 'ngvge.project-lifecycle-host@1',
        phase: 'idle',
        projectGeneration: 4
    };
    const projectLifecycleHost = {getState: jest.fn(() => lifecycleState)};
    const records = new Map([[RESOURCE_ID, {
        resourceId: RESOURCE_ID,
        id: 'asset:internal-image',
        kind: 'costume',
        name: 'Hero',
        dataFormat: 'svg',
        folderId: null,
        referenceCount: 0,
        bitmapResolution: 1,
        rotationCenterX: 5,
        rotationCenterY: 6,
        asset: {raw: 'must-not-leak'}
    }]]);
    const resourceDatabase = {
        getAssetIdForResourceId: jest.fn(resourceId => records.has(resourceId) ? records.get(resourceId).id : null),
        getResource: jest.fn(resourceId => records.get(resourceId) || null),
        listResources: jest.fn(() => Array.from(records.values())),
        listFolders: jest.fn(() => [{id: 'folder:characters', name: 'Characters'}]),
        perform: jest.fn(async (label, action) => action()),
        renameAsset: jest.fn((internalId, name) => {
            const record = Array.from(records.values()).find(item => item.id === internalId);
            if (!record) return false;
            record.name = name;
            return true;
        }),
        moveAsset: jest.fn(() => true),
        removeAsset: jest.fn(internalId => {
            const entry = Array.from(records.entries()).find(([, item]) => item.id === internalId);
            if (!entry) return false;
            records.delete(entry[0]);
            return true;
        })
    };
    const registry = createCoreWorkspaceCapabilityProviderRegistry({
        capabilityHost,
        ecosystemRegistry,
        contextService,
        workspaceToolPersistenceService: persistenceService,
        projectLifecycleHost,
        privilegedMutationReviewPolicy,
        getResourceDatabase: () => resourceDatabase
    });
    return {
        capabilityHost,
        ecosystemRegistry,
        contextService,
        lifecycleState,
        projectLifecycleHost,
        registry,
        resourceDatabase
    };
};

describe('WS-9F Project / Resource Capability Provider Foundation', () => {
    test('coverage exposes Project read and Resource surfaces while Project command remains explicitly unavailable', () => {
        const {registry} = createFixture();
        const coverage = registry.getCoverageDiagnostics().surfaces;
        expect(coverage).toEqual(expect.arrayContaining([
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_READ,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.READY
            }),
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_COMMAND_MUTATE,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
                diagnosticCode: 'NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY'
            }),
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_READ,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.READY
            }),
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_COMMAND_MUTATE,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
                diagnosticCode: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'
            })
        ]));
    });

    test('Project read facade returns only portable context/lifecycle state', () => {
        const {capabilityHost, ecosystemRegistry, contextService, registry} = createFixture();
        const projectWriter = contextService.claimWriter(
            'project',
            'ngvge.workspace-context-source.ws9f-project-test'
        );
        projectWriter.update({projectId: 'ngvge.project-context.g4'});
        addToolManifest(ecosystemRegistry, TOOL_IDS.NODE_EXPLORER, TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_READ);
        capabilityHost.registerToolDescriptor({
            schemaVersion: 1,
            toolId: TOOL_IDS.NODE_EXPLORER,
            requests: [{
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_READ,
                access: TOOL_CAPABILITY_ACCESS.QUERY,
                required: true
            }]
        });
        const lease = capabilityHost.admit(TOOL_IDS.NODE_EXPLORER);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
        expect(binding.facade.getSnapshot()).toEqual({
            schemaVersion: 1,
            projectId: 'ngvge.project-context.g4',
            lifecycle: {
                hostId: 'ngvge.project-lifecycle-host@1',
                phase: 'idle',
                projectGeneration: 4,
                activeOperation: null
            }
        });
        expect(binding.facade.serializeProjectJSON).toBeUndefined();
        expect(binding.facade.vm).toBeUndefined();
    });

    test('Resource query maps internal asset records to canonical portable Resource descriptors', () => {
        const {capabilityHost, registry} = createFixture();
        const lease = capabilityHost.admit(TOOL_IDS.ASSETS);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
        expect(binding.facade.getResource(RESOURCE_ID)).toEqual({
            schemaVersion: 1,
            resourceId: RESOURCE_ID,
            kind: 'image',
            name: 'Hero',
            dataFormat: 'svg',
            folderId: null,
            referenceCount: 0,
            bitmapResolution: 1,
            rotationCenterX: 5,
            rotationCenterY: 6
        });
        expect(binding.facade.getResource(RESOURCE_ID)).not.toHaveProperty('id');
        expect(binding.facade.getResource(RESOURCE_ID)).not.toHaveProperty('asset');
        expect(() => binding.facade.getResource('asset:internal-image')).toThrow(/canonical ngvge:resource/);
    });

    test('Resource command proposal validates a bounded metadata-only vocabulary', () => {
        expect(normalizeResourceCommand({
            schemaVersion: 1,
            kind: RESOURCE_COMMAND_KINDS.RENAME,
            resourceId: RESOURCE_ID,
            name: 'Hero 2'
        })).toEqual({
            schemaVersion: 1,
            kind: 'rename',
            resourceId: RESOURCE_ID,
            name: 'Hero 2'
        });
        expect(() => normalizeResourceCommand({
            schemaVersion: 1,
            kind: 'replace-binary',
            resourceId: RESOURCE_ID,
            backendHandle: {}
        })).toThrow();
    });

    test('Resource mutate provider is no longer bindable as a direct privileged mutation bypass', () => {
        const {capabilityHost, registry, resourceDatabase} = createFixture();
        const lease = capabilityHost.admit(TOOL_IDS.ASSETS);
        expect(() => registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        })).toThrow(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'
        }));
        expect(resourceDatabase.renameAsset).not.toHaveBeenCalled();
        expect(resourceDatabase.perform).not.toHaveBeenCalled();
    });



    test('Project command bind fails closed with the explicit native-authority diagnostic', () => {
        const {capabilityHost, ecosystemRegistry, registry} = createFixture();
        addToolManifest(ecosystemRegistry, TOOL_IDS.NODE_EXPLORER, TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND);
        capabilityHost.registerToolDescriptor({
            schemaVersion: 1,
            toolId: TOOL_IDS.NODE_EXPLORER,
            requests: [{
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                required: true
            }]
        });
        const lease = capabilityHost.admit(TOOL_IDS.NODE_EXPLORER);
        expect(() => registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        })).toThrow(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY'
        }));
    });

    test('Resource direct mutate denial occurs before any command-specific mutation path', () => {
        const {capabilityHost, registry, resourceDatabase} = createFixture();
        const lease = capabilityHost.admit(TOOL_IDS.ASSETS);
        expect(() => registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        })).toThrow(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'
        }));
        expect(resourceDatabase.moveAsset).not.toHaveBeenCalled();
        expect(resourceDatabase.perform).not.toHaveBeenCalled();
    });


    test('an existing Resource binding fails closed after the Resource authority disappears', () => {
        const fixture = createFixture();
        let database = fixture.resourceDatabase;
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost: fixture.capabilityHost,
            contextService: fixture.contextService,
            workspaceToolPersistenceService: new WorkspaceToolPersistenceService(),
            projectLifecycleHost: fixture.projectLifecycleHost,
            getResourceDatabase: () => database
        });
        const lease = fixture.capabilityHost.admit(TOOL_IDS.ASSETS);
        const binding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
        expect(binding.facade.getResource(RESOURCE_ID)).toEqual(expect.objectContaining({resourceId: RESOURCE_ID}));
        database = null;
        expect(() => binding.facade.getResource(RESOURCE_ID)).toThrow(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_RESOURCE_AUTHORITY_UNAVAILABLE'
        }));
    });

    test('Resource providers become unavailable when canonical Resource authority disappears', () => {
        const fixture = createFixture();
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost: fixture.capabilityHost,
            contextService: fixture.contextService,
            workspaceToolPersistenceService: new WorkspaceToolPersistenceService(),
            projectLifecycleHost: fixture.projectLifecycleHost,
            getResourceDatabase: () => null
        });
        const coverage = registry.getCoverageDiagnostics().surfaces;
        expect(coverage).toEqual(expect.arrayContaining([
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
                diagnosticCode: 'NGVGE_WORKSPACE_RESOURCE_AUTHORITY_UNAVAILABLE'
            })
        ]));
    });
});
