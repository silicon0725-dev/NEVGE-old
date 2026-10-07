#!/usr/bin/env node
'use strict';

const {performance} = require('perf_hooks');
const {assertRuntimeDetachedPersistenceContract} = require('./contracts/runtime-detached-persistence');
const {assertGitMyersDiffContract} = require('./contracts/git-myers-diff');
const {assertGitSb3ReconstructionContract} = require('./contracts/git-sb3-reconstruction');
const {assertSceneBinaryAssetBoundaryContract} = require('./contracts/scene-binary-asset-boundary');
const {assertSceneV2BoundaryContract} = require('./contracts/scene-v2-boundary');
const {assertSceneV2ScopeNavigationContract} = require('./contracts/scene-v2-scope-navigation');
const {assertModuleCapabilityTeardownLeaseContract} = require('./contracts/module-capability-teardown-lease');
const {assertProjectNodeStableIdentityContract} = require('./contracts/project-node-stable-identity');
const {assertPersistentDTOBoundaryContract} = require('./contracts/persistent-dto-boundary');
const {assertSchemaRegistryBoundaryContract} = require('./contracts/schema-registry-boundary');
const {assertAuthorityRegistryBoundaryContract} = require('./contracts/authority-registry-boundary');
const {assertProtocolDTOBoundaryContract} = require('./contracts/protocol-dto-boundary');
const {assertScratchAdapterBoundaryContract} = require('./contracts/scratch-adapter-boundary');
const {assertC0011MinimumBaselineContract} = require('./contracts/c0011-minimum-baseline');
const {assertTransform2DSemanticContract} = require('./contracts/transform2d-semantic-contract');
const {assertTransform2DRuntimeWiringContract} = require('./contracts/transform2d-runtime-wiring');
const {assertScratchTransformProjectionContract} = require('./contracts/scratch-transform-projection');
const {assertTransform2DEditorCommandBridgeContract} = require('./contracts/transform2d-editor-command-bridge');
const {assertTransform2DDoDCertificationContract} = require('./contracts/transform2d-dod-certification');
const {assertFunctionalNodeFoundationContract} = require('./contracts/functional-node-foundation');
const {assertTransform2DWriterRoutingContract} = require('./contracts/transform2d-writer-routing');
const {assertFunctionalNodeCreationContract} = require('./contracts/functional-node-creation');
const {assertFunctionalNodeProductBoundaryContract} = require('./contracts/functional-node-product-boundary');
const {assertScratchRoleManagerParityContract} = require('./contracts/scratch-role-manager-parity');
const {assertNodeExplorerKeyboardCommandScopeContract} = require('./contracts/node-explorer-keyboard-command-scope');
const {assertCollider2DArea2DContract} = require('./contracts/collider2d-area2d');
const {assertCharacterController2DContract} = require('./contracts/character-controller2d');
const {assertInspectorAuthoringUnificationContract} = require('./contracts/inspector-authoring-unification');
const {assertCollisionDebugTestDriveContract} = require('./contracts/collision-debug-test-drive');
const {assertCollider2DAuthoringCompletenessContract} = require('./contracts/collider2d-authoring-completeness');
const {assertFunctionalCollisionLegacyBoundaryContract} = require('./contracts/functional-collision-legacy-boundary');
const {assertTransientTransformDragPreviewContract} = require('./contracts/transient-transform-drag-preview');
const {assertTileSetTileMapLayer2DContract} = require('./contracts/tileset-tilemap-layer2d');
const {assertPhysics2DBackendPOCContract} = require('./contracts/physics2d-backend-poc');
const {assertPhysicsCollisionPerformanceContract} = require('./contracts/physics-collision-performance');
const {assertStageHotPathProjectionContract} = require('./contracts/stage-hot-path-projection');
const {assertPerformanceQualityProfilesContract} = require('./contracts/performance-quality-profiles');
const {assertFrameTimeProfilerContract} = require('./contracts/frame-time-profiler');
const {assertRuntimePhaseSchedulerContract} = require('./contracts/runtime-phase-scheduler');
const {assertTransientColliderAuthoringContract} = require('./contracts/transient-collider-authoring');
const {assertBrowserMainThreadAttributionContract} = require('./contracts/browser-main-thread-attribution');
const {assertPointerMoveFrameCoalescingContract} = require('./contracts/pointer-move-frame-coalescing');
const {assertPreviewNotificationContainmentContract} = require('./contracts/preview-notification-containment');
const {assertSelectedColliderPreviewFastPathContract} = require('./contracts/selected-collider-preview-fast-path');
const {assertSelectedColliderDOMPresentationFastPathContract} = require('./contracts/selected-collider-dom-presentation-fast-path');
const {assertRuntimeSchedulerPhaseAttributionContract} = require('./contracts/runtime-scheduler-phase-attribution');
const {assertRapierShapeAwareCollisionContract} = require('./contracts/rapier-shape-aware-collision');
const {assertSolidOnlyColliderRefreshContract} = require('./contracts/solid-only-collider-refresh');
const {assertPhysicsSchedulerBacklogContainmentContract} = require('./contracts/physics-scheduler-backlog-containment');
const {assertSelectedColliderPassivePresentationFastPathContract} = require('./contracts/selected-collider-passive-presentation-fast-path');
const {assertSelectedColliderAffectedSetFastPathContract} = require('./contracts/selected-collider-affected-set-fast-path');
const {assertStaticTileMapCollisionProjectionReuseContract} = require('./contracts/static-tilemap-collision-projection-reuse');
const {assertScratchContinuousMotionUIContainmentContract} = require('./contracts/scratch-continuous-motion-ui-containment');
const {assertScratchPassiveTargetToolboxMouseLayoutContainmentContract} = require('./contracts/scratch-passive-target-toolbox-mouse-layout-containment');
const {assertScratchDrivenColliderRefreshContainmentContract} = require('./contracts/scratch-driven-collider-refresh-containment');
const {assertMixedAffectedColliderRoutingContract} = require('./contracts/mixed-affected-collider-routing');

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
    },
    {
        id: 'scene-binary-asset-boundary',
        run: () => assertSceneBinaryAssetBoundaryContract()
    },
    {
        id: 'scene-v2-boundary',
        run: () => assertSceneV2BoundaryContract()
    }
