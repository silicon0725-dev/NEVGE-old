/* eslint-disable no-console, strict */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const walk = relative => {
    const base = path.join(ROOT, relative);
    const output = [];
    const visit = current => {
        for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory()) visit(target);
            else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) output.push(target);
        }
    };
    visit(base);
    return output;
};

const checks = [];
const check = (name, predicate, detail) => {
    let ok = false;
    let error = null;
    try {
        ok = Boolean(predicate());
    } catch (caught) {
        error = caught;
    }
    checks.push({detail: error ? error.message : detail, name, ok});
};

const vault = read('src/lib/credentials/legacy-credential-vault.js');
const tokenHelper = read('src/lib/credentials/legacy-bridge-token.js');
const migration = read('src/lib/credentials/legacy-credential-migration.js');
const playground = read('src/playground/import-first.js');
const libraryEntry = read('src/index.js');
const manifest = read('src/addons/addons/02agent/_manifest_entry.js');
const addonApi = read('src/addons/api.js');
const agentHost = read('src/addons/addons/02agent/userscript.js');
const safetyPolicy = read('src/addons/addons/02agent/legacySafetyPolicy.ts');
const toolRuntime = read('src/addons/addons/02agent/toolRuntime.ts');
const toolSchemas = read('src/addons/addons/02agent/toolSchemas.ts');
const useAgents = read('src/addons/addons/02agent/hooks/useAgents.ts');
const useBridge = read('src/addons/addons/02agent/hooks/useBridgeClient.ts');
const bridgeManifest = read('src/addons/addons/02agent/bridgeManifest.ts');
const useChat = read('src/addons/addons/02agent/hooks/useChat.ts');
const useChatSessions = read('src/addons/addons/02agent/hooks/useChatSessions.ts');
const agentIndex = read('src/addons/addons/02agent/index.tsx');
const chatArea = read('src/addons/addons/02agent/components/ChatArea.tsx');
const gitModal = read('src/containers/tw-git-modal.jsx');
const lexCertificate = JSON.parse(read('docs/architecture/extensions/LEX-G1-CERTIFICATE.json'));
const certificate = JSON.parse(read('docs/architecture/legacy-containment/LSC-G1-CERTIFICATE.json'));
const packageJSON = JSON.parse(read('package.json'));

check('LSC-G1 signed certificate matches the certified containment identities', () =>
    certificate.gate === 'LSC-G1' && certificate.status === 'PASS / CERTIFIED' &&
    certificate.identities && certificate.identities.credentialVault === 'ngvge.legacy-credential-vault@1' &&
    certificate.identities.legacyAgentContainment === 'ngvge.legacy-agent-containment@1' &&
    certificate.identities.legacyAgentMutationMode === 'read-only' &&
    certificate.machineCertification && certificate.machineCertification.total === 19,
'The signed certificate names the same credential/Agent containment identities enforced by code.');

check('LSC-0 containment baseline is still present', () =>
    exists('scripts/validate-lsc0-legacy-containment.js') &&
    exists('test/unit/lib/credentials/legacy-credential-vault.test.js') &&
    exists('test/unit/lib/credentials/legacy-credential-migration.test.js'),
'LSC-G1 certifies the completed LSC-0 implementation rather than replacing it.');

