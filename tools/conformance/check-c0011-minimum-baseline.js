#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CERTIFICATE_SCHEMA = 'ngvge-arc-c001.1-minimum-baseline-certificate/v1';
const EXPECTED_REQUIREMENTS = Object.freeze([
    ['import-boundary', 'test:conformance:import-boundary'],
    ['stable-identity', 'test:conformance:stable-identity'],
    ['persistent-dto', 'test:conformance:persistent-dto'],
    ['schema-registry', 'test:conformance:schema-registry'],
    ['authority-registry', 'test:conformance:authority-registry'],
    ['protocol-dto', 'test:conformance:protocol-dto'],
    ['scratch-adapter-boundary', 'test:conformance:scratch-adapter-boundary']
]);

const readJSON = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const findRecord = (records, id) => Array.isArray(records) ? records.find(record => record && record.id === id) : null;

const validateMinimumBaselineSnapshot = snapshot => {
    const issues = [];
    const addIssue = (code, message) => issues.push(Object.freeze({code, message}));

    const packageScripts = snapshot.packageJson && snapshot.packageJson.scripts;
    if (!packageScripts || typeof packageScripts !== 'object') {
        addIssue('C0011_BASELINE_PACKAGE_SCRIPTS_MISSING', 'package.json scripts are unavailable.');
    }

    const certificate = snapshot.certificate;
    if (!certificate || certificate.schema !== CERTIFICATE_SCHEMA) {
        addIssue('C0011_BASELINE_CERTIFICATE_SCHEMA_INVALID', `Expected certificate schema ${CERTIFICATE_SCHEMA}.`);
    }

    const requirements = certificate && Array.isArray(certificate.requirements) ? certificate.requirements : [];
    if (requirements.length !== EXPECTED_REQUIREMENTS.length) {
        addIssue('C0011_BASELINE_REQUIREMENT_COUNT_INVALID', `Expected ${EXPECTED_REQUIREMENTS.length} certified requirements.`);
    }

    for (const [id, entrypoint] of EXPECTED_REQUIREMENTS) {
        const requirement = requirements.find(item => item && item.id === id);
        if (!requirement) {
            addIssue('C0011_BASELINE_REQUIREMENT_MISSING', `Missing certified requirement: ${id}.`);
            continue;
        }
        if (requirement.status !== 'covered') {
            addIssue('C0011_BASELINE_REQUIREMENT_NOT_COVERED', `${id} must be covered.`);
        }
        if (requirement.entrypoint !== entrypoint) {
            addIssue('C0011_BASELINE_ENTRYPOINT_MISMATCH', `${id} must use ${entrypoint}.`);
        }
        if (!packageScripts || typeof packageScripts[entrypoint] !== 'string' || packageScripts[entrypoint].trim() === '') {
            addIssue('C0011_BASELINE_ENTRYPOINT_UNAVAILABLE', `Missing executable package entrypoint: ${entrypoint}.`);
        }
    }

    if (!certificate || certificate.status !== 'certified') {
        addIssue('C0011_BASELINE_NOT_CERTIFIED', 'Certificate status must be certified.');
    }
    if (!certificate || certificate.c0011MinimumSatisfied !== 7 || certificate.c0011MinimumTotal !== 7) {
        addIssue('C0011_BASELINE_COVERAGE_INVALID', 'Certificate must record 7/7 C001.1 minimum coverage.');
    }
    if (!certificate || certificate.activeArchitectureWaivers !== 0) {
        addIssue('C0011_BASELINE_ACTIVE_WAIVER', 'Minimum baseline certification requires zero active Architecture Waivers.');
    }
    if (!certificate || certificate.blockingFindings !== 0) {
        addIssue('C0011_BASELINE_BLOCKING_FINDING', 'Minimum baseline certification requires zero active blocking findings.');
    }
    if (!certificate || certificate.transform0009Decision !== 'unlocked-for-entry') {
        addIssue('C0011_BASELINE_0009_DECISION_INVALID', 'Certificate must explicitly unlock 0009 for entry.');
    }
    if (certificate && certificate.blockingMergePolicyActive !== false) {
        addIssue('C0011_BASELINE_BLOCKING_CI_SCOPE_VIOLATION', 'C001.1-H must not claim C001.6 Blocking Merge Policy activation.');
    }

    const waiverRegistry = snapshot.waiverRegistry;
    const activeWaivers = waiverRegistry && Array.isArray(waiverRegistry.activeWaivers) ? waiverRegistry.activeWaivers : null;
    if (!activeWaivers || activeWaivers.length !== 0) {
        addIssue('C0011_BASELINE_WAIVER_REGISTRY_NOT_CLEAR', 'LEGACY-WAIVERS.json must contain zero active waivers.');
    }

    const debt = snapshot.debtBaseline;
    const unresolvedBlockers = debt && Array.isArray(debt.items) ? debt.items.filter(item => {
        if (!item || item.status === 'resolved') return false;
        return item.blocksC0011 === true || item.blocks0009 === true;
    }) : [];
    if (unresolvedBlockers.length > 0) {
        addIssue('C0011_BASELINE_UNRESOLVED_DEBT_BLOCKER', `Unresolved C001.1/0009 blockers: ${unresolvedBlockers.map(item => item.id).join(', ')}.`);
    }

    const arcStatus = snapshot.arcStatus;
    const arcC0011H = findRecord(arcStatus && arcStatus.records, 'ARC-C001.1-H');
    const transform0009 = findRecord(arcStatus && arcStatus.records, '0009');
    if (!arcC0011H || arcC0011H.status !== 'complete' || arcC0011H.execution !== 'certified') {
        addIssue('C0011_BASELINE_ARC_STATUS_NOT_CERTIFIED', 'ARC-STATUS-MATRIX must record ARC-C001.1-H as complete/certified.');
    }
    const transform0009StillAtEntry = transform0009 &&
        transform0009.status === 'ready' && transform0009.execution === 'unlocked-by-arc-c001.1-h';
    const transform0009ProgressedFromCertifiedEntry = transform0009 &&
        ['active', 'complete'].includes(transform0009.status) &&
        transform0009.entryBaseline === 'arc-c001.1-h-certified';
    if (!transform0009StillAtEntry && !transform0009ProgressedFromCertifiedEntry) {
        addIssue(
            'C0011_BASELINE_0009_STATUS_NOT_READY',
            'ARC-STATUS-MATRIX must preserve the certified ARC-C001.1-H entry lineage for 0009.'
        );
    }

    const conformance = snapshot.conformanceStatus;
    const summary = conformance && conformance.summary;
    if (!summary || summary.c0011RequirementsSatisfied !== 7 || summary.c0011RequirementsMissing !== 0 ||
        summary.c0011RequirementsPartialOrHistorical !== 0 || summary.c0011RequirementsBlocked !== 0) {
        addIssue('C0011_BASELINE_CONFORMANCE_SUMMARY_INVALID', 'Conformance status matrix must report 7/7 minimum requirements with no missing/partial/blocked requirement.');
    }
    if (!summary || summary.c0011Status !== 'certified-complete' || summary.transform0009Status !== 'ready-unlocked-for-entry') {
        addIssue('C0011_BASELINE_CONFORMANCE_DECISION_MISMATCH', 'Conformance status matrix must agree with the H certification and 0009 unlock decision.');
    }
    if (!conformance || !conformance.authority || conformance.authority.blockingMergePolicyActive !== false) {
        addIssue('C0011_BASELINE_C0016_SCOPE_MISMATCH', 'Conformance authority must keep Blocking Merge Policy inactive until C001.6.');
    }

    return Object.freeze({
        valid: issues.length === 0,
        issues: Object.freeze(issues.slice()),
        requirementsChecked: EXPECTED_REQUIREMENTS.length
    });
};

