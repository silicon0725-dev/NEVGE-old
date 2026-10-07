'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const loadBabelModule = require('../helpers/load-babel-module');

const repositoryRoot = path.resolve(__dirname, '../../..');
const diffUtilsPath = path.join(repositoryRoot, 'src/lib/git/diff-utils.js');
const gitDiffPath = path.join(repositoryRoot, 'src/lib/git/git-diff.js');
const MyersDiff = loadBabelModule(diffUtilsPath).default;

const normalize = value => JSON.parse(JSON.stringify(value));

const getWorkerCompute = () => {
    const source = fs.readFileSync(gitDiffPath, 'utf8');
    const match = source.match(/const workerCode = `([\s\S]*?)`;\n\n    const blob/);
    assert(match, 'createDiffWorker worker source could not be located.');

    // Reconstruct the outer template literal exactly as JavaScript would before
    // the browser evaluates it as Worker source. The worker template contains
    // no interpolation expressions, so this remains deterministic/local-only.
    const workerCode = Function(`"use strict"; return \`${match[1].replace(/`/g, '\\`')}\`;`)();
    let lastMessage;
    const context = {
        postMessage: message => {
            lastMessage = message;
        }
    };
    vm.createContext(context);
    vm.runInContext(workerCode, context, {filename: 'ngvge-git-diff-worker.js'});
    assert.strictEqual(typeof context.onmessage, 'function', 'Worker did not register onmessage.');

    return (textA, textB) => {
        lastMessage = undefined;
        context.onmessage({data: {type: 'compute-diff', contentA: textA, contentB: textB}});
        assert(lastMessage, 'Worker did not post a diff result.');
        return normalize(lastMessage);
    };
};

const workerCompute = getWorkerCompute();

const assertChangeSummary = (label, result, expected) => {
    assert.strictEqual(result.totalAdditions, expected.additions, `${label}: additions mismatch.`);
    assert.strictEqual(result.totalDeletions, expected.deletions, `${label}: deletions mismatch.`);
    if (expected.hunks !== undefined) {
        assert.strictEqual(result.hunks.length, expected.hunks, `${label}: hunk count mismatch.`);
    }
    if (expected.changes) {
        const actualChanges = result.hunks.flatMap(hunk => hunk.changes)
            .map(change => ({type: change.type, content: change.content}));
        assert.deepStrictEqual(actualChanges, expected.changes, `${label}: change sequence mismatch.`);
    }
};

const goldenCases = [
    {
        label: 'empty equality',
        a: '',
        b: '',
        expected: {additions: 0, deletions: 0, hunks: 0}
    },
    {
        label: 'multiline equality',
        a: 'alpha\nbeta\ngamma',
        b: 'alpha\nbeta\ngamma',
        expected: {additions: 0, deletions: 0, hunks: 0}
    },
    {
        label: 'add all',
        a: '',
        b: 'alpha\nbeta',
        expected: {
            additions: 2,
            deletions: 0,
            hunks: 1,
            changes: [
                {type: 'add', content: 'alpha'},
                {type: 'add', content: 'beta'}
            ]
        }
    },
    {
        label: 'remove all',
        a: 'alpha\nbeta',
        b: '',
        expected: {
            additions: 0,
            deletions: 2,
            hunks: 1,
            changes: [
                {type: 'remove', content: 'alpha'},
                {type: 'remove', content: 'beta'}
            ]
        }
    },
    {
        label: 'one-line replacement',
        a: 'a',
        b: 'b',
        expected: {
            additions: 1,
            deletions: 1,
            hunks: 1,
            changes: [
                {type: 'remove', content: 'a'},
                {type: 'add', content: 'b'}
            ]
        }
    },
    {
        label: 'middle replacement',
        a: 'a\nb\nc',
        b: 'a\nx\nc',
        expected: {
            additions: 1,
            deletions: 1,
            hunks: 1,
            changes: [
                {type: 'remove', content: 'b'},
                {type: 'add', content: 'x'}
            ]
        }
    },
    {
        label: 'insert at start',
        a: 'b\nc',
        b: 'a\nb\nc',
        expected: {additions: 1, deletions: 0, hunks: 1, changes: [{type: 'add', content: 'a'}]}
    },
    {
        label: 'insert at end',
        a: 'a\nb',
        b: 'a\nb\nc',
        expected: {additions: 1, deletions: 0, hunks: 1, changes: [{type: 'add', content: 'c'}]}
    },
    {
        label: 'delete at start',
        a: 'a\nb\nc',
        b: 'b\nc',
        expected: {additions: 0, deletions: 1, hunks: 1, changes: [{type: 'remove', content: 'a'}]}
    },
    {
        label: 'delete at end',
        a: 'a\nb\nc',
        b: 'a\nb',
        expected: {additions: 0, deletions: 1, hunks: 1, changes: [{type: 'remove', content: 'c'}]}
    },
    {
        label: 'repeated lines',
        a: 'a\nb\na',
        b: 'a\na',
        expected: {additions: 0, deletions: 1, hunks: 1, changes: [{type: 'remove', content: 'b'}]}
    },
    {
        label: 'unicode insertion',
        a: '你好\n世界',
        b: '你好\n岚珞\n世界',
        expected: {additions: 1, deletions: 0, hunks: 1, changes: [{type: 'add', content: '岚珞'}]}
    },
    {
        label: 'emoji replacement',
        a: 'start\n🙂\nend',
        b: 'start\n🎮\nend',
        expected: {
            additions: 1,
            deletions: 1,
            hunks: 1,
            changes: [
                {type: 'remove', content: '🙂'},
                {type: 'add', content: '🎮'}
            ]
        }
    },
    {
        label: 'separated edits',
        a: 'a\nb\nc\nd\ne',
        b: 'a\nx\nc\nd\ny',
        expected: {additions: 2, deletions: 2, hunks: 2}
    },
    {
        label: 'trailing-newline input',
        a: 'a\nb\n',
        b: 'a\nx\nb\n',
        expected: {additions: 1, deletions: 0, hunks: 1, changes: [{type: 'add', content: 'x'}]}
    },
    {
        label: 'no-trailing-newline input',
        a: 'a\nb',
        b: 'a\nx\nb',
        expected: {additions: 1, deletions: 0, hunks: 1, changes: [{type: 'add', content: 'x'}]}
    }
];

