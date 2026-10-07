import {createCoreToolRegistry, TOOL_IDS} from '../../../../src/lib/editor-shell/tool-registry';
import {createCoreToolEcosystemRegistry} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';
import {createCoreWorkspaceToolCapabilityHost} from '../../../../src/lib/editor-shell/tool-capability-descriptors';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';
import {WorkspaceToolPersistenceService} from '../../../../src/lib/editor-shell/workspace-tool-persistence';
import {createWorkspaceProjectCommandHost} from '../../../../src/lib/editor-shell/project-command-host';
import {createWorkspaceProjectTransactionReviewService} from '../../../../src/lib/editor-shell/project-transaction-review';
import {createWorkspacePrivilegedMutationReviewPolicy} from '../../../../src/lib/editor-shell/privileged-mutation-review-policy';
import {createCoreWorkspaceCapabilityProviderRegistry} from '../../../../src/lib/editor-shell/workspace-capability-providers';
import {
    WORKSPACE_PAINT_BACKEND_ADAPTER_ID,
    WORKSPACE_PAINT_TOOL_SESSION_ID,
    createWorkspacePaintToolSession
} from '../../../../src/lib/editor-shell/paint-tool-runtime';
import {SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID} from '../../../../src/lib/paint-backends/svg-edit-vector-backend';

const RESOURCE_ID = 'ngvge:resource:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const createDatabase = () => {
    const record = {
        id: 'asset:paint-test',
        resourceId: RESOURCE_ID,
        kind: 'costume',
        name: 'Hero',
        dataFormat: 'svg',
        folderId: null,
        referenceCount: 1,
        bitmapResolution: 1,
        rotationCenterX: 0,
        rotationCenterY: 0
    };
    const history = [];
    const listeners = new Set();
    let revision = 1;
    let contentRevision = 0;
    let dataUri = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E';
    const emit = type => {
        revision += 1;
        listeners.forEach(listener => listener({assetId: record.id, type}));
    };
    return {
        getAsset: id => id === record.id ? {...record} : null,
        getAssetIdForResourceId: id => id === RESOURCE_ID ? record.id : null,
        getDataURL: id => id === record.id ? dataUri : null,
        getRevision: () => revision,
        getResourceContentRevision: id => id === RESOURCE_ID ? contentRevision : null,
        getResource: id => id === RESOURCE_ID ? {...record} : null,
        listResources: () => [{...record}],
        listFolders: () => [],
        renameAsset: (id, name) => {
            if (id !== record.id || record.name === name) return false;
            record.name = name;
            emit('rename');
            return true;
        },
        moveAsset: () => false,
        removeAsset: () => false,
        perform: async (label, action) => {
            const before = {...record};
            const result = await action();
            history.push({label, before});
            return result;
        },
        undo: () => {
            const entry = history.pop();
            if (!entry) return false;
            Object.assign(record, entry.before);
            emit('undo');
            return true;
        },
        getHistoryState: () => ({nextUndoLabel: history.length ? history[history.length - 1].label : null}),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        replaceImageResourceContent: async (resourceId, command) => {
            if (resourceId !== RESOURCE_ID) return false;
            if (command.expectedSourceAuthorityRevision !== contentRevision) {
                const error = new Error('stale content');
                error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_SOURCE_STALE';
                throw error;
            }
            if (command.content.kind === 'svg-text') {
                dataUri = `data:image/svg+xml,${encodeURIComponent(command.content.text)}`;
            } else {
                dataUri = command.content.dataUri;
            }
            record.dataFormat = command.dataFormat;
            record.bitmapResolution = command.bitmapResolution;
            record.rotationCenterX = command.rotationCenterX;
            record.rotationCenterY = command.rotationCenterY;
            contentRevision += 1;
            emit('replace');
            return true;
        },
        replaceContent: nextDataUri => {
            dataUri = nextDataUri;
            contentRevision += 1;
            emit('replace');
        }
    };
};

