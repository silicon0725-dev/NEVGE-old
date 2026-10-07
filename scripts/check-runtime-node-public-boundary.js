#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(ROOT, 'src');
const FORBIDDEN_ALIASES = new Set(['getNode', 'getComponent', 'patchComponentData', 'renameNode']);
const EXCLUDED_FILES = new Set([
    path.join(SRC_ROOT, 'lib/runtime-nodes/runtime-node-api-contract.js'),
    path.join(SRC_ROOT, 'lib/runtime-nodes/runtime-node-model-service.js')
]);

const listSourceFiles = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
        if (entry.name === 'compatibility') return [];
        return listSourceFiles(fullPath);
    }
    return /\.(?:js|jsx)$/.test(entry.name) ? [fullPath] : [];
});

const getLocation = (source, index) => {
    const before = source.slice(0, index);
    const lines = before.split('\n');
    return {column: lines[lines.length - 1].length + 1, line: lines.length};
};

const fallbackScan = (filePath, source) => {
    const issues = [];
    const memberPattern = /\b(?:runtimeNodeModel|runtimeNodeService|runtimeNodeCapability|nodeModel)\s*(?:(?:\?\.|\.)\s*(getNode|getComponent|patchComponentData|renameNode)\b|\[\s*['\"](getNode|getComponent|patchComponentData|renameNode)['\"]\s*\])/g;
    const destructurePattern = /\{([^}]+)\}\s*=\s*(?:runtimeNodeModel|runtimeNodeService|runtimeNodeCapability|nodeModel)\b/g;
    let match;
    while ((match = memberPattern.exec(source))) {
        issues.push(Object.assign({alias: match[1] || match[2], kind: 'member-access'}, getLocation(source, match.index)));
    }
    while ((match = destructurePattern.exec(source))) {
        const aliases = match[1].split(',').map(value => value.trim().split(':')[0].trim());
        aliases.filter(alias => FORBIDDEN_ALIASES.has(alias)).forEach(alias => {
            issues.push(Object.assign({alias, kind: 'destructure'}, getLocation(source, match.index)));
        });
    }
    return issues;
};

const isRuntimeNodeModelExpression = node => {
    if (!node) return false;
    if (node.type === 'Identifier') return /^(?:runtimeNodeModel|runtimeNodeService|runtimeNodeCapability|nodeModel)$/.test(node.name);
    if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
        const property = node.computed ? node.property && node.property.value : node.property && node.property.name;
        return property === 'runtimeNodeModel' || property === 'nodeModel';
    }
    return false;
};

const walkAst = (node, visit) => {
    if (!node || typeof node !== 'object') return;
    visit(node);
    Object.keys(node).forEach(key => {
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') return;
        const value = node[key];
        if (Array.isArray(value)) value.forEach(child => walkAst(child, visit));
        else if (value && typeof value === 'object' && typeof value.type === 'string') walkAst(value, visit);
    });
};

const astScan = (filePath, source, babel) => {
    const ast = babel.parseSync(source, {
        filename: filePath,
        parserOpts: {
            allowReturnOutsideFunction: true,
            plugins: ['jsx', 'dynamicImport', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator'],
            sourceType: 'unambiguous'
        }
    });
    const issues = [];
    walkAst(ast, node => {
        if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
            const property = node.computed ? node.property && node.property.value : node.property && node.property.name;
            if (FORBIDDEN_ALIASES.has(property) && isRuntimeNodeModelExpression(node.object)) {
                issues.push({
                    alias: property,
                    column: node.loc && node.loc.start ? node.loc.start.column + 1 : 1,
                    kind: 'member-access',
                    line: node.loc && node.loc.start ? node.loc.start.line : 1
                });
            }
        }
        if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'ObjectPattern' &&
            isRuntimeNodeModelExpression(node.init)) {
            node.id.properties.forEach(property => {
                const alias = property && property.key && (property.key.name || property.key.value);
                if (FORBIDDEN_ALIASES.has(alias)) {
                    issues.push({
                        alias,
                        column: property.loc && property.loc.start ? property.loc.start.column + 1 : 1,
                        kind: 'destructure',
                        line: property.loc && property.loc.start ? property.loc.start.line : 1
                    });
                }
            });
        }
    });
    return issues;
};

let babel = null;
try {
    // Available in the complete development environment. The fallback keeps the
    // source archive self-checking when node_modules is intentionally absent.
    babel = require('@babel/core');
} catch {
    babel = null;
}

const violations = [];
listSourceFiles(SRC_ROOT).forEach(filePath => {
    if (EXCLUDED_FILES.has(filePath)) return;
    const source = fs.readFileSync(filePath, 'utf8');
    const issues = babel ? astScan(filePath, source, babel) : fallbackScan(filePath, source);
    issues.forEach(issue => violations.push(Object.assign({filePath}, issue)));
});

if (violations.length) {
    violations.forEach(issue => {
        console.error(`${path.relative(ROOT, issue.filePath)}:${issue.line}:${issue.column} ` +
            `forbidden Runtime Node compatibility alias "${issue.alias}" (${issue.kind})`);
    });
    process.exitCode = 1;
} else {
    console.log(`Runtime Node first-party alias gate passed (${babel ? 'AST' : 'fallback'} mode).`);
}
