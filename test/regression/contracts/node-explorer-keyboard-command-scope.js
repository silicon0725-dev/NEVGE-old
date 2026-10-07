'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const assertNodeExplorerKeyboardCommandScopeContract = () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/project-explorer/project-explorer.jsx'),
        'utf8'
    );
    assert.match(source, /data-ngvge-keyboard-command-scope="explorer-capture"/);
    assert.match(source, /onKeyDownCapture=\{handleExplorerKeyDown\}/);
    assert.doesNotMatch(source, /explorerRef\.current\.contains\(document\.activeElement\)/);
    assert.match(source, /event\.stopPropagation\(\)/);
    assert.match(source, /handleMoveRuntimeNode\(selectedRuntimeNodes\[0\], event\.key === 'ArrowUp' \? -1 : 1\)/);
    return {
        altArrowRuntimeReorder: true,
        localCaptureBoundary: true,
        noDocumentActiveElementDependency: true
    };
};

module.exports = {assertNodeExplorerKeyboardCommandScopeContract};
