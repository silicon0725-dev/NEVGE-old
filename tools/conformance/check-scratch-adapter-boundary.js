#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const {
    collectDependencyReferences,
    parseSource
} = require('./check-import-boundaries');
const {
    LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
    SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
    SPRITE_NODE_TYPE_ID,
    createScratchSpriteTreeProjection,
    normalizePersistentBinding,
    toBindingView,
    toPersistentBinding,
    validateBindingStorePersistence
} = require('../../src/lib/scratch-sprite-adapter');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const SENSITIVE_ROOTS = Object.freeze([
    'src/core',
    'src/lib/runtime-nodes',
    'src/lib/persistence'
]);

const normalizePath = value => value.split(path.sep).join('/');

const walkFiles = root => {
    if (!fs.existsSync(root)) return [];
    const result = [];
    const visit = current => {
        const entries = fs.readdirSync(current, {withFileTypes: true})
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                visit(absolute);
            } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
                result.push(absolute);
            }
        }
    };
    visit(root);
    return result;
};

const isScratchDependency = specifier => /(?:^|[\\/])scratch(?:-|[\\/])|scratch-vm|scratch-render|scratch-sprite-adapter/i.test(specifier);

const scanSensitiveSource = ({repoRoot = ROOT} = {}) => {
    const violations = [];
    let sourceFileCount = 0;

    for (const relativeRoot of SENSITIVE_ROOTS) {
        const absoluteRoot = path.join(repoRoot, relativeRoot);
        for (const absoluteFile of walkFiles(absoluteRoot)) {
            sourceFileCount += 1;
            const relativeFile = normalizePath(path.relative(repoRoot, absoluteFile));
            const source = fs.readFileSync(absoluteFile, 'utf8');
            let ast;
            try {
                ast = parseSource(source, relativeFile);
            } catch (error) {
                violations.push({
                    code: 'SCRATCH_ADAPTER_BOUNDARY_SOURCE_PARSE_FAILED',
                    file: relativeFile,
                    message: error && error.message ? error.message : String(error)
                });
                continue;
            }

            const dependencies = collectDependencyReferences(ast);
            for (const reference of dependencies) {
                if (!reference.literal || !isScratchDependency(reference.specifier)) continue;
                violations.push({
                    code: 'SCRATCH_ADAPTER_DEPENDENCY_LEAK',
                    file: relativeFile,
                    location: reference.location || undefined,
                    specifier: reference.specifier,
                    message: 'Core/runtime semantic/persistence code must not depend directly on Scratch adapter/backend modules.'
                });
            }

            traverse(ast, {
                Identifier (identifierPath) {
                    if (identifierPath.node.name !== 'targetRuntimeId') return;
                    violations.push({
                        code: 'SCRATCH_VOLATILE_TARGET_ID_LEAK',
                        file: relativeFile,
                        location: identifierPath.node.loc && identifierPath.node.loc.start ? {
                            line: identifierPath.node.loc.start.line,
                            column: identifierPath.node.loc.start.column
                        } : undefined,
                        message: 'Volatile Scratch targetRuntimeId must remain inside the compatibility adapter boundary.'
                    });
                },
                StringLiteral (literalPath) {
                    if (!/^(?:scratch-target|ngvge\.scratch-target-binding|ngvge\.scratch-sprite-node)$/.test(literalPath.node.value)) return;
                    violations.push({
                        code: 'SCRATCH_COMPATIBILITY_REPRESENTATION_LEAK',
                        file: relativeFile,
                        location: literalPath.node.loc && literalPath.node.loc.start ? {
                            line: literalPath.node.loc.start.line,
                            column: literalPath.node.loc.start.column
                        } : undefined,
                        value: literalPath.node.value,
                        message: 'Scratch compatibility representation must not become a Core/runtime semantic/persistence contract.'
                    });
                }
            });
        }
    }

    return {
        sourceFileCount,
        violations
    };
};

