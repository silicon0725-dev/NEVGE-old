'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_LSC0_LEGACY_CONTAINMENT_FAILED';
    throw error;
};
const requireFragments = (name, source, fragments) => {
    fragments.forEach(fragment => {
        if (!source.includes(fragment)) fail(`${name} missing containment contract: ${fragment}`);
    });
};
const forbidFragments = (name, source, fragments) => {
    fragments.forEach(fragment => {
        if (source.includes(fragment)) fail(`${name} retains forbidden legacy behavior: ${fragment}`);
    });
};

const vault = read('src/lib/credentials/legacy-credential-vault.js');
const credentialMigration = read('src/lib/credentials/legacy-credential-migration.js');
const playgroundImportFirst = read('src/playground/import-first.js');
const libraryEntry = read('src/index.js');
const agentManifest = read('src/addons/addons/02agent/_manifest_entry.js');
const agentUserscript = read('src/addons/addons/02agent/userscript.js');
const safetyPolicy = read('src/addons/addons/02agent/legacySafetyPolicy.ts');
const toolRuntime = read('src/addons/addons/02agent/toolRuntime.ts');
const toolSchemas = read('src/addons/addons/02agent/toolSchemas.ts');
const useAgents = read('src/addons/addons/02agent/hooks/useAgents.ts');
const useBridgeClient = read('src/addons/addons/02agent/hooks/useBridgeClient.ts');
const bridgeManifest = read('src/addons/addons/02agent/bridgeManifest.ts');
const useChat = read('src/addons/addons/02agent/hooks/useChat.ts');
const useChatSessions = read('src/addons/addons/02agent/hooks/useChatSessions.ts');
const agentIndex = read('src/addons/addons/02agent/index.tsx');
const chatArea = read('src/addons/addons/02agent/components/ChatArea.tsx');
const gitModal = read('src/containers/tw-git-modal.jsx');

requireFragments('Credential vault', vault, [
    "LEGACY_CREDENTIAL_VAULT_ID = 'ngvge.legacy-credential-vault@1'",
    'class LegacyCredentialVault',
    'this._namespaces = new Map()',
    'getStatus ()'
]);
forbidFragments('Credential vault', vault, ['localStorage.setItem(', 'localStorage.getItem(']);
requireFragments('Startup credential migration', credentialMigration, [
    'migrateLegacyPlaintextCredentials',
    'migrateAgents',
    'migrateBridge',
    'migrateGit',
    "apiKey: ''",
    'disableCorsProxy: Boolean(record.disableCorsProxy)'
]);
requireFragments('Editor startup credential scrub', playgroundImportFirst, [
    "legacy-credential-migration",
    'migrateLegacyPlaintextCredentials();'
]);
requireFragments('Library startup credential scrub', libraryEntry, [
    "legacy-credential-migration",
    'migrateLegacyPlaintextCredentials();'
]);

requireFragments('Legacy 02Agent manifest', agentManifest, [
    'enabledByDefault: false',
    "'danger'",
    "'legacy'",
    '只读隔离模式'
]);
requireFragments('Legacy 02Agent host', agentUserscript, [
    'LegacyAgentErrorBoundary',
    "host.dataset.ngvgeLegacyAgentContainment = 'read-only'",
    '<LegacyAgentErrorBoundary>'
]);

requireFragments('Agent safety policy', safetyPolicy, [
    'ngvge.legacy-agent-containment@1',
    'NGVGE_LEGACY_AGENT_MUTATION_BLOCKED',
    'LEGACY_AGENT_MUTATING_TOOL_NAMES',
    'applyPatch',
    'deleteCostume',
    'deleteSprite',
    'installExtension'
]);
requireFragments('Agent tool runtime', toolRuntime, [
    'isLegacyAgentMutationTool(functionName)',
    'throw createLegacyAgentMutationBlockedError(functionName)'
]);
forbidFragments('Agent tool runtime', toolRuntime, [
    'enqueueMutation(() => dispatchAITool',
    'MUTATING_TOOLS.has(functionName)'
]);
requireFragments('Agent tool schemas', toolSchemas, [
    'const allScratchToolSchemas = [',
    '!isLegacyAgentMutationTool(schema.function.name)'
]);

