#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const explorer = read('src/components/project-explorer/project-explorer.jsx');
const explorerTest = read('test/unit/components/project-explorer.test.jsx');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('Node Explorer owns keyboard commands through its local capture boundary', () => {
    assert.match(explorer, /data-ngvge-keyboard-command-scope="explorer-capture"/);
    assert.match(explorer, /onKeyDownCapture=\{handleExplorerKeyDown\}/);
});

check('Runtime sibling reorder advertises the accepted Alt+Arrow shortcut pair', () => {
    assert.match(explorer, /data-ngvge-runtime-reorder-shortcut="Alt\+ArrowUp\|Alt\+ArrowDown"/);
});

check('Alt+Arrow reorder is no longer dependent on document.activeElement containment', () => {
    assert.doesNotMatch(explorer, /explorerRef\.current\.contains\(document\.activeElement\)/);
});

check('Alt+ArrowUp and Alt+ArrowDown still use the Runtime Node reorder command path', () => {
    assert.match(explorer, /event\.altKey && \(event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'\)/);
    assert.match(explorer, /handleMoveRuntimeNode\(selectedRuntimeNodes\[0\], event\.key === 'ArrowUp' \? -1 : 1\)/);
    assert.match(explorer, /workspaceNodeCommandClient\.reparentNode\(\{/);
    assert.match(explorer, /options:\s*\{index:\s*targetIndex\}/);
});

check('Handled reorder keys suppress default/browser and parent-dock propagation', () => {
    const start = explorer.indexOf("if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')");
    const end = explorer.indexOf("} else if ((event.key === 'Delete'", start);
    assert(start >= 0 && end > start, 'Unable to locate Explorer Alt+Arrow handler.');
    const block = explorer.slice(start, end);
    assert.match(block, /event\.preventDefault\(\)/);
    assert.match(block, /event\.stopPropagation\(\)/);
});

check('Text-entry controls remain excluded from Explorer keyboard reorder', () => {
    assert.match(explorer, /target\.tagName === 'INPUT'/);
    assert.match(explorer, /target\.tagName === 'TEXTAREA'/);
    assert.match(explorer, /target\.tagName === 'SELECT'/);
    assert.match(explorer, /target\.isContentEditable/);
});

check('DOM regression covers Explorer-local Alt+Arrow sibling reorder', () => {
    assert.match(explorerTest, /reorders the selected Runtime Sprite with Explorer-local Alt\+Arrow keyboard capture/);
    assert.match(explorerTest, /explorer\.props\.onKeyDownCapture\(keyboardEvent\)/);
    assert.match(explorerTest, /options:\s*\{index:\s*1\}/);
});

check('DOM regression prevents Alt+Arrow from hijacking Explorer text fields', () => {
    assert.match(explorerTest, /does not reorder Runtime Nodes while Alt\+Arrow originates from an Explorer text field/);
    assert.match(explorerTest, /tagName:\s*'INPUT'/);
});

process.stdout.write(`WS-10N3-HF1 Node Reorder Keyboard Shortcut Conformance PASS (${checks.length}/${checks.length}).\n`);
