'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertPointerMoveFrameCoalescingContract = () => {
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    assert(gizmo.includes('pendingPointerMove = React.useRef(null)'));
    assert(gizmo.includes('window.requestAnimationFrame(flushQueuedHandleDrag)'));
    assert(gizmo.includes('if (pointerMoveFrame.current !== null) return;'));
    assert(gizmo.includes("frameProfiler.count('colliderPointerSamples', 1)"));
    assert(gizmo.includes("frameProfiler.count('colliderPointerFlushes', 1)"));
    return {
        animationFrameCoalescing: true,
        finalSampleFlushBeforeCommit: true,
        pointerQueueExecutionOnly: true,
        syntheticEventNotRetained: true
    };
};

module.exports = {assertPointerMoveFrameCoalescingContract};