const readRepositorySnapshot = rootDir => ({
    packageJson: readJSON(path.join(rootDir, 'package.json')),
    certificate: readJSON(path.join(rootDir, 'docs/architecture/ARC-C001.1-H-MINIMUM-BASELINE-CERTIFICATE.json')),
    arcStatus: readJSON(path.join(rootDir, 'docs/architecture/ARC-STATUS-MATRIX.json')),
    conformanceStatus: readJSON(path.join(rootDir, 'docs/architecture/conformance/CONFORMANCE-STATUS-MATRIX.json')),
    waiverRegistry: readJSON(path.join(rootDir, 'docs/architecture/LEGACY-WAIVERS.json')),
    debtBaseline: readJSON(path.join(rootDir, 'docs/architecture/TECHNICAL-DEBT-BASELINE.json'))
});

const run = rootDir => {
    const snapshot = readRepositorySnapshot(rootDir);
    const result = validateMinimumBaselineSnapshot(snapshot);
    if (!result.valid) {
        for (const issue of result.issues) {
            console.error(`${issue.code}: ${issue.message}`);
        }
        process.exitCode = 1;
        return result;
    }

    console.log(`ARC-C001.1 Minimum Baseline Certification PASS: ${result.requirementsChecked}/7 requirements, 0 active waivers, 0 blockers; 0009 unlocked for entry.`);
    return result;
};

if (require.main === module) {
    run(path.resolve(__dirname, '../..'));
}

module.exports = {
    CERTIFICATE_SCHEMA,
    EXPECTED_REQUIREMENTS,
    validateMinimumBaselineSnapshot,
    readRepositorySnapshot,
    run
};
