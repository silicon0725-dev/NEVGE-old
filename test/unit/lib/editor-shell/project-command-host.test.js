import {
    WORKSPACE_PROJECT_COMMAND_HOST_ID,
    WORKSPACE_PROJECT_COMMAND_KINDS,
    WORKSPACE_PROJECT_TRANSACTION_STATES,
    createWorkspaceProjectCommandHost,
    normalizeProjectCommand
} from '../../../../src/lib/editor-shell/project-command-host';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';

const RESOURCE_A = 'ngvge:resource:11111111-1111-4111-8111-111111111111';
const RESOURCE_B = 'ngvge:resource:22222222-2222-4222-8222-222222222222';

const clone = value => JSON.parse(JSON.stringify(value));

const createResourceDatabase = () => {
    let records = new Map([
        [RESOURCE_A, {id: 'asset:a', resourceId: RESOURCE_A, kind: 'costume', name: 'Hero', folderId: null, dataFormat: 'svg', bitmapResolution: 1, rotationCenterX: 0, rotationCenterY: 0}],
        [RESOURCE_B, {id: 'asset:b', resourceId: RESOURCE_B, kind: 'costume', name: 'Enemy', folderId: 'folder:actors', dataFormat: 'svg', bitmapResolution: 1, rotationCenterX: 0, rotationCenterY: 0}]
    ]);
    const folders = new Map([['folder:actors', {id: 'folder:actors', name: 'Actors'}]]);
    const historyPast = [];
    let contentRevision = 0;
    let dataUri = 'data:image/svg+xml,%3Csvg%2F%3E';
    const historyFuture = [];
    const capture = () => ({
        records: Array.from(records.entries()).map(([key, value]) => [key, clone(value)]),
        contentRevision,
        dataUri
    });
    const restore = snapshot => {
        records = new Map(snapshot.records.map(([key, value]) => [key, clone(value)]));
        contentRevision = snapshot.contentRevision;
        dataUri = snapshot.dataUri;
    };
    return {
        getAssetIdForResourceId: resourceId => records.has(resourceId) ? records.get(resourceId).id : null,
        getResource: resourceId => records.has(resourceId) ? clone(records.get(resourceId)) : null,
        getDataURL: internalId => internalId === 'asset:a' ? dataUri : null,
        getResourceContentRevision: resourceId => resourceId === RESOURCE_A ? contentRevision : 0,
        listFolders: () => Array.from(folders.values()).map(clone),
        renameAsset: (internalId, name) => {
            const record = Array.from(records.values()).find(item => item.id === internalId);
            if (!record) return false;
            if (record.name === name) return false;
            record.name = name;
            return true;
        },
        replaceImageResourceContent: async (resourceId, command) => {
            if (resourceId !== RESOURCE_A) return false;
            if (command.expectedSourceAuthorityRevision !== contentRevision) {
                const error = new Error('stale content');
                error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_SOURCE_STALE';
                throw error;
            }
            dataUri = command.content.kind === 'data-uri' ? command.content.dataUri :
                `data:image/svg+xml,${encodeURIComponent(command.content.text)}`;
            contentRevision += 1;
            return true;
        },
        moveAsset: (internalId, folderId) => {
            const record = Array.from(records.values()).find(item => item.id === internalId);
            if (!record) return false;
            if (record.folderId === folderId) return false;
            record.folderId = folderId;
            return true;
        },
        perform: async (label, action) => {
            const before = capture();
            const result = await action();
            historyPast.push({label, before, after: capture()});
            historyFuture.length = 0;
            return result;
        },
        undo: () => {
            const entry = historyPast.pop();
            if (!entry) return false;
            historyFuture.push(entry);
            restore(entry.before);
            return true;
        },
        getHistoryState: () => ({
            canUndo: historyPast.length > 0,
            nextUndoLabel: historyPast.length ? historyPast[historyPast.length - 1].label : null
        })
    };
};

const createFixture = () => {
    const contextService = new WorkspaceContextService();
    const writer = contextService.claimWriter('project', 'ngvge.workspace-context-source.ws9g-test');
    writer.update({projectId: 'ngvge.project-context.g7'});
    const database = createResourceDatabase();
    const host = createWorkspaceProjectCommandHost({
        contextService,
        getResourceDatabase: () => database
    });
    return {contextService, writer, database, host};
};

const proposal = commands => ({
    schemaVersion: 1,
    label: 'Project metadata batch',
    commands
});

const rename = (resourceId, name) => ({
    schemaVersion: 1,
    kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME,
    resourceId,
    name
});

const move = (resourceId, folderId) => ({
    schemaVersion: 1,
    kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_MOVE,
    resourceId,
    folderId
});

