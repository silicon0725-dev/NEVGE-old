#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const targetUrl = process.env.NGVGE_BROWSER_URL || process.argv[2] || 'http://127.0.0.1:8601';

const isExecutableFile = candidate => {
    if (!candidate || typeof candidate !== 'string') return false;
    try {
        return fs.statSync(candidate).isFile();
    } catch {
        return false;
    }
};

const findOnPath = commandNames => {
    const pathValue = process.env.PATH || '';
    const directories = pathValue.split(path.delimiter).filter(Boolean);
    const extensions = process.platform === 'win32' ?
        (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
    for (const directory of directories) {
        for (const commandName of commandNames) {
            const hasExtension = process.platform !== 'win32' || /\.[a-z0-9]+$/i.test(commandName);
            const variants = hasExtension ? [commandName] : extensions.map(extension => `${commandName}${extension}`);
            for (const variant of variants) {
                const candidate = path.join(directory, variant);
                if (isExecutableFile(candidate)) return candidate;
            }
        }
    }
    return null;
};

const getBrowserCandidates = () => {
    const home = os.homedir();
    if (process.platform === 'win32') {
        const roots = [
            process.env.PROGRAMFILES,
            process.env['PROGRAMFILES(X86)'],
            process.env.LOCALAPPDATA
        ].filter(Boolean);
        const candidates = [];
        for (const root of roots) {
            candidates.push(
                path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join(root, 'Chromium', 'Application', 'chrome.exe'),
                path.join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
            );
        }
        return candidates;
    }
    if (process.platform === 'darwin') {
        return [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            path.join(home, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
            path.join(home, 'Applications', 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'),
            path.join(home, 'Applications', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
        ];
    }
    return [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/microsoft-edge',
        '/usr/bin/microsoft-edge-stable',
        '/usr/bin/brave-browser',
        '/snap/bin/chromium'
    ];
};

const resolveBrowserExecutable = () => {
    const explicit = process.env.NGVGE_BROWSER_EXECUTABLE || process.env.CHROME_BIN;
    if (explicit) {
        const resolved = path.resolve(explicit);
        if (!isExecutableFile(resolved)) {
            const error = new Error(`Configured Chromium-compatible browser executable not found: ${resolved}`);
            error.code = 'NGVGE_BROWSER_EXECUTABLE_MISSING';
            error.browserExecutable = resolved;
            error.browserSource = process.env.NGVGE_BROWSER_EXECUTABLE ? 'NGVGE_BROWSER_EXECUTABLE' : 'CHROME_BIN';
            throw error;
        }
        return {
            executable: resolved,
            source: process.env.NGVGE_BROWSER_EXECUTABLE ? 'NGVGE_BROWSER_EXECUTABLE' : 'CHROME_BIN'
        };
    }

    const candidates = getBrowserCandidates();
    const direct = candidates.find(isExecutableFile);
    if (direct) return {executable: direct, source: 'platform-default'};

    const fromPath = findOnPath(process.platform === 'win32' ?
        ['chrome', 'msedge', 'chromium', 'brave'] :
        ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'microsoft-edge', 'brave-browser']);
    if (fromPath) return {executable: fromPath, source: 'PATH'};

    const error = new Error(`No Chromium-compatible browser executable was found for ${process.platform}. Set NGVGE_BROWSER_EXECUTABLE to Chrome, Edge, Chromium, or Brave.`);
    error.code = 'NGVGE_BROWSER_EXECUTABLE_MISSING';
    error.attemptedBrowserExecutables = candidates;
    throw error;
};

const waitFor = async (predicate, {timeoutMs = 30000, intervalMs = 100} = {}) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const value = await predicate();
        if (value) return value;
        await sleep(intervalMs);
    }
    throw new Error(`Timed out after ${timeoutMs} ms.`);
};

const isTransientWindowsFileLockError = error => Boolean(error &&
    ['EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(error.code));

const readDevToolsPort = async ({profile, getStderr, timeoutMs = 15000}) => {
    const portFile = path.join(profile, 'DevToolsActivePort');
    return waitFor(() => {
        // Chrome/Edge can create DevToolsActivePort before releasing its Windows file lock.
        // Treat the file as ready only after it can actually be opened and contains a valid port.
        try {
            const text = fs.readFileSync(portFile, 'utf8');
            const [firstLine] = text.trim().split(/\r?\n/);
            const port = Number(firstLine);
            if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
        } catch (error) {
            if (!isTransientWindowsFileLockError(error)) throw error;
        }

        // Fallback for Windows antivirus/profile locks: Chromium also prints the endpoint to stderr.
        const stderr = typeof getStderr === 'function' ? String(getStderr() || '') : '';
        const match = stderr.match(/DevTools listening on ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\//i);
        if (match) {
            const port = Number(match[1]);
            if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
        }
        return null;
    }, {timeoutMs, intervalMs: 75});
};

const waitForChildExit = async (child, timeoutMs = 3000) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        sleep(timeoutMs)
    ]);
};

const removeDirectoryWithRetry = async (directory, {attempts = 12, delayMs = 100} = {}) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            fs.rmSync(directory, {force: true, recursive: true});
            return true;
        } catch (error) {
            if (!isTransientWindowsFileLockError(error)) throw error;
            await sleep(delayMs * (attempt + 1));
        }
    }
    // A browser/AV process may retain a lock briefly after verification. The profile is unique
    // and lives under the OS temp directory, so cleanup failure must not invalidate the proof.
    return false;
};

