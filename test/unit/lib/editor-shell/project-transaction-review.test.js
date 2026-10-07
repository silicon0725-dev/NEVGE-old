import {
    WORKSPACE_PROJECT_COMMAND_KINDS,
    createWorkspaceProjectCommandHost
} from '../../../../src/lib/editor-shell/project-command-host';
import {
    WORKSPACE_PROJECT_REVIEW_STATES,
    WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID,
    createWorkspaceProjectTransactionReviewService
} from '../../../../src/lib/editor-shell/project-transaction-review';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';

const RESOURCE_A = 'ngvge:resource:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RESOURCE_B = 'ngvge:resource:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOOL_ID = 'ngvge.tool.editor';

const clone = value => JSON.parse(JSON.stringify(value));

const createResourceDatabase = () => {
    let records = new Map([
        [RESOURCE_A, {id: 'asset:a', resourceId: RESOURCE_A, kind: 'costume', name: 'Hero', folderId: null}],
        [RESOURCE_B, {id: 'asset:b', resourceId: RESOURCE_B, kind: 'sound', name: 'Theme', folderId: 'folder:audio'}]
    ]);
    const folders = new Map([
        ['folder:actors', {id: 'folder:actors', name: 'Actors'}],
        ['folder:audio', {id: 'folder:audio', name: 'Audio'}]
    ]);
    const listeners = new Set();
    const historyPast = [];
    const historyFuture = [];
    const capture = () => Array.from(records.entries()).map(([key, value]) => [key, clone(value)]);
    const restore = snapshot => {
        records = new Map(snapshot.map(([key, value]) => [key, clone(value)]));
    };
    const emit = type => listeners.forEach(listener => listener({type}));
    return {
        getAssetIdForResourceId: resourceId => records.has(resourceId) ? records.get(resourceId).id : null,
        getResource: resourceId => records.has(resourceId) ? clone(records.get(resourceId)) : null,
        listFolders: () => Array.from(folders.values()).map(clone),
        renameAsset: (internalId, name) => {
            const record = Array.from(records.values()).find(item => item.id === internalId);
            if (!record || record.name === name) return false;
            record.name = name;
            emit('asset:rename');
            return true;
        },
        moveAsset: (internalId, folderId) => {
            const record = Array.from(records.values()).find(item => item.id === internalId);
            if (!record || record.folderId === folderId) return false;
            record.folderId = folderId;
            emit('asset:move');
            return true;
        },
        perform: async (label, action) => {
            const before = capture();
            const result = await action();
            historyPast.push({label, before, after: capture()});
            historyFuture.length = 0;
            emit('history:push');
            return result;
        },
        undo: () => {
            const entry = historyPast.pop();
            if (!entry) return false;
            historyFuture.push(entry);
            restore(entry.before);
            emit('history:undo');
            return true;
        },
        getHistoryState: () => ({
            canUndo: historyPast.length > 0,
            nextUndoLabel: historyPast.length ? historyPast[historyPast.length - 1].label : null
        }),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};

const createFixture = () => {
    const contextService = new WorkspaceContextService();
    const writer = contextService.claimWriter('project', 'ngvge.workspace-context-source.ws9h-test');
    writer.update({projectId: 'ngvge.project-context.g10'});
    const database = createResourceDatabase();
    const host = createWorkspaceProjectCommandHost({
        contextService,
        getResourceDatabase: () => database
    });
    const review = createWorkspaceProjectTransactionReviewService({
        projectCommandHost: host,
        contextService,
        getResourceDatabase: () => database
    });
    return {contextService, writer, database, host, review};
};

const proposalInput = commands => ({
    schemaVersion: 1,
    label: 'Review batch',
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

describe('WS-9H Project Transaction Review / Diagnostics', () => {
    test('creates a portable non-authoritative review service', () => {
        const {review} = createFixture();
        expect(review.id).toBe(WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID);
        expect(review.getState()).toEqual(expect.objectContaining({
            currentProjectId: 'ngvge.project-context.g10',
            resourceAuthorityAvailable: true
        }));
        expect(review.getState().authority).toBeUndefined();
    });

    test('previews sequential Resource metadata impact without mutating Resource authority', () => {
        const {host, review, database} = createFixture();
        const proposal = host.createProposal(proposalInput([
            rename(RESOURCE_A, 'Hero Prime'),
            move(RESOURCE_A, 'folder:actors'),
            rename(RESOURCE_A, 'Hero Final')
        ]), {toolId: TOOL_ID});
        const snapshot = review.reviewProposal(proposal.proposalId, {toolId: TOOL_ID});
        expect(snapshot.state).toBe(WORKSPACE_PROJECT_REVIEW_STATES.READY);
        expect(snapshot.canCommit).toBe(true);
        expect(snapshot.impact).toEqual(expect.objectContaining({
            commandCount: 3,
            changedCommandCount: 3,
            destructive: false,
            reversible: true
        }));
        expect(snapshot.commands[0]).toEqual(expect.objectContaining({
            before: expect.objectContaining({name: 'Hero', folderId: null}),
            after: expect.objectContaining({name: 'Hero Prime', folderId: null})
        }));
        expect(snapshot.commands[1]).toEqual(expect.objectContaining({
            before: expect.objectContaining({name: 'Hero Prime', folderId: null}),
            after: expect.objectContaining({name: 'Hero Prime', folderId: 'folder:actors'})
        }));
        expect(snapshot.commands[2].before.name).toBe('Hero Prime');
        expect(database.getResource(RESOURCE_A)).toEqual(expect.objectContaining({name: 'Hero', folderId: null}));
    });

    test('reports no-op commands without blocking a valid proposal', () => {
        const {host, review} = createFixture();
        const proposal = host.createProposal(proposalInput([rename(RESOURCE_A, 'Hero')]), {toolId: TOOL_ID});
        const snapshot = review.reviewProposal(proposal.proposalId, {toolId: TOOL_ID});
        expect(snapshot.canCommit).toBe(true);
        expect(snapshot.impact.noOpCommandCount).toBe(1);
        expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_NO_OP',
                severity: 'info',
                blocking: false
            })
        ]));
    });

    test('blocks proposal review when a Resource or destination folder is unavailable', () => {
        const {host, review} = createFixture();
        const missingResource = 'ngvge:resource:cccccccc-cccc-4ccc-8ccc-cccccccccccc';
        const proposal = host.createProposal(proposalInput([
            rename(missingResource, 'Missing'),
            move(RESOURCE_A, 'folder:missing')
        ]), {toolId: TOOL_ID});
        const snapshot = review.reviewProposal(proposal.proposalId, {toolId: TOOL_ID});
        expect(snapshot.state).toBe(WORKSPACE_PROJECT_REVIEW_STATES.BLOCKED);
        expect(snapshot.canCommit).toBe(false);
        expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_NOT_FOUND', blocking: true}),
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_FOLDER_NOT_FOUND', blocking: true})
        ]));
    });

    test('marks proposal review stale after Project Context switches', () => {
        const {host, review, writer} = createFixture();
        const proposal = host.createProposal(proposalInput([rename(RESOURCE_A, 'Hero Prime')]), {toolId: TOOL_ID});
        writer.update({projectId: 'ngvge.project-context.g11'});
        const snapshot = review.reviewProposal(proposal.proposalId, {toolId: TOOL_ID});
        expect(snapshot.state).toBe(WORKSPACE_PROJECT_REVIEW_STATES.STALE);
        expect(snapshot.canCommit).toBe(false);
        expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_STALE_PROJECT_CONTEXT'})
        ]));
    });

    test('transaction review exposes exact rollback readiness and detects newer history conflict', async () => {
        const {host, review, database} = createFixture();
        const proposal = host.createProposal(proposalInput([rename(RESOURCE_A, 'Hero Prime')]), {toolId: TOOL_ID});
        const transaction = await host.commit(proposal.proposalId, {toolId: TOOL_ID});
        const ready = review.reviewTransaction(transaction.transactionId, {toolId: TOOL_ID});
        expect(ready.canRollback).toBe(true);
        expect(ready.rollbackAvailability).toEqual({available: true, code: null, message: null});

        await database.perform('External Resource Change', () => database.renameAsset('asset:b', 'Theme 2'));
        const conflicted = review.reviewTransaction(transaction.transactionId, {toolId: TOOL_ID});
        expect(conflicted.canRollback).toBe(false);
        expect(conflicted.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT',
                severity: 'warning'
            })
        ]));
    });

    test('transaction review reports failed transaction diagnostics', async () => {
        const {host, review} = createFixture();
        const proposal = host.createProposal(proposalInput([move(RESOURCE_A, 'folder:missing')]), {toolId: TOOL_ID});
        let transactionId = null;
        try {
            await host.commit(proposal.proposalId, {toolId: TOOL_ID});
        } catch (error) {
            transactionId = error.transaction.transactionId;
        }
        const snapshot = review.reviewTransaction(transactionId, {toolId: TOOL_ID});
        expect(snapshot.state).toBe(WORKSPACE_PROJECT_REVIEW_STATES.FAILED);
        expect(snapshot.canRollback).toBe(false);
        expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_TRANSACTION_FAILED', severity: 'error'})
        ]));
    });

    test('review queries are Tool-scoped and cannot leak another Tool transaction metadata', async () => {
        const {host, review} = createFixture();
        const proposal = host.createProposal(proposalInput([rename(RESOURCE_A, 'Hero Prime')]), {toolId: TOOL_ID});
        expect(() => review.reviewProposal(proposal.proposalId, {toolId: 'ngvge.tool.agent'})).toThrow(
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH'})
        );
        const transaction = await host.commit(proposal.proposalId, {toolId: TOOL_ID});
        expect(() => review.reviewTransaction(transaction.transactionId, {toolId: 'ngvge.tool.agent'})).toThrow(
            expect.objectContaining({code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_OWNER_MISMATCH'})
        );
    });

    test('review service publishes source changes and disposes without gaining mutation APIs', () => {
        const {host, review} = createFixture();
        const events = [];
        review.subscribe(event => events.push(event.type));
        host.createProposal(proposalInput([rename(RESOURCE_A, 'Hero Prime')]), {toolId: TOOL_ID});
        expect(events).toContain('source:project-command');
        expect(review.commit).toBeUndefined();
        expect(review.rollback).toBeUndefined();
        expect(review.dispose()).toBe(true);
        expect(() => review.getState()).toThrow(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_DISPOSED'
        }));
    });
});