const createFixture = () => {
    const toolRegistry = createCoreToolRegistry();
    const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
    const capabilityHost = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
    const contextService = new WorkspaceContextService();
    contextService.claimWriter('project', 'ngvge.workspace-context-source.ws10a-project')
        .update({projectId: 'ngvge.project-context.g10'});
    contextService.claimWriter('resource', 'ngvge.workspace-context-source.ws10a-resource')
        .update({resourceId: RESOURCE_ID});
    const database = createDatabase();
    const projectCommandHost = createWorkspaceProjectCommandHost({
        contextService,
        getResourceDatabase: () => database
    });
    const reviewService = createWorkspaceProjectTransactionReviewService({
        projectCommandHost,
        contextService,
        getResourceDatabase: () => database
    });
    const policy = createWorkspacePrivilegedMutationReviewPolicy({
        projectTransactionReviewService: reviewService
    });
    const providerRegistry = createCoreWorkspaceCapabilityProviderRegistry({
        capabilityHost,
        contextService,
        workspaceToolPersistenceService: new WorkspaceToolPersistenceService(),
        projectLifecycleHost: {
            getState: () => ({hostId: 'ngvge.project-lifecycle-host@1', phase: 'idle', projectGeneration: 10})
        },
        projectCommandHost,
        projectTransactionReviewService: reviewService,
        privilegedMutationReviewPolicy: policy,
        getResourceDatabase: () => database
    });
    const session = createWorkspacePaintToolSession({capabilityHost, providerRegistry});
    return {capabilityHost, database, providerRegistry, session};
};