,
    {
        id: 'scene-v2-scope-navigation',
        run: () => assertSceneV2ScopeNavigationContract()
    },
    {
        id: 'module-capability-teardown-lease',
        run: () => assertModuleCapabilityTeardownLeaseContract()
    },
    {
        id: 'project-node-stable-identity',
        run: () => assertProjectNodeStableIdentityContract()
    },
    {
        id: 'persistent-dto-boundary',
        run: () => assertPersistentDTOBoundaryContract()
    }
,
    {
        id: 'schema-registry-boundary',
        run: () => assertSchemaRegistryBoundaryContract()
    }
,
    {
        id: 'authority-registry-boundary',
        run: () => assertAuthorityRegistryBoundaryContract()
    }
,
    {
        id: 'protocol-dto-boundary',
        run: () => assertProtocolDTOBoundaryContract()
    },
    {
        id: 'scratch-adapter-boundary',
        run: () => assertScratchAdapterBoundaryContract()
    },
    {
        id: 'c0011-minimum-baseline',
        run: () => assertC0011MinimumBaselineContract()
    },
    {
        id: 'transform2d-semantic-contract',
        run: () => assertTransform2DSemanticContract()
    }
,
    {
        id: 'transform2d-runtime-wiring',
        run: () => assertTransform2DRuntimeWiringContract()
    },
    {
        id: 'scratch-transform-projection',
        run: () => assertScratchTransformProjectionContract()
    },
    {
        id: 'transform2d-editor-command-bridge',
        run: () => assertTransform2DEditorCommandBridgeContract()
    },
    {
        id: 'transform2d-dod-certification',
        run: () => assertTransform2DDoDCertificationContract()
    },
    {
        id: 'functional-node-foundation',
        run: () => assertFunctionalNodeFoundationContract()
    },
    {
        id: 'transform2d-writer-routing',
        run: () => assertTransform2DWriterRoutingContract()
    },
    {
        id: 'functional-node-creation',
        run: () => assertFunctionalNodeCreationContract()
    },
    {
        id: 'functional-node-product-boundary',
        run: () => assertFunctionalNodeProductBoundaryContract()
    },
    {
        id: 'scratch-role-manager-parity',
        run: () => assertScratchRoleManagerParityContract()
    },
    {
        id: 'node-explorer-keyboard-command-scope',
        run: () => assertNodeExplorerKeyboardCommandScopeContract()
    },
    {
        id: 'collider2d-area2d',
        run: () => assertCollider2DArea2DContract()
    },
    {
        id: 'character-controller2d',
        run: () => assertCharacterController2DContract()
    },
    {
        id: 'inspector-authoring-unification',
        run: () => assertInspectorAuthoringUnificationContract()
    },
    {
        id: 'collision-debug-test-drive',
        run: () => assertCollisionDebugTestDriveContract()
    },
    {
        id: 'collider2d-authoring-completeness',
        run: () => assertCollider2DAuthoringCompletenessContract()
    },
    {
        id: 'functional-collision-legacy-boundary',
        run: () => assertFunctionalCollisionLegacyBoundaryContract()
    },
    {
        id: 'transient-transform-drag-preview',
        run: () => assertTransientTransformDragPreviewContract()
    },
    {
        id: 'tileset-tilemap-layer2d',
        run: () => assertTileSetTileMapLayer2DContract()
    },
    {
        id: 'physics2d-backend-poc',
        run: () => assertPhysics2DBackendPOCContract()
    },
    {
        id: 'physics-collision-performance',
        run: () => assertPhysicsCollisionPerformanceContract()
    },
    {
        id: 'stage-hot-path-projection',
        run: () => assertStageHotPathProjectionContract()
    },
    {
        id: 'performance-quality-profiles',
        run: () => assertPerformanceQualityProfilesContract()
    },
    {
        id: 'frame-time-profiler',
        run: () => assertFrameTimeProfilerContract()
    },
    {
        id: 'runtime-phase-scheduler',
        run: () => assertRuntimePhaseSchedulerContract()
    },
    {
        id: 'transient-collider-authoring',
        run: () => assertTransientColliderAuthoringContract()
    },
    {
        id: 'browser-main-thread-attribution',
        run: () => assertBrowserMainThreadAttributionContract()
    },
    {
        id: 'pointer-move-frame-coalescing',
        run: () => assertPointerMoveFrameCoalescingContract()
    },
    {
        id: 'preview-notification-containment',
        run: () => assertPreviewNotificationContainmentContract()
    },
    {
        id: 'selected-collider-preview-fast-path',
        run: () => assertSelectedColliderPreviewFastPathContract()
    },
    {
        id: 'selected-collider-dom-presentation-fast-path',
        run: () => assertSelectedColliderDOMPresentationFastPathContract()
    },
    {
        id: 'runtime-scheduler-phase-attribution',
        run: () => assertRuntimeSchedulerPhaseAttributionContract()
    },
    {
        id: 'rapier-shape-aware-collision',
        run: () => assertRapierShapeAwareCollisionContract()
    },
    {
        id: 'solid-only-collider-refresh',
        run: () => assertSolidOnlyColliderRefreshContract()
    },
    {
        id: 'physics-scheduler-backlog-containment',
        run: () => assertPhysicsSchedulerBacklogContainmentContract()
    },
    {
        id: 'selected-collider-passive-presentation-fast-path',
        run: () => assertSelectedColliderPassivePresentationFastPathContract()
    },
    {
        id: 'selected-collider-affected-set-fast-path',
        run: () => assertSelectedColliderAffectedSetFastPathContract()
    },
    {
        id: 'static-tilemap-collision-projection-reuse',
        run: () => assertStaticTileMapCollisionProjectionReuseContract()
    },
    {
        id: 'scratch-continuous-motion-ui-containment',
        run: () => assertScratchContinuousMotionUIContainmentContract()
    },
    {
        id: 'scratch-passive-target-toolbox-mouse-layout-containment',
        run: () => assertScratchPassiveTargetToolboxMouseLayoutContainmentContract()
    },
    {
        id: 'scratch-driven-collider-refresh-containment',
        run: () => assertScratchDrivenColliderRefreshContainmentContract()
    },
    {
        id: 'mixed-affected-collider-routing',
        run: () => assertMixedAffectedColliderRoutingContract()
    },
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
