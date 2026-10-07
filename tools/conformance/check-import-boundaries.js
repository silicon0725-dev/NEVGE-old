#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_POLICY_PATH = path.join(__dirname, 'import-boundary-policy.json');

const readPolicy = policyPath => JSON.parse(fs.readFileSync(policyPath, 'utf8'));

const isInside = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

const packageNameFromSpecifier = specifier => {
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
    }
    return specifier.split('/')[0];
};

const formatLocation = node => {
    if (!node || !node.loc) return null;
    return {
        line: node.loc.start.line,
        column: node.loc.start.column + 1
    };
};

const sourceValue = node => {
    if (!node) return null;
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
    return null;
};

const collectForbiddenAmbientReferences = (ast, forbiddenNames) => {
    const references = [];
    babel.traverse(ast, {
        ReferencedIdentifier(identifierPath) {
            const name = identifierPath.node.name;
            if (!forbiddenNames.has(name)) return;
            if (identifierPath.scope.hasBinding(name)) return;
            references.push({
                name,
                location: formatLocation(identifierPath.node)
            });
        },
        MemberExpression(memberPath) {
            const node = memberPath.node;
            if (!node.object || node.object.type !== 'Identifier' || node.object.name !== 'globalThis') return;
            let propertyName = null;
            if (!node.computed && node.property && node.property.type === 'Identifier') propertyName = node.property.name;
            if (node.computed) propertyName = sourceValue(node.property);
            if (!propertyName || !forbiddenNames.has(propertyName)) return;
            references.push({
                name: `globalThis.${propertyName}`,
                location: formatLocation(node)
            });
        }
    });
    return references;
};

const collectDependencyReferences = ast => {
    const references = [];

    const add = (kind, sourceNode, ownerNode, literalRequired = true) => {
        const value = sourceValue(sourceNode);
        references.push({
            kind,
            specifier: value,
            literal: value !== null,
            literalRequired,
            location: formatLocation(ownerNode || sourceNode)
        });
    };

    const visit = node => {
        if (!node || typeof node !== 'object') return;

        switch (node.type) {
        case 'ImportDeclaration':
            add('import', node.source, node);
            break;
        case 'ExportNamedDeclaration':
            if (node.source) add('export-from', node.source, node);
            break;
        case 'ExportAllDeclaration':
            add('export-all-from', node.source, node);
            break;
        case 'ImportExpression':
            add('dynamic-import', node.source, node);
            break;
        case 'TSImportType':
            add('typescript-import-type', node.argument, node);
            break;
        case 'CallExpression': {
            const callee = node.callee;
            if (callee && callee.type === 'Identifier' && callee.name === 'require') {
                add('require', node.arguments && node.arguments[0], node);
            } else if (callee && callee.type === 'Import') {
                add('dynamic-import', node.arguments && node.arguments[0], node);
            } else if (
                callee && callee.type === 'MemberExpression' && !callee.computed &&
                callee.object && callee.object.type === 'Identifier' && callee.object.name === 'require' &&
                callee.property && callee.property.type === 'Identifier' && callee.property.name === 'resolve'
            ) {
                add('require-resolve', node.arguments && node.arguments[0], node);
            }
            break;
        }
        default:
            break;
        }

        for (const [key, value] of Object.entries(node)) {
            if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
            if (Array.isArray(value)) {
                value.forEach(visit);
            } else if (value && typeof value === 'object') {
                visit(value);
            }
        }
    };

    visit(ast);
    return references;
};

const parseSource = (source, filename) => babel.parseSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    sourceType: 'unambiguous',
    parserOpts: {
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        plugins: [
            'jsx',
            'typescript',
            'dynamicImport',
            'importMeta',
            'topLevelAwait',
            'classProperties',
            'classPrivateProperties',
            'classPrivateMethods',
            'objectRestSpread',
            'optionalChaining',
            'nullishCoalescingOperator'
        ]
    }
});

const listCoreSources = (coreRoot, extensions) => {
    const files = [];
    const symlinks = [];

    const walk = directory => {
        for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
            const absolute = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) {
                symlinks.push(absolute);
                continue;
            }
            if (entry.isDirectory()) {
                walk(absolute);
                continue;
            }
            if (entry.isFile() && extensions.has(path.extname(entry.name))) {
                files.push(absolute);
            }
        }
    };

    if (fs.existsSync(coreRoot)) walk(coreRoot);
    return {files: files.sort(), symlinks: symlinks.sort()};
};

const resolveExistingLocalTarget = (fromFile, specifier, extensions) => {
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [base];
    for (const extension of extensions) candidates.push(`${base}${extension}`);
    for (const extension of extensions) candidates.push(path.join(base, `index${extension}`));
    candidates.push(`${base}.json`);
    candidates.push(path.join(base, 'index.json'));
    return candidates.find(candidate => fs.existsSync(candidate)) || null;
};