describe('WS-10A Better Paint Tool admission and Resource editing session', () => {
    test('keeps scratch-paint as the raster compatibility backend identity', () => {
        expect(WORKSPACE_PAINT_BACKEND_ADAPTER_ID).toBe('ngvge.workspace-paint-backend.scratch-paint@1');
    });

    test('activates Paint as an admitted reviewed Project-command Tool with isolated backend identity', () => {
        const {capabilityHost, providerRegistry, session} = createFixture();
        const descriptor = capabilityHost.getToolDescriptor(TOOL_IDS.PAINT);
        expect(descriptor.requests).toEqual(expect.arrayContaining([
            expect.objectContaining({capabilityId: 'ngvge.workspace-capability.context-read', access: 'query'}),
            expect.objectContaining({capabilityId: 'ngvge.workspace-capability.resource-read', access: 'query'}),
            expect.objectContaining({capabilityId: 'ngvge.workspace-capability.resource-content-read', access: 'query'}),
            expect.objectContaining({capabilityId: 'ngvge.workspace-capability.project-command', access: 'propose'}),
            expect.objectContaining({capabilityId: 'ngvge.workspace-capability.project-command', access: 'mutate'})
        ]));
        expect(providerRegistry.diagnoseTool(TOOL_IDS.PAINT).requests.every(item => item.state === 'ready')).toBe(true);
        const state = session.getState();
        expect(state.sessionId).toBe(WORKSPACE_PAINT_TOOL_SESSION_ID);
        expect(state.backend.adapterId).toBe(SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID);
        expect(state.backend.package).toBe('@svgedit/svgcanvas@7.4.2');
        expect(state.selectedResourceId).toBe(RESOURCE_ID);
        expect(state.resource.name).toBe('Hero');
        expect(state.vm).toBeUndefined();
    });

    test('renames an image only through proposal review evidence and Project transaction commit', async () => {
        const {database, session} = createFixture();
        session.setDraftName('Hero Prime');
        const review = session.reviewChanges();
        expect(review.canCommit).toBe(true);
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero');
        const transaction = await session.commitReviewedChanges();
        expect(transaction.state).toBe('committed');
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero Prime');
        expect(session.getState().status).toBe('committed');
    });

    test('rolls back the last Paint transaction through a fresh rollback review', async () => {
        const {database, session} = createFixture();
        session.setDraftName('Hero Prime');
        session.reviewChanges();
        await session.commitReviewedChanges();
        await session.rollbackLastTransaction();
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero');
        expect(session.getState().status).toBe('rolled-back');
    });

    test('rejects non-image Resource selection', () => {
        const {session} = createFixture();
        expect(() => session.selectResource('ngvge:resource:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
            .toThrow(/unavailable/);
    });

    test('loads Resource content into a clean transient working copy without mutating Project state', () => {
        const {database, session} = createFixture();
        const state = session.getState();
        expect(state.workingCopy).toEqual(expect.objectContaining({
            loaded: true,
            resourceId: RESOURCE_ID,
            dirty: false,
            stale: false,
            dataFormat: 'svg'
        }));
        const beforeName = database.getResource(RESOURCE_ID).name;
        session.applyWorkingCopyEdit({
            dataFormat: 'svg',
            rotationCenterX: 12,
            rotationCenterY: 13,
            content: {kind: 'svg-text', text: '<svg><path/></svg>'}
        });
        expect(session.getState().workingCopy.dirty).toBe(true);
        expect(session.getWorkingCopyContent().content.text).toContain('path');
        expect(database.getResource(RESOURCE_ID).name).toBe(beforeName);
    });

    test('commits dirty image content only through reviewed resource.content.replace transaction', async () => {
        const {database, session} = createFixture();
        session.applyWorkingCopyEdit({
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX: 12,
            rotationCenterY: 13,
            content: {kind: 'svg-text', text: '<svg><rect/></svg>'}
        });
        const review = session.reviewChanges();
        expect(review.canCommit).toBe(true);
        expect(review.impact.domains).toContain('resource.content');
        expect(review.commands).toEqual(expect.arrayContaining([
            expect.objectContaining({kind: 'resource.content.replace', domain: 'resource.content'})
        ]));
        expect(database.getDataURL('asset:paint-test')).not.toContain('rect');
        await session.commitReviewedChanges();
        expect(database.getDataURL('asset:paint-test')).toContain('rect');
        expect(session.getState().workingCopy).toEqual(expect.objectContaining({dirty: false, stale: false}));
        expect(session.getState().status).toBe('committed');
    });

    test('blocks content review when the source content revision changed after local editing', () => {
        const {database, session} = createFixture();
        session.applyWorkingCopyEdit({
            dataFormat: 'svg',
            content: {kind: 'svg-text', text: '<svg><path/></svg>'}
        });
        database.replaceContent('data:image/svg+xml,%3Csvg%3E%3Ccircle%2F%3E%3C%2Fsvg%3E');
        const review = session.reviewChanges();
        expect(review.canCommit).toBe(false);
        expect(review.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_CONTENT_SOURCE_STALE', blocking: true})
        ]));
    });

    test('marks the transient copy stale when Resource content changes externally and discard reloads it', () => {
        const {database, session} = createFixture();
        database.replaceContent('data:image/svg+xml,%3Csvg%3E%3Ccircle%2F%3E%3C%2Fsvg%3E');
        expect(session.getState().workingCopy.stale).toBe(true);
        session.discardWorkingCopy();
        expect(session.getState().workingCopy).toEqual(expect.objectContaining({dirty: false, stale: false}));
        expect(session.getWorkingCopyContent().content.dataUri).toContain('circle');
    });

    test('dispose revokes all Paint capability bindings', () => {
        const {providerRegistry, session} = createFixture();
        expect(providerRegistry.diagnoseTool(TOOL_IDS.PAINT).requests.every(item => item.bindingCount === 1)).toBe(true);
        session.dispose();
        expect(providerRegistry.diagnoseTool(TOOL_IDS.PAINT).requests.every(item => item.bindingCount === 0)).toBe(true);
        expect(() => session.getState()).toThrow(/not active/);
    });
});
