#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    CERTIFICATE_SCHEMA,
    EXPECTED_REQUIREMENTS,
    validateMinimumBaselineSnapshot
} = require('./check-c0011-minimum-baseline');

const makeSnapshot = () => ({
    packageJson: {
        scripts: Object.fromEntries(EXPECTED_REQUIREMENTS.map(([, entrypoint]) => [entrypoint, `node ${entrypoint}.js`]))
    },
    certificate: {
        schema: CERTIFICATE_SCHEMA,
        status: 'certified',
        c0011MinimumSatisfied: 7,
        c0011MinimumTotal: 7,
        activeArchitectureWaivers: 0,
        blockingFindings: 0,
        blockingMergePolicyActive: false,
        transform0009Decision: 'unlocked-for-entry',
        requirements: EXPECTED_REQUIREMENTS.map(([id, entrypoint]) => ({id, entrypoint, status: 'covered'}))
    },
    arcStatus: {
        records: [
            {id: 'ARC-C001.1-H', status: 'complete', execution: 'certified'},
            {id: '0009', status: 'ready', execution: 'unlocked-by-arc-c001.1-h'}
        ]
    },
    conformanceStatus: {
        authority: {blockingMergePolicyActive: false},
        summary: {
            c0011RequirementsSatisfied: 7,
            c0011RequirementsPartialOrHistorical: 0,
            c0011RequirementsMissing: 0,
            c0011RequirementsBlocked: 0,
            c0011Status: 'certified-complete',
            transform0009Status: 'ready-unlocked-for-entry'
        }
    },
    waiverRegistry: {activeWaivers: []},
    debtBaseline: {items: []}
});

const cases = [];
const test = (name, mutate, expectedCode) => {
    const snapshot = makeSnapshot();
    mutate(snapshot);
    const result = validateMinimumBaselineSnapshot(snapshot);
    assert.strictEqual(result.valid, false, `${name} should fail closed`);
    assert(result.issues.some(issue => issue.code === expectedCode), `${name} should report ${expectedCode}`);
    cases.push(name);
};

assert.strictEqual(validateMinimumBaselineSnapshot(makeSnapshot()).valid, true, 'valid baseline should certify');
cases.push('valid-baseline');

const progressedSnapshot = makeSnapshot();
const progressed0009 = progressedSnapshot.arcStatus.records.find(record => record.id === '0009');
progressed0009.status = 'active';
progressed0009.execution = '0009-a-semantic-contract-complete';
progressed0009.entryBaseline = 'arc-c001.1-h-certified';
assert.strictEqual(
    validateMinimumBaselineSnapshot(progressedSnapshot).valid,
    true,
    'C001.1-H certification must remain valid after 0009 legitimately progresses from the certified entry baseline'
);
cases.push('valid-progressed-0009-lineage');

test('missing-gate-entrypoint', snapshot => {
    delete snapshot.packageJson.scripts['test:conformance:protocol-dto'];
}, 'C0011_BASELINE_ENTRYPOINT_UNAVAILABLE');

test('active-waiver', snapshot => {
    snapshot.waiverRegistry.activeWaivers.push({waiverId: 'W'});
}, 'C0011_BASELINE_WAIVER_REGISTRY_NOT_CLEAR');

test('unresolved-0009-blocker', snapshot => {
    snapshot.debtBaseline.items.push({id: 'BLOCK', blocks0009: true});
}, 'C0011_BASELINE_UNRESOLVED_DEBT_BLOCKER');

test('certificate-not-certified', snapshot => {
    snapshot.certificate.status = 'pending';
}, 'C0011_BASELINE_NOT_CERTIFIED');

test('0009-not-ready', snapshot => {
    snapshot.arcStatus.records.find(record => record.id === '0009').status = 'blocked';
}, 'C0011_BASELINE_0009_STATUS_NOT_READY');

test('conformance-matrix-disagrees', snapshot => {
    snapshot.conformanceStatus.summary.transform0009Status = 'blocked';
}, 'C0011_BASELINE_CONFORMANCE_DECISION_MISMATCH');

test('blocking-ci-overclaim', snapshot => {
    snapshot.certificate.blockingMergePolicyActive = true;
}, 'C0011_BASELINE_BLOCKING_CI_SCOPE_VIOLATION');

console.log(`ARC-C001.1 Minimum Baseline self-test PASS (${cases.length}/${cases.length}).`);