class CDPClient {
    constructor (url) {
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        this.socket = new WebSocket(url);
    }

    async open () {
        await new Promise((resolve, reject) => {
            this.socket.addEventListener('open', resolve, {once: true});
            this.socket.addEventListener('error', reject, {once: true});
        });
        this.socket.addEventListener('message', event => {
            const message = JSON.parse(String(event.data));
            if (message.id) {
                const pending = this.pending.get(message.id);
                if (!pending) return;
                this.pending.delete(message.id);
                if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
                else pending.resolve(message.result || {});
                return;
            }
            const handlers = this.listeners.get(message.method);
            if (handlers) handlers.forEach(handler => handler(message.params || {}));
        });
    }

    command (method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, {reject, resolve});
            this.socket.send(JSON.stringify({id, method, params}));
        });
    }

    once (method, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const handlers = this.listeners.get(method) || new Set();
            const timer = setTimeout(() => {
                handlers.delete(handler);
                reject(new Error(`Timed out waiting for CDP event ${method}.`));
            }, timeoutMs);
            const handler = params => {
                clearTimeout(timer);
                handlers.delete(handler);
                resolve(params);
            };
            handlers.add(handler);
            this.listeners.set(method, handlers);
        });
    }

    close () {
        try { this.socket.close(); } catch { /* ignore */ }
    }
}