const replaceContent = (resourceId, text, expectedSourceAuthorityRevision = 0) => ({
    schemaVersion: 1,
    kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE,
    resourceId,
    expectedSourceAuthorityRevision,
    dataFormat: 'svg',
    bitmapResolution: 1,
    rotationCenterX: 5,
    rotationCenterY: 6,
    content: {kind: 'svg-text', text}
});

describe('WS-9G Workspace Project Command Host', () => {
    test('owns only Project command transaction authority and exposes reversible v1 commands', () => {
        const {host} = createFixture();
        expect(host.id).toBe(WORKSPACE_PROJECT_COMMAND_HOST_ID);
        expect(host.getSupportedCommands()).toEqual(['resource.rename', 'resource.move', 'resource.content.replace']);
        expect(host.getAvailability()).toEqual({available: true, code: null, message: null});
        expect(host.getState().authority).toEqual(expect.objectContaining({
            authorityId: 'authority:ngvge.workspace-project-command-host',
            domain: 'ngvge.project.command.transaction',
            mode: 'writer'
        }));
    });

    test('normalization rejects raw authority fields and irreversible delete shortcuts', () => {
        expect(normalizeProjectCommand(rename(RESOURCE_A, 'Hero 2'))).toEqual(rename(RESOURCE_A, 'Hero 2'));
        expect(() => normalizeProjectCommand({
            schemaVersion: 1,
            kind: 'resource.delete',
            resourceId: RESOURCE_A
        })).toThrow(expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_KIND_UNSUPPORTED'}));
        expect(() => normalizeProjectCommand(Object.assign(rename(RESOURCE_A, 'Hero 2'), {
            vm: {loadProject: jest.fn()}
        }))).toThrow(expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_RAW_AUTHORITY_FORBIDDEN'}));
    });

    test('normalizes portable bounded image content replacement with source revision precondition', () => {
        const normalized = normalizeProjectCommand(replaceContent(RESOURCE_A, '<svg><rect/></svg>'));
        expect(normalized).toEqual(expect.objectContaining({
            kind: 'resource.content.replace',
            resourceId: RESOURCE_A,
            expectedSourceAuthorityRevision: 0,
            dataFormat: 'svg',
            byteLength: expect.any(Number)
        }));
        expect(normalized.content).toEqual({kind: 'svg-text', text: '<svg><rect/></svg>'});
    });

    test('commits and rolls back image content replacement through the Project transaction adapter', async () => {
        const {host, database} = createFixture();
        const created = host.createProposal(proposal([replaceContent(RESOURCE_A, '<svg><rect/></svg>')]), {
            toolId: 'ngvge.tool.editor'
        });
        const transaction = await host.commit(created.proposalId, {toolId: 'ngvge.tool.editor'});
        expect(transaction.state).toBe(WORKSPACE_PROJECT_TRANSACTION_STATES.COMMITTED);
        expect(database.getDataURL('asset:a')).toContain('rect');
        await host.rollback(transaction.transactionId, {toolId: 'ngvge.tool.editor'});
        expect(database.getDataURL('asset:a')).not.toContain('rect');
    });

    test('proposal is Tool-owned and Project-context scoped', () => {
        const {host} = createFixture();
        const created = host.createProposal(proposal([rename(RESOURCE_A, 'Hero 2')]), {toolId: 'ngvge.tool.editor'});
        expect(created).toEqual(expect.objectContaining({
            projectId: 'ngvge.project-context.g7',
            toolId: 'ngvge.tool.editor',
            state: 'proposed'
        }));
        expect(created.commands).toEqual([rename(RESOURCE_A, 'Hero 2')]);
        expect(Object.isFrozen(created)).toBe(true);
        expect(() => host.getProposal(created.proposalId, {toolId: 'ngvge.tool.agent'})).toThrow(
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH'})
        );
    });

    test('commits a multi-command Resource metadata transaction as one history operation', async () => {
        const {host, database} = createFixture();
        const created = host.createProposal(proposal([
            rename(RESOURCE_A, 'Hero Prime'),
            move(RESOURCE_A, 'folder:actors')
        ]), {toolId: 'ngvge.tool.editor'});
        const transaction = await host.commit(created.proposalId, {toolId: 'ngvge.tool.editor'});
        expect(transaction.state).toBe(WORKSPACE_PROJECT_TRANSACTION_STATES.COMMITTED);
        expect(transaction.commandCount).toBe(2);
        expect(transaction.appliedCount).toBe(2);
        expect(database.getResource(RESOURCE_A)).toEqual(expect.objectContaining({
            name: 'Hero Prime',
            folderId: 'folder:actors'
        }));
        expect(database.getHistoryState().nextUndoLabel).toContain(transaction.transactionId);
        expect(() => host.getTransaction(transaction.transactionId, {toolId: 'ngvge.tool.agent'})).toThrow(
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_OWNER_MISMATCH'})
        );
    });

    test('explicit rollback restores the exact committed Resource snapshot when transaction is latest history', async () => {
        const {host, database} = createFixture();
        const created = host.createProposal(proposal([
            rename(RESOURCE_A, 'Hero Prime'),
            move(RESOURCE_B, null)
        ]), {toolId: 'ngvge.tool.editor'});
        const transaction = await host.commit(created.proposalId, {toolId: 'ngvge.tool.editor'});
        const rolledBack = await host.rollback(transaction.transactionId, {toolId: 'ngvge.tool.editor'});
        expect(rolledBack.state).toBe(WORKSPACE_PROJECT_TRANSACTION_STATES.ROLLED_BACK);
        expect(database.getResource(RESOURCE_A).name).toBe('Hero');
        expect(database.getResource(RESOURCE_B).folderId).toBe('folder:actors');
    });

    test('failed commit compensates prior mutations before leaving the Resource transaction boundary', async () => {
        const {host, database} = createFixture();
        const created = host.createProposal(proposal([
            rename(RESOURCE_A, 'Hero Prime'),
            move(RESOURCE_B, 'folder:missing')
        ]), {toolId: 'ngvge.tool.editor'});
        await expect(host.commit(created.proposalId, {toolId: 'ngvge.tool.editor'})).rejects.toMatchObject({
            code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_FAILED'
        });
        expect(database.getResource(RESOURCE_A).name).toBe('Hero');
        expect(database.getHistoryState().canUndo).toBe(false);
    });

    test('commit rejects stale Project Context and cross-Tool proposal ownership', async () => {
        const {host, writer} = createFixture();
        const created = host.createProposal(proposal([rename(RESOURCE_A, 'Hero Prime')]), {
            toolId: 'ngvge.tool.editor'
        });
        await expect(host.commit(created.proposalId, {toolId: 'ngvge.tool.agent'})).rejects.toMatchObject({
            code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH'
        });
        writer.update({projectId: 'ngvge.project-context.g8'});
        await expect(host.commit(created.proposalId, {toolId: 'ngvge.tool.editor'})).rejects.toMatchObject({
            code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_STALE_PROJECT_CONTEXT'
        });
    });

    test('rollback fails visibly when newer Resource history exists', async () => {
        const {host, database} = createFixture();
        const created = host.createProposal(proposal([rename(RESOURCE_A, 'Hero Prime')]), {
            toolId: 'ngvge.tool.editor'
        });
        const transaction = await host.commit(created.proposalId, {toolId: 'ngvge.tool.editor'});
        await database.perform('External Resource Change', () => database.renameAsset('asset:b', 'Enemy Prime'));
        await expect(host.rollback(transaction.transactionId, {toolId: 'ngvge.tool.editor'})).rejects.toMatchObject({
            code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT'
        });
        expect(host.getTransaction(transaction.transactionId).state).toBe('rollback-failed');
    });
    test('diagnostic availability mirrors commit and rollback preconditions without mutating state', async () => {
        const {host, database} = createFixture();
        const created = host.createProposal(proposal([rename(RESOURCE_A, 'Hero Prime')]), {
            toolId: 'ngvge.tool.editor'
        });
        expect(host.getCommitAvailability(created.proposalId, {toolId: 'ngvge.tool.editor'})).toEqual({
            available: true,
            code: null,
            message: null
        });
        expect(database.getResource(RESOURCE_A).name).toBe('Hero');
        const transaction = await host.commit(created.proposalId, {toolId: 'ngvge.tool.editor'});
        expect(host.getCommitAvailability(created.proposalId, {toolId: 'ngvge.tool.editor'})).toEqual(expect.objectContaining({
            available: false,
            code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_NOT_COMMITTABLE'
        }));
        expect(host.getRollbackAvailability(transaction.transactionId, {toolId: 'ngvge.tool.editor'})).toEqual({
            available: true,
            code: null,
            message: null
        });
        await database.perform('External Resource Change', () => database.renameAsset('asset:b', 'Enemy Prime'));
        expect(host.getRollbackAvailability(transaction.transactionId, {toolId: 'ngvge.tool.editor'})).toEqual(expect.objectContaining({
            available: false,
            code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT'
        }));
    });

    test('diagnostic availability is Tool-scoped and Project-context aware', async () => {
        const {host, writer} = createFixture();
        const created = host.createProposal(proposal([rename(RESOURCE_A, 'Hero Prime')]), {
            toolId: 'ngvge.tool.editor'
        });
        expect(() => host.getCommitAvailability(created.proposalId, {toolId: 'ngvge.tool.agent'})).toThrow(
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH'})
        );
        writer.update({projectId: 'ngvge.project-context.g8'});
        expect(host.getCommitAvailability(created.proposalId, {toolId: 'ngvge.tool.editor'})).toEqual(expect.objectContaining({
            available: false,
            code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_STALE_PROJECT_CONTEXT'
        }));
    });

});
