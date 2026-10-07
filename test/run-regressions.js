#!/usr/bin/env node
'use strict';

const {performance} = require('perf_hooks');
const {assertRuntimeDetachedPersistenceContract} = require('./contracts/runtime-detached-persistence');
const {assertGitMyersDiffContract} = require('./contracts/git-myers-diff');
const {assertGitSb3ReconstructionContract} = require('./contracts/git-sb3-reconstruction');

const suites = [
    {
        id: 'runtime-detached-persistence',
        run: () => assertRuntimeDetachedPersistenceContract()
    },
    {
        id: 'git-myers-diff',
        run: () => assertGitMyersDiffContract()
    },
    {
        id: 'git-sb3-reconstruction',
        run: () => assertGitSb3ReconstructionContract()
    }
];

const run = async () => {
    const startedAt = performance.now();
    const results = [];

    for (const suite of suites) {
        const suiteStartedAt = performance.now();
        try {
            const summary = await suite.run();
            const durationMs = Math.round(performance.now() - suiteStartedAt);
            results.push({id: suite.id, status: 'PASS', durationMs, summary});
            console.log(`PASS ${suite.id} (${durationMs} ms)`);
        } catch (error) {
            const durationMs = Math.round(performance.now() - suiteStartedAt);
            results.push({
                id: suite.id,
                status: 'FAIL',
                durationMs,
                error: error && error.message ? error.message : String(error)
            });
            console.error(`FAIL ${suite.id} (${durationMs} ms)`);
            console.error(error && error.stack ? error.stack : error);
            process.exitCode = 1;
        }
    }

    const passed = results.filter(result => result.status === 'PASS').length;
    const failed = results.filter(result => result.status === 'FAIL').length;
    const totalDurationMs = Math.round(performance.now() - startedAt);
    const report = {
        suite: 'NGVGE permanent regression layer',
        passed,
        failed,
        total: suites.length,
        totalDurationMs,
        results
    };

    console.log(JSON.stringify(report, null, 2));

    if (failed > 0 || passed !== suites.length) {
        process.exitCode = 1;
    }
};

run().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