requireFragments('Agent credential persistence', useAgents, [
    'legacyCredentialVault',
    'stripAgentCredentials',
    'credentialsIncluded: false',
    'JSON.stringify(hydrated.map(stripAgentCredentials))',
    'immediately remove any legacy plaintext API keys'
]);
forbidFragments('Agent credential persistence', useAgents, [
    'useStorageInfo<Agent[]>("AI_ASSISTANT_AGENTS"'
]);

requireFragments('Bridge credential persistence', useBridgeClient, [
    'legacyCredentialVault',
    'persistBridgeMetadata',
    'JSON.stringify({ enabled: Boolean(config.enabled), port:',
    'rewrite legacy bridge config without its plaintext token'
]);
forbidFragments('Bridge credential persistence', useBridgeClient, [
    'JSON.stringify(config)'
]);
requireFragments('Bridge manifest', bridgeManifest, [
    'readOnly: true',
    'dangerousOperationsMayMutateProject: false',
    'mutationMode: LEGACY_AGENT_MUTATION_MODE'
]);

requireFragments('Legacy Agent read-only prompt', useChat, [
    'This legacy Agent is READ-ONLY',
    'Mutating tools are intentionally unavailable and runtime-blocked',
    'future NGVGE ChangeSet/Authority path'
]);
forbidFragments('Legacy Agent chat history', useChat, [
    'appendSessionSnapshot',
    'vm.toJSON()'
]);
forbidFragments('Legacy Agent session history', useChatSessions, [
    'SessionSnapshot',
    'snapshotsRef',
    'rollbackToMessage',
    'appendSessionSnapshot'
]);
forbidFragments('Legacy Agent UI restore', agentIndex, [
    'handleRestoreToUserMessage',
    'rollbackToMessage',
    'vm.loadProject('
]);
forbidFragments('Legacy Agent message restore control', chatArea, [
    'UndoIcon',
    'onRestoreToUserMessage',
    'hasSnapshot'
]);

requireFragments('Git credential persistence', gitModal, [
    'legacyCredentialVault',
    'GIT_CREDENTIAL_NAMESPACE = LEGACY_GIT_CREDENTIAL_NAMESPACE',
    'persistSavedAuthMetadata',
    'token: legacyCredentialVault.get(GIT_CREDENTIAL_NAMESPACE, remoteUrl)'
]);
const metadataWriterStart = gitModal.indexOf('const persistSavedAuthMetadata');
const metadataWriterEnd = gitModal.indexOf('const readSavedAuth', metadataWriterStart);
if (metadataWriterStart === -1 || metadataWriterEnd === -1) fail('Git durable metadata writer not found');
const metadataWriter = gitModal.slice(metadataWriterStart, metadataWriterEnd);
if (/\btoken\b/.test(metadataWriter)) fail('Git durable metadata writer must not persist token fields');

process.stdout.write('LSC-0 Credentials & Unsafe Agent Containment PASS.\n');
process.stdout.write(JSON.stringify({
    credentialVault: 'ngvge.legacy-credential-vault@1',
    legacyAgentDefaultEnabled: false,
    legacyAgentMutationMode: 'read-only',
    destructiveToolAdvertisement: false,
    destructiveToolRuntimeExecution: false,
    perMessageProjectSnapshot: false,
    messageProjectReloadRollback: false,
    agentApiKeyDurability: 'page-memory-only',
    bridgeTokenDurability: 'page-memory-only',
    gitTokenDurability: 'page-memory-only',
    startupPlaintextCredentialScrub: true,
    finalSecureCredentialServiceDeferred: true,
    finalAgentChangeSetAuthorityDeferred: true
}, null, 2) + '\n');