const checkRepository = options => {
    const repoRoot = path.resolve(options && options.repoRoot ? options.repoRoot : DEFAULT_REPO_ROOT);
    const policy = options && options.policy ? options.policy : readPolicy(
        options && options.policyPath ? options.policyPath : DEFAULT_POLICY_PATH
    );
    const coreRoot = path.resolve(repoRoot, policy.coreRoot || 'src/core');
    const extensions = new Set(policy.sourceExtensions || ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
    const allowedBarePackages = new Set(policy.allowedBarePackages || []);
    const forbiddenAmbientGlobals = new Set(policy.forbiddenAmbientGlobals || []);
    const violations = [];
    let dependencyReferenceCount = 0;

    if (!isInside(repoRoot, coreRoot)) {
        throw new Error(`Configured coreRoot escapes repository: ${coreRoot}`);
    }

    if (!fs.existsSync(coreRoot) || !fs.statSync(coreRoot).isDirectory()) {
        violations.push({
            code: 'CORE_OWNERSHIP_ZONE_MISSING',
            file: policy.coreRoot || 'src/core',
            message: 'The configured Semantic Ownership Zone directory does not exist.'
        });
        return {
            schema: 'ngvge-arc-c001-import-boundary-result/v1',
            valid: false,
            repoRoot,
            coreRoot: path.relative(repoRoot, coreRoot) || '.',
            sourceFileCount: 0,
            dependencyReferenceCount: 0,
            allowedBarePackages: [...allowedBarePackages].sort(),
            violations
        };
    }

    const inventory = listCoreSources(coreRoot, extensions);

    if (policy.policy && policy.policy.symlinksForbiddenInsideCore) {
        for (const symlink of inventory.symlinks) {
            violations.push({
                code: 'CORE_SYMLINK_FORBIDDEN',
                file: path.relative(repoRoot, symlink),
                message: 'Symbolic links are forbidden inside src/core because they can bypass ownership boundaries.'
            });
        }
    }

    for (const absoluteFile of inventory.files) {
        const relativeFile = path.relative(repoRoot, absoluteFile);
        let ast;
        try {
            ast = parseSource(fs.readFileSync(absoluteFile, 'utf8'), absoluteFile);
        } catch (error) {
            violations.push({
                code: 'CORE_PARSE_FAILED',
                file: relativeFile,
                message: error && error.message ? error.message : String(error)
            });
            continue;
        }

        const references = collectDependencyReferences(ast);
        dependencyReferenceCount += references.length;

        const ambientReferences = collectForbiddenAmbientReferences(ast, forbiddenAmbientGlobals);
        for (const reference of ambientReferences) {
            violations.push({
                code: 'CORE_AMBIENT_BACKEND_GLOBAL_FORBIDDEN',
                file: relativeFile,
                location: reference.location || undefined,
                specifier: reference.name,
                message: `Ambient backend/editor global "${reference.name}" is forbidden inside src/core.`
            });
        }

        for (const reference of references) {
            const location = reference.location || undefined;
            if (!reference.literal) {
                violations.push({
                    code: reference.kind === 'require' || reference.kind === 'require-resolve' ?
                        'CORE_NON_LITERAL_REQUIRE_FORBIDDEN' : 'CORE_NON_LITERAL_IMPORT_FORBIDDEN',
                    file: relativeFile,
                    location,
                    kind: reference.kind,
                    message: `${reference.kind} must use a static string literal inside src/core.`
                });
                continue;
            }

            const specifier = reference.specifier;
            if (path.isAbsolute(specifier)) {
                violations.push({
                    code: 'CORE_ABSOLUTE_IMPORT_FORBIDDEN',
                    file: relativeFile,
                    location,
                    kind: reference.kind,
                    specifier,
                    message: 'Absolute imports are forbidden inside src/core.'
                });
                continue;
            }

            if (specifier.startsWith('.')) {
                const normalizedTarget = path.resolve(path.dirname(absoluteFile), specifier);
                if (!isInside(coreRoot, normalizedTarget)) {
                    violations.push({
                        code: 'CORE_IMPORT_ESCAPES_OWNERSHIP_ZONE',
                        file: relativeFile,
                        location,
                        kind: reference.kind,
                        specifier,
                        message: 'src/core may only depend on files inside src/core.'
                    });
                    continue;
                }

                const existingTarget = resolveExistingLocalTarget(absoluteFile, specifier, extensions);
                if (existingTarget) {
                    const realTarget = fs.realpathSync(existingTarget);
                    const realCore = fs.realpathSync(coreRoot);
                    if (!isInside(realCore, realTarget)) {
                        violations.push({
                            code: 'CORE_IMPORT_REALPATH_ESCAPES_OWNERSHIP_ZONE',
                            file: relativeFile,
                            location,
                            kind: reference.kind,
                            specifier,
                            message: 'Resolved local dependency escapes src/core through the filesystem.'
                        });
                    }
                }
                continue;
            }

            const packageName = packageNameFromSpecifier(specifier);
            if (!allowedBarePackages.has(packageName)) {
                violations.push({
                    code: 'CORE_BARE_IMPORT_FORBIDDEN',
                    file: relativeFile,
                    location,
                    kind: reference.kind,
                    specifier,
                    message: `Bare package import "${specifier}" is not approved for the Semantic Ownership Zone.`
                });
            }
        }
    }

    return {
        schema: 'ngvge-arc-c001-import-boundary-result/v1',
        valid: violations.length === 0,
        repoRoot,
        coreRoot: path.relative(repoRoot, coreRoot) || '.',
        sourceFileCount: inventory.files.length,
        dependencyReferenceCount,
        allowedBarePackages: [...allowedBarePackages].sort(),
        violations
    };
};

const printResult = result => {
    if (result.valid) {
        process.stdout.write(
            `ARC-C001 Import Boundary PASS: ${result.sourceFileCount} core source file(s), ` +
            `${result.dependencyReferenceCount} dependency reference(s), ` +
            `${result.allowedBarePackages.length} approved bare package(s).\n`
        );
        return;
    }

    process.stderr.write(`ARC-C001 Import Boundary FAIL: ${result.violations.length} violation(s).\n`);
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
    checkRepository,
    collectDependencyReferences,
    collectForbiddenAmbientReferences,
    parseSource,
    printResult
};