const evaluate = async (client, expression, options = {}) => {
    const result = await client.command('Runtime.evaluate', {
        awaitPromise: options.awaitPromise !== false,
        expression,
        returnByValue: true
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
    }
    return result.result ? result.result.value : undefined;
};

const run = async () => {
    const browserResolution = resolveBrowserExecutable();
    const executable = browserResolution.executable;

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ngvge-0009e-browser-'));
    const browser = spawn(executable, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank'
    ], {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    browser.stderr.on('data', chunk => {
        stderr += chunk.toString();
        if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });

    let client = null;
    try {
        const port = await readDevToolsPort({
            profile,
            getStderr: () => stderr,
            timeoutMs: 15000
        });
        const targets = await waitFor(async () => {
            try {
                const response = await fetch(`http://127.0.0.1:${port}/json/list`);
                const data = await response.json();
                return Array.isArray(data) && data.length ? data : null;
            } catch {
                return null;
            }
        }, {timeoutMs: 15000});
        const page = targets.find(item => item.type === 'page') || targets[0];
        client = new CDPClient(page.webSocketDebuggerUrl);
        await client.open();
        await client.command('Runtime.enable');
        await client.command('Page.enable');
        const load = client.once('Page.loadEventFired', 30000).catch(() => null);
        await client.command('Page.navigate', {url: targetUrl});
        await load;
        await sleep(500);

        const navigation = await evaluate(client, `({href: location.href, title: document.title, body: document.body ? document.body.innerText.slice(0, 500) : ''})`);
        if (!navigation || /^chrome-error:/.test(navigation.href || '') || /is blocked|doesn.t allow you to view this site/i.test(navigation.body || '')) {
            const error = new Error(`Browser navigation was blocked before NGVGE could load: ${navigation ? navigation.href : 'unknown URL'}`);
            error.code = 'NGVGE_BROWSER_POLICY_BLOCKED';
            error.navigation = navigation;
            throw error;
        }

        await waitFor(async () => evaluate(client, 'Boolean(window.vm && window.vm.runtime && window.vm.runtime.ngvgeFirstPartyModules)'), {
            timeoutMs: 60000,
            intervalMs: 250
        });

        const proof = await evaluate(client, `(async () => {
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            const waitForBrowser = async (predicate, timeoutMs = 15000, intervalMs = 100) => {
                const started = Date.now();
                let lastValue = null;
                while (Date.now() - started < timeoutMs) {
                    try {
                        lastValue = await predicate();
                        if (lastValue) return lastValue;
                    } catch {
                        // Browser fixture polling is intentionally tolerant until timeout.
                    }
                    await delay(intervalMs);
                }
                return lastValue || null;
            };
            const readArrayLike = value => {
                if (!value || typeof value !== 'object') return [];
                if (Array.isArray(value)) return value;
                let length;
                try {
                    length = value.length;
                } catch {
                    return [];
                }
                if (!Number.isSafeInteger(length) || length < 0) return [];
                const items = [];
                for (let index = 0; index < length; index++) {
                    try {
                        items.push(value[index]);
                    } catch {
                        return [];
                    }
                }
                return items;
            };
            const getOriginalSprites = vm => readArrayLike(
                vm && vm.runtime ? vm.runtime.targets : null
            ).filter(target => target && !target.isStage && target.isOriginal !== false);
            const summarizeTargets = vm => (
                vm && vm.runtime && Array.isArray(vm.runtime.targets) ? vm.runtime.targets : []
            ).map(target => ({
                id: target && target.id || null,
                isOriginal: target ? target.isOriginal !== false : false,
                isStage: Boolean(target && target.isStage),
                name: target && typeof target.getName === 'function' ? target.getName() : null,
                size: target && Number.isFinite(target.size) ? target.size : null,
                x: target && Number.isFinite(target.x) ? target.x : null,
                y: target && Number.isFinite(target.y) ? target.y : null,
                direction: target && Number.isFinite(target.direction) ? target.direction : null
            }));
            const vm = window.vm;
            const framework = vm.runtime.ngvgeFirstPartyModules;

            // The Scratch GUI loads its default project asynchronously. Do not provision the
            // browser fixture until the VM has a real stage and the target set has stopped changing.
            await waitForBrowser(() => {
                const targets = vm.runtime && Array.isArray(vm.runtime.targets) ? vm.runtime.targets : [];
                return targets.some(target => target && target.isStage) ? true : null;
            }, 30000, 100);
            let stableSignature = null;
            let stableSamples = 0;
            await waitForBrowser(() => {
                const signature = (vm.runtime.targets || []).map(target => target && target.id || '').join('|');
                if (signature && signature === stableSignature) stableSamples += 1;
                else {
                    stableSignature = signature;
                    stableSamples = 1;
                }
                return stableSamples >= 4 ? signature : null;
            }, 10000, 150);

            const state = framework.getModuleState('ngvge.scene-system');
            if (!state || !['enabled', 'runtime-active'].includes(String(state.status || state.phase || '').toLowerCase())) {
                await Promise.resolve(framework.enableModule('ngvge.scene-system'));
            }
            await delay(300);
            const runtimeCapability = framework.getCapability('ngvge.transform2d-runtime');
            const commandCapability = framework.getCapability('ngvge.transform2d-command');
            const adapter = framework.getCapability('ngvge.scratch-sprite-node-adapter');
            const sceneDataModel = framework.getCapability('ngvge.scene-data-model');
            let reconcileResult = null;
            if (adapter && typeof adapter.reconcileActiveScene === 'function') {
                reconcileResult = await Promise.resolve(adapter.reconcileActiveScene({
                    preserveMissing: true,
                    reason: '0009-e-browser-initial'
                }));
            }
            let bindings = adapter && typeof adapter.listBindings === 'function' ? adapter.listBindings() : [];
            let probeCreated = false;
            let probeTargetRuntimeId = null;
            let probeTargetName = null;

            const initialOriginalSprites = getOriginalSprites(vm);
            if (!bindings.length && !initialOriginalSprites.length) {
                const storage = vm && vm.runtime && vm.runtime.storage;
                if (typeof vm.addSprite !== 'function' || !storage || typeof storage.createAsset !== 'function') {
                    throw new Error('Browser verification could not provision a Scratch sprite probe fixture.');
                }
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2" viewBox="0 0 2 2"><rect width="2" height="2" fill="#ffffff"/></svg>';
                const svgData = new TextEncoder().encode(svg);
                const asset = storage.createAsset(
                    storage.AssetType.ImageVector,
                    storage.DataFormat.SVG,
                    svgData,
                    null,
                    true
                );
                probeTargetName = '__NGVGE_0009_BROWSER_PROBE__';
                await vm.addSprite({
                    name: probeTargetName,
                    isStage: false,
                    variables: {},
                    lists: {},
                    broadcasts: {},
                    blocks: {},
                    comments: {},
                    currentCostume: 0,
                    costumes: [{
                        assetId: asset.assetId,
                        bitmapResolution: 1,
                        dataFormat: asset.dataFormat,
                        md5ext: asset.assetId + '.' + asset.dataFormat,
                        name: 'probe',
                        rotationCenterX: 1,
                        rotationCenterY: 1
                    }],
                    sounds: [],
                    volume: 100,
                    layerOrder: 1,
                    visible: true,
                    x: 0,
                    y: 0,
                    size: 100,
                    direction: 90,
                    draggable: false,
                    rotationStyle: 'all around'
                });
                probeCreated = true;

                const probeTarget = await waitForBrowser(() => getOriginalSprites(vm).find(target => (
                    target && typeof target.getName === 'function' && target.getName() === probeTargetName
                )) || null, 10000, 100);
                if (probeTarget) {
                    probeTargetRuntimeId = probeTarget.id;
                    if (typeof probeTarget.setXY === 'function') probeTarget.setXY(37, -23, true);
                    if (typeof probeTarget.setDirection === 'function') probeTarget.setDirection(45);
                    if (typeof probeTarget.setSize === 'function') probeTarget.setSize(125);
                }

                if (adapter && typeof adapter.reconcileActiveScene === 'function') {
                    reconcileResult = await Promise.resolve(adapter.reconcileActiveScene({
                        preserveMissing: true,
                        reason: '0009-e-browser-probe'
                    }));
                }

                const boundProbe = await waitForBrowser(() => {
                    const nextBindings = adapter && typeof adapter.listBindings === 'function' ? adapter.listBindings() : [];
                    bindings = nextBindings;
                    if (!nextBindings.length) return null;
                    if (probeTargetRuntimeId && typeof adapter.getBindingByTargetRuntimeId === 'function') {
                        return adapter.getBindingByTargetRuntimeId(probeTargetRuntimeId) || null;
                    }
                    return nextBindings.find(item => item && item.status === 'bound') || nextBindings[0] || null;
                }, 10000, 100);
                if (boundProbe && !bindings.length) bindings = [boundProbe];
            } else if (!bindings.length && initialOriginalSprites.length && adapter && typeof adapter.reconcileActiveScene === 'function') {
                // A real Sprite already exists. Give the lifecycle coalescer time to publish its binding.
                await waitForBrowser(() => {
                    bindings = adapter.listBindings();
                    return bindings.length ? bindings : null;
                }, 5000, 100);
            }

            const binding = (probeTargetRuntimeId && adapter && typeof adapter.getBindingByTargetRuntimeId === 'function' ?
                adapter.getBindingByTargetRuntimeId(probeTargetRuntimeId) : null) ||
                bindings.find(item => item && item.status === 'bound') || bindings[0] || null;

            // Stable NodeId is a semantic identity invariant, not a string-prefix convention. Reconcile once more
            // and prove that the same binding keeps the same NodeId instead of asserting a presentation prefix.
            let bindingAfterReconcile = null;
            if (binding && adapter && typeof adapter.reconcileActiveScene === 'function') {
                await Promise.resolve(adapter.reconcileActiveScene({
                    preserveMissing: true,
                    reason: '0009-e-browser-stable-nodeid-proof'
                }));
                const rebound = probeTargetRuntimeId && typeof adapter.getBindingByTargetRuntimeId === 'function' ?
                    adapter.getBindingByTargetRuntimeId(probeTargetRuntimeId) :
                    (typeof adapter.getBindingByBindingId === 'function' ? adapter.getBindingByBindingId(binding.bindingId) : null);
                bindingAfterReconcile = rebound ? {
                    bindingId: rebound.bindingId,
                    nodeId: rebound.nodeId,
                    status: rebound.status
                } : null;
            }

            // Adapter reconciliation schedules Transform bootstrap asynchronously. Wait for the semantic
            // Runtime capability to expose the Transform instead of racing the projection timer.
            const rawRuntimeTransform = binding && runtimeCapability && typeof runtimeCapability.getRuntimeTransform === 'function' ?
                await waitForBrowser(() => runtimeCapability.getRuntimeTransform(binding.nodeId) || null, 10000, 100) : null;
            const runtimeTransform = rawRuntimeTransform ? {
                position: [rawRuntimeTransform.position[0], rawRuntimeTransform.position[1]],
                rotation: rawRuntimeTransform.rotation,
                scale: [rawRuntimeTransform.scale[0], rawRuntimeTransform.scale[1]]
            } : null;
            const adapterStatus = adapter && typeof adapter.getStatus === 'function' ? (() => {
                const status = adapter.getStatus();
                return {
                    bindingCount: status.bindingCount,
                    boundCount: status.boundCount,
                    error: status.error,
                    missingCount: status.missingCount,
                    offlineCount: status.offlineCount,
                    reconciling: status.reconciling,
                    revision: status.revision,
                    schemaVersion: status.schemaVersion,
                    tracking: status.tracking,
                    warningCount: status.warningCount
                };
            })() : null;
            const reconcileSummary = reconcileResult ? {
                bindingCount: reconcileResult.bindings ? reconcileResult.bindings.length : null,
                change: reconcileResult.change ? {
                    createdNodeIds: readArrayLike(reconcileResult.change.createdNodeIds),
                    missingNodeIds: readArrayLike(reconcileResult.change.missingNodeIds),
                    reason: reconcileResult.change.reason || null,
                    removedNodeIds: readArrayLike(reconcileResult.change.removedNodeIds),
                    sceneId: reconcileResult.change.sceneId || null,
                    type: reconcileResult.change.type || null,
                    warningCount: reconcileResult.change.warningCount || 0
                } : null
            } : null;
            return {
                adapterStatus,
                sceneDataProject: sceneDataModel && typeof sceneDataModel.readProject === 'function' ? (() => {
                    try {
                        const project = sceneDataModel.readProject();
                        return {
                            activeSceneId: project && project.activeSceneId || null,
                            sceneIds: project ? readArrayLike(project.scenes).map(scene => scene && scene.id || null) : [],
                            schemaVersion: project && project.schemaVersion || null
                        };
                    } catch (error) {
                        return {error: error && error.message ? error.message : String(error)};
                    }
                })() : null,
                originalSpriteCount: getOriginalSprites(vm).length,
                commandCapability: Boolean(commandCapability),
                commandCapabilityId: commandCapability && commandCapability.capabilityId,
                binding: binding ? {
                    bindingId: binding.bindingId,
                    nodeId: binding.nodeId,
                    status: binding.status,
                    targetRuntimeIdPresentInAdapterView: typeof binding.targetRuntimeId === 'string'
                } : null,
                bindingAfterReconcile,
                bindingCount: bindings.length,
                href: location.href,
                probeCreated,
                probeTargetName,
                probeTargetRuntimeId,
                reconcileResult: reconcileSummary,
                runtimeCapability: Boolean(runtimeCapability),
                runtimeCapabilityId: runtimeCapability && runtimeCapability.capabilityId,
                runtimeTargets: summarizeTargets(vm),
                runtimeTransform,
                sceneSystemState: framework.getModuleState('ngvge.scene-system')
            };
        })()`);

        assert.strictEqual(proof.runtimeCapability, true, 'Scene System must publish ngvge.transform2d-runtime in a real browser.');
        assert.strictEqual(proof.commandCapability, true, 'Scene System must publish ngvge.transform2d-command in a real browser.');
        assert.strictEqual(proof.runtimeCapabilityId, 'ngvge.transform2d-runtime');
        assert.strictEqual(proof.commandCapabilityId, 'ngvge.transform2d-command');
        if (!proof.binding) {
            const error = new Error('Browser verification could not establish a Scratch sprite binding after project stabilization and explicit reconcile.');
            error.code = 'NGVGE_BROWSER_SPRITE_BINDING_MISSING';
            error.diagnostics = proof;
            throw error;
        }
        assert(
            typeof proof.binding.nodeId === 'string' && proof.binding.nodeId.trim().length > 0,
            'Browser sprite binding must expose a non-empty stable semantic NodeId.'
        );
        if (proof.probeTargetRuntimeId) {
            assert.notStrictEqual(
                proof.binding.nodeId,
                proof.probeTargetRuntimeId,
                'Stable semantic NodeId must not reuse Scratch target runtime identity.'
            );
        }
        assert(proof.bindingAfterReconcile, 'Browser sprite binding must survive an explicit reconcile.');
        assert.strictEqual(
            proof.bindingAfterReconcile.bindingId,
            proof.binding.bindingId,
            'Scratch binding identity must remain stable across reconcile.'
        );
        assert.strictEqual(
            proof.bindingAfterReconcile.nodeId,
            proof.binding.nodeId,
            'Semantic NodeId must remain stable across reconcile.'
        );
        assert(proof.runtimeTransform, 'Browser sprite binding must expose Runtime Transform through semantic capability.');
        if (proof.probeCreated) {
            assert.deepStrictEqual(proof.runtimeTransform.position, [37, -23], 'Probe position must project Scratch x/y into Runtime Transform.');
            assert.strictEqual(proof.runtimeTransform.rotation, 45, 'Probe Scratch direction must project into NGVGE rotation.');
            assert.deepStrictEqual(proof.runtimeTransform.scale, [1.25, 1.25], 'Probe Scratch size must project into uniform NGVGE scale.');
        }

        process.stdout.write(`${JSON.stringify({
            schema: 'ngvge-0009-browser-verification/v1',
            status: 'PASS',
            targetUrl,
            browserExecutable: executable,
            browserExecutableSource: browserResolution.source,
            proof
        }, null, 2)}\n`);
    } finally {
        if (client) client.close();
        try { browser.kill('SIGTERM'); } catch { /* ignore */ }
        await waitForChildExit(browser, 3000);
        await removeDirectoryWithRetry(profile);
    }
};

run().catch(error => {
    const result = {
        schema: 'ngvge-0009-browser-verification/v1',
        status: error && error.code === 'NGVGE_BROWSER_POLICY_BLOCKED' ? 'EVIDENCE-HOLD' : 'FAIL',
        code: error && error.code ? error.code : 'NGVGE_BROWSER_VERIFY_FAILED',
        message: error && error.message ? error.message : String(error),
        navigation: error && error.navigation ? error.navigation : undefined,
        browserExecutable: error && error.browserExecutable ? error.browserExecutable : undefined,
        browserExecutableSource: error && error.browserSource ? error.browserSource : undefined,
        attemptedBrowserExecutables: error && error.attemptedBrowserExecutables ? error.attemptedBrowserExecutables : undefined,
        diagnostics: error && error.diagnostics ? error.diagnostics : undefined,
        platform: process.platform,
        targetUrl
    };
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === 'EVIDENCE-HOLD' ? 2 : 1;
});