check('Credential vault remains page-memory-only and metadata-only', () =>
    vault.includes("LEGACY_CREDENTIAL_VAULT_ID = 'ngvge.legacy-credential-vault@1'") &&
    vault.includes('this._namespaces = new Map()') && vault.includes('getStatus ()') &&
    !/(?:localStorage|sessionStorage)\s*\.|indexedDB\s*\(|document\.cookie/.test(vault),
'Credential values stay in the ephemeral legacy vault; diagnostics expose counts only.');

check('Startup migration scrubs Agent, Bridge and Git plaintext secrets', () =>
    migration.includes('migrateAgents') && migration.includes('migrateBridge') && migration.includes('migrateGit') &&
    migration.includes("apiKey: ''") && migration.includes('disableCorsProxy: Boolean(record.disableCorsProxy)'),
'All known durable legacy secret stores are sanitized at startup.');

check('Credential scrub runs before both editor and library startup', () =>
    playground.includes('migrateLegacyPlaintextCredentials();') &&
    libraryEntry.includes('migrateLegacyPlaintextCredentials();'),
'Optional legacy UI does not need to be opened before plaintext cleanup occurs.');

check('Legacy 02Agent remains disabled-by-default danger/legacy compatibility UI', () =>
    manifest.includes('enabledByDefault: false') && manifest.includes("'danger'") && manifest.includes("'legacy'") &&
    manifest.includes('只读隔离模式'),
'Unsafe legacy Agent never becomes a default-on Workspace tool.');

check('Legacy 02Agent raw VM access remains an explicit LEX-certified quarantine', () =>
    lexCertificate.status === 'PASS / CERTIFIED' &&
    agentHost.includes('addon.tab.traps.vm') &&
    addonApi.includes('acquireLegacyVM(addonId, addonManifest)'),
'Raw VM is tolerated only as the bundled Legacy Addon quarantine already certified by LEX-G1.');

check('Agent host is explicitly labeled read-only and render failures are contained', () =>
    agentHost.includes("host.dataset.ngvgeLegacyAgentContainment = 'read-only'") &&
    agentHost.includes('LegacyAgentErrorBoundary'),
'Legacy Agent UI cannot claim native mutation authority and failures stay isolated.');

check('Mutation safety policy enumerates all legacy mutation families', () =>
    safetyPolicy.includes('ngvge.legacy-agent-containment@1') &&
    safetyPolicy.includes('NGVGE_LEGACY_AGENT_MUTATION_BLOCKED') &&
    ['applyPatch', 'createSpriteWithSvg', 'updateSpriteProperties', 'deleteCostume', 'deleteSprite',
        'installExtension', 'replaceBlocksRangeByUCF', 'replaceScriptByUCF', 'generateCodeFromUCF']
        .every(name => safetyPolicy.includes(`"${name}"`)),
'Mutation classification is centralized instead of being inferred ad hoc in individual tools.');

check('Model and bridge manifests withhold every classified mutating tool', () =>
    toolSchemas.includes('allScratchToolSchemas.filter') &&
    toolSchemas.includes('!isLegacyAgentMutationTool(schema.function.name)') &&
    bridgeManifest.includes('tools: scratchToolSchemas'),
'Mutating operations are not advertised to either provider tool calling or the local bridge.');

check('Both chat and bridge tool calls pass through the runtime mutation guard', () =>
    useChat.includes('callAITool(') && useBridge.includes('callAITool(') &&
    toolRuntime.indexOf('if (isLegacyAgentMutationTool(functionName))') < toolRuntime.indexOf('return dispatchAITool'),
'Defense in depth blocks mutation before a legacy implementation is dispatched.');

check('Legacy per-message project snapshot/rollback UI remains retired', () =>
    !useChat.includes('appendSessionSnapshot') && !useChat.includes('vm.toJSON()') &&
    !useChatSessions.includes('rollbackToMessage') && !agentIndex.includes('handleRestoreToUserMessage') &&
    !chatArea.includes('onRestoreToUserMessage'),
'Chat history cannot silently become a second project lifecycle/rollback authority.');

check('Agent durable metadata strips API keys and exports are credential-free', () =>
    useAgents.includes('stripAgentCredentials') && useAgents.includes('credentialsIncluded: false') &&
    useAgents.includes('JSON.stringify(hydrated.map(stripAgentCredentials))') &&
    !useAgents.includes('useStorageInfo<Agent[]>("AI_ASSISTANT_AGENTS"'),
'Agent provider secrets live only in page memory and are omitted from durable/exported metadata.');

check('Bridge durable metadata excludes token and uses fail-closed CSPRNG token generation', () =>
    useBridge.includes('persistBridgeMetadata') &&
    useBridge.includes('JSON.stringify({ enabled: Boolean(config.enabled), port:') &&
    useBridge.includes('createLegacyBridgeToken()') &&
    tokenHelper.includes('crypto.getRandomValues') &&
    tokenHelper.includes('NGVGE_LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE') &&
    !/Math\.random\s*\(|Date\.now\s*\(/.test(tokenHelper),
'Bridge tokens are ephemeral, CSPRNG-backed, and fail closed when secure randomness is unavailable.');

check('Bridge manifest exposes no credentials and declares read-only security semantics', () =>
    bridgeManifest.includes('apiKeysExposed: false') && bridgeManifest.includes('requiresToken: true') &&
    bridgeManifest.includes('dangerousOperationsMayMutateProject: false') &&
    bridgeManifest.includes('readOnly: true') &&
    !/\b(?:apiKey|token|password|secret)\s*:/.test(bridgeManifest.replace('apiKeysExposed:', '')),
'The bridge advertises policy/diagnostics but not credential material.');

check('Git durable auth metadata excludes token fields', () => {
    const start = gitModal.indexOf('const persistSavedAuthMetadata');
    const end = gitModal.indexOf('const readSavedAuth', start);
    if (start < 0 || end <= start) return false;
    const writer = gitModal.slice(start, end);
    return gitModal.includes('legacyCredentialVault') && !/\btoken\b/.test(writer);
}, 'Git token stays in page-memory credential vault; localStorage holds username/policy metadata only.');

check('Known credential-bearing durable writers are limited to sanitized metadata helpers', () => {
    const files = [
        'src/addons/addons/02agent/hooks/useAgents.ts',
        'src/addons/addons/02agent/hooks/useBridgeClient.ts',
        'src/containers/tw-git-modal.jsx'
    ];
    return files.every(relative => {
        const source = read(relative);
        return !/(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:apiKey|token|password|secret)/i.test(source);
    });
}, 'No known legacy credential surface writes an obvious secret field directly to browser storage.');

check('Credential/Agent containment production sources do not log secrets', () => {
    const files = [
        ...walk('src/lib/credentials'),
        ...walk('src/addons/addons/02agent')
    ];
    return files.every(file => {
        const source = fs.readFileSync(file, 'utf8');
        return !/console\.(?:log|debug|info|warn|error)\([^\n]*(?:apiKey|token|password|secret)/i.test(source);
    });
}, 'Credential values are not intentionally sent to console diagnostics.');

check('LSC-G1 package gates are registered', () =>
    typeof packageJSON.scripts['test:legacy-containment:lsc-g1-certification'] === 'string' &&
    typeof packageJSON.scripts['test:legacy-containment:lsc-g1-webpack'] === 'string' &&
    typeof packageJSON.scripts['test:legacy-containment:lsc-g1'] === 'string',
'Certification remains reproducible through stable npm entry points.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}\n`));
if (failed.length > 0) {
    process.stderr.write(`${JSON.stringify({failed}, null, 2)}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(`LSC-G1 Machine Certification PASS (${checks.length}/${checks.length}).\n`);
}