const assertGoldenCases = () => {
    goldenCases.forEach(testCase => {
        const result = normalize(MyersDiff.compute(testCase.a, testCase.b));
        assertChangeSummary(testCase.label, result, testCase.expected);
        assert.deepStrictEqual(workerCompute(testCase.a, testCase.b), result,
            `${testCase.label}: Worker result diverged from primary MyersDiff.`);
    });
};

const referenceEditDistance = (a, b) => {
    const rows = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) rows[i][0] = i;
    for (let j = 0; j <= b.length; j++) rows[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            rows[i][j] = a[i - 1] === b[j - 1] ?
                rows[i - 1][j - 1] :
                Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1);
        }
    }
    return rows[a.length][b.length];
};

const assertEditScriptIsMinimalAndReplayable = (a, b, label) => {
    if (a.length === 0 || b.length === 0) return;
    const script = MyersDiff._myersDiffAlgorithm(a, b);
    let indexA = 0;
    let indexB = 0;
    let edits = 0;

    script.forEach(change => {
        if (change.type === 'same') {
            assert.strictEqual(change.lineA, indexA, `${label}: same lineA cursor mismatch.`);
            assert.strictEqual(change.lineB, indexB, `${label}: same lineB cursor mismatch.`);
            assert.strictEqual(a[indexA], b[indexB], `${label}: same operation points at different content.`);
            indexA++;
            indexB++;
        } else if (change.type === 'remove') {
            assert.strictEqual(change.lineA, indexA, `${label}: remove lineA cursor mismatch.`);
            assert.strictEqual(change.lineB, indexB, `${label}: remove lineB cursor mismatch.`);
            indexA++;
            edits++;
        } else if (change.type === 'add') {
            assert.strictEqual(change.lineA, indexA, `${label}: add lineA cursor mismatch.`);
            assert.strictEqual(change.lineB, indexB, `${label}: add lineB cursor mismatch.`);
            indexB++;
            edits++;
        } else {
            assert.fail(`${label}: unknown edit type ${change.type}.`);
        }
    });

    assert.strictEqual(indexA, a.length, `${label}: edit script did not consume source.`);
    assert.strictEqual(indexB, b.length, `${label}: edit script did not consume target.`);
    assert.strictEqual(edits, referenceEditDistance(a, b), `${label}: edit script is not minimal.`);
};

const createPrng = seed => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
};

const assertDeterministicFuzz = () => {
    const random = createPrng(0x00080907);
    const alphabet = ['a', 'b', 'c', '岚', '🎮'];
    const caseCount = 2500;

    for (let caseIndex = 0; caseIndex < caseCount; caseIndex++) {
        const lengthA = 1 + Math.floor(random() * 7);
        const lengthB = 1 + Math.floor(random() * 7);
        const a = Array.from({length: lengthA}, () => alphabet[Math.floor(random() * alphabet.length)]);
        const b = Array.from({length: lengthB}, () => alphabet[Math.floor(random() * alphabet.length)]);
        const label = `fuzz-${caseIndex}`;

        assertEditScriptIsMinimalAndReplayable(a, b, label);

        const textA = a.join('\n');
        const textB = b.join('\n');
        const primary = normalize(MyersDiff.compute(textA, textB));
        const repeated = normalize(MyersDiff.compute(textA, textB));
        assert.deepStrictEqual(repeated, primary, `${label}: primary diff is not deterministic.`);
        assert.deepStrictEqual(workerCompute(textA, textB), primary, `${label}: Worker parity failed.`);
    }

    return caseCount;
};

const assertLargeWorkerParity = () => {
    const source = Array.from({length: 1205}, (_, index) => `line-${index}`);
    const target = source.slice();
    target[602] = 'line-602-modified';
    target.splice(900, 0, 'line-899.5-added');

    const textA = source.join('\n');
    const textB = target.join('\n');
    const primary = normalize(MyersDiff.compute(textA, textB));
    const worker = workerCompute(textA, textB);

    assert.deepStrictEqual(worker, primary, 'Large diff Worker result diverged from primary MyersDiff.');
    assert.strictEqual(primary.totalAdditions, 2, 'Large diff addition count mismatch.');
    assert.strictEqual(primary.totalDeletions, 1, 'Large diff deletion count mismatch.');
};

const assertGitMyersDiffContract = () => {
    assert(MyersDiff && typeof MyersDiff.compute === 'function', 'MyersDiff.compute must be available.');
    assertGoldenCases();
    const fuzzCases = assertDeterministicFuzz();
    assertLargeWorkerParity();

    return {
        goldenCases: goldenCases.length,
        fuzzCases,
        workerParity: true,
        largeWorkerLines: 1205
    };
};

module.exports = {assertGitMyersDiffContract};