const runBindingContractChecks = () => {
    assert.strictEqual(SCRATCH_SPRITE_BINDING_SCHEMA_VERSION, 2,
        'Scratch binding persistence must remain explicitly versioned.');
    assert.notStrictEqual(SPRITE_NODE_TYPE_ID, LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
        'Semantic Sprite identity must remain distinct from the legacy Scratch-specific Runtime Node type.');
    assert.strictEqual(SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID, 'ngvge.scratch-target-binding');

    const runtimeBinding = {
        bindingId: 'binding-a',
        destroyPolicy: 'delete-target',
        lastKnownName: 'Player',
        nodeId: 'ngvge:node:abcdefgh',
        role: 'sprite',
        sceneId: 'scene-a',
        serializedTargetIndex: 1,
        status: 'bound',
        targetRuntimeId: 'volatile-target-a',
        target: {id: 'volatile-target-a'}
    };

    const persistent = toPersistentBinding(runtimeBinding);
    assert.strictEqual(persistent.bindingId, runtimeBinding.bindingId);
    assert.strictEqual(persistent.nodeId, runtimeBinding.nodeId);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(persistent, 'targetRuntimeId'), false,
        'Persistent Scratch binding records must never contain targetRuntimeId.');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(persistent, 'target'), false,
        'Persistent Scratch binding records must never contain a live Scratch Target.');

    const normalized = normalizePersistentBinding(Object.assign({}, persistent, {
        targetRuntimeId: 'must-be-dropped',
        lifecycle: {state: 'runtime'}
    }), 'scene-a');
    assert(normalized, 'A valid persistent Scratch binding should normalize successfully.');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(normalized, 'targetRuntimeId'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(normalized, 'lifecycle'), false);

    const view = toBindingView(runtimeBinding);
    assert(Object.isFrozen(view), 'Adapter binding views must be immutable.');
    assert.strictEqual(view.targetRuntimeId, 'volatile-target-a',
        'Runtime-only target identity may exist in an adapter view.');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(view, 'target'), false,
        'Adapter public views must not expose the live mutable Scratch Target object.');

    const badProject = {
        scenes: [{id: 'scene-a'}],
        extensionData: {
            [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
                schemaVersion: SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
                scenes: {
                    'scene-a': {
                        items: [Object.assign({}, persistent, {targetRuntimeId: 'volatile-target-a'})]
                    }
                }
            }
        }
    };
    const persistenceResult = validateBindingStorePersistence(
        badProject,
        badProject.extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]
    );
    assert.strictEqual(persistenceResult.valid, false,
        'Persisting volatile targetRuntimeId must fail closed.');
    assert(persistenceResult.issues.some(issue => issue.code === 'SCRATCH_BINDING_VOLATILE_TARGET_ID_PERSISTED'),
        'The gate must report the volatile Scratch target identity violation explicitly.');

    const projection = createScratchSpriteTreeProjection({
        bindings: [
            view,
            toBindingView(Object.assign({}, runtimeBinding, {
                bindingId: 'stale-binding',
                nodeId: 'missing-node',
                targetRuntimeId: 'stale-target'
            }))
        ],
        runtimeNodes: [{id: runtimeBinding.nodeId, typeId: SPRITE_NODE_TYPE_ID}]
    });
    assert(Object.isFrozen(projection));
    assert.strictEqual(projection.bindings.length, 1,
        'Editor projection must ignore bindings whose semantic owner node does not exist.');
    assert.strictEqual(projection.bindingByNodeId.has(runtimeBinding.nodeId), true);
    assert.strictEqual(projection.bindingByNodeId.has('missing-node'), false);
    assert.deepStrictEqual(projection.hiddenTargetRuntimeIds, ['volatile-target-a']);

    return {
        bindingSchemaVersion: SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
        immutableBindingViews: true,
        semanticSpriteOwner: SPRITE_NODE_TYPE_ID,
        volatileTargetIdPersistentRejection: true,
        staleProjectionRejected: true
    };
};

const checkRepository = ({repoRoot = ROOT} = {}) => {
    const staticResult = scanSensitiveSource({repoRoot});
    const violations = staticResult.violations.slice();
    let bindingContract = null;

    if (path.resolve(repoRoot) === ROOT) {
        try {
            bindingContract = runBindingContractChecks();
        } catch (error) {
            violations.push({
                code: 'SCRATCH_ADAPTER_RUNTIME_CONTRACT_FAILED',
                file: 'src/lib/scratch-sprite-adapter',
                message: error && error.message ? error.message : String(error)
            });
        }
    }

    return {
        schema: 'ngvge-arc-c001-scratch-adapter-boundary-result/v1',
        valid: violations.length === 0,
        repoRoot: path.resolve(repoRoot),
        sensitiveRoots: SENSITIVE_ROOTS.slice(),
        sourceFileCount: staticResult.sourceFileCount,
        bindingContract,
        violations
    };
};

const printResult = result => {
    if (result.valid) {
        process.stdout.write(
            `ARC-C001 Scratch Adapter Boundary PASS: ${result.sourceFileCount} sensitive source file(s), ` +
            'stable BindingId/NodeId persistence and runtime-only target identity verified.\n'
        );
        return;
    }

    process.stderr.write(`ARC-C001 Scratch Adapter Boundary FAIL: ${result.violations.length} violation(s).\n`);
    for (const violation of result.violations) {
        const location = violation.location ? `:${violation.location.line}:${violation.location.column}` : '';
        const specifier = violation.specifier ? ` [${violation.specifier}]` : '';
        process.stderr.write(
            `- ${violation.code} ${violation.file || '<repository>'}${location}${specifier}: ${violation.message}\n`
        );
    }
};

if (require.main === module) {
    const result = checkRepository();
    printResult(result);
    process.exitCode = result.valid ? 0 : 1;
}

module.exports = {
    SENSITIVE_ROOTS,
    checkRepository,
    printResult,
    runBindingContractChecks,
    scanSensitiveSource
};
