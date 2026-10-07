'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS3C_DOCK_PLACEMENT_GEOMETRY_FAILED';
    throw error;
};
const passed = [];
const check = (condition, message) => {
    if (!condition) fail(message);
    passed.push(message);
};

const placement = read('src/lib/editor-shell/dock-placement-model.js');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const css = read('src/components/workspace-dock/workspace-dock.css');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    placement.includes("WORKSPACE_DOCK_PLACEMENT_MODEL_ID = 'ngvge.workspace-dock-placement-model@1'"),
    'stable Dock Placement Model identity'
);
check(
    placement.includes("DOCK_PLACEMENT_PREFERENCE_SCHEMA_ID = 'ngvge.workspace-dock-placement-preference@1'"),
    'versioned Dock placement preference schema identity'
);
check(placement.includes('DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION = 1'), 'Dock placement preference schema v1');
['top', 'bottom', 'left', 'right'].forEach(value => {
    check(placement.includes(`'${value}'`), `placement supports ${value}`);
});
['start', 'center', 'end'].forEach(value => {
    check(placement.includes(`'${value}'`), `alignment supports ${value}`);
});
check(
    placement.includes("placement: 'bottom'") && placement.includes("alignment: 'center'"),
    'WS-3B bottom-center appearance remains the WS-3C runtime default'
);
check(
    placement.includes('offsetX: 0') && placement.includes('offsetY: 0'),
    'Dock placement schema owns orthogonal offsetX/offsetY values'
);
check(
    placement.includes("placement === 'left' || placement === 'right' ? 'vertical' : 'horizontal'"),
    'placement deterministically projects horizontal/vertical orientation'
);
check(
    placement.includes("'--ngvge-dock-offset-x'") && placement.includes("'--ngvge-dock-offset-y'"),
    'placement projection exposes geometry through CSS variables'
);
check(
    placement.includes('setPlacement (placement)') && placement.includes('setAlignment (alignment)') &&
    placement.includes('setOffsets ({offsetX'),
    'runtime placement metadata has explicit mutation seams for future Workspace Settings'
);
check(
    placement.includes('assertKnownPreferenceFields') && placement.includes('unsupported field(s)'),
    'versioned Dock placement preference fails closed on unknown fields'
);
check(
    !placement.includes('localStorage') && !placement.includes('sessionStorage') && !placement.includes('windowStateStorage'),
    'WS-3C placement model remains runtime-only and defers persistence to WS-4'
);
check(
    !placement.includes('WindowManager') && !placement.includes('windowManager'),
    'Dock placement metadata does not take WindowManager authority'
);
check(
    !placement.includes('Scratch') && !placement.includes('renderer') && !placement.includes('vm.'),
    'Dock placement schema contains no Scratch/backend identity'
);
check(
    dock.includes('placementModel.getProjection()') && dock.includes('placementModel.subscribe('),
    'Dock presentation consumes live placement projection'
);
check(dock.includes('data-placement={placement.placement}'), 'Dock exposes data-driven placement');
check(dock.includes('data-alignment={placement.alignment}'), 'Dock exposes data-driven alignment');
check(dock.includes('data-orientation={placement.orientation}'), 'Dock exposes data-driven orientation');
check(dock.includes('style={placement.cssVariables}'), 'Dock consumes projected geometry variables');
check(
    dock.includes("placement.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'") &&
    dock.includes("placement.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'"),
    'keyboard reorder follows Dock orientation'
);
check(dock.includes('aria-orientation={placement.orientation}'), 'toolbar accessibility follows Dock orientation');
['top', 'bottom', 'left', 'right'].forEach(value => {
    check(css.includes(`.dock[data-placement="${value}"]`), `CSS projects ${value} edge geometry`);
});
['start', 'center', 'end'].forEach(value => {
    check(css.includes(`[data-alignment="${value}"]`), `CSS projects ${value} alignment geometry`);
});
check(
    css.includes('.dock[data-orientation="horizontal"] .track') &&
    css.includes('flex-direction: row'),
    'horizontal Dock geometry uses row track'
);
check(
    css.includes('.dock[data-orientation="vertical"] .track') &&
    css.includes('flex-direction: column'),
    'vertical Dock geometry uses column track'
);
check(
    css.includes('calc(50% + var(--ngvge-dock-offset-x))') &&
    css.includes('calc(50% + var(--ngvge-dock-offset-y))'),
    'center alignment honors screen-axis offsets'
);
check(
    gui.includes('new DockPlacementModel({') &&
    gui.includes('preference: workspacePersistenceBootstrap.layout.dock.placement') &&
    gui.includes('placementModel={dockPlacementModel}'),
    'production GUI owns one Dock Placement Model, initializes it from WS-4 preference, and passes it to Dock presentation'
);
check(
    gui.includes('data-ngvge-dock-placement-model') && gui.includes('WORKSPACE_DOCK_PLACEMENT_MODEL_ID'),
    'Workspace exposes stable placement model diagnostics'
);
check(
    !/dockPlacementModel[\s\S]{0,250}localStorage/.test(gui),
    'production GUI does not persist WS-3C placement through ad-hoc localStorage'
);
check(
    !dock.includes('groupId') && !dock.includes('folderId'),
    'WS-3C still defers group/folder presentation to WS-3D'
);
check(
    !placement.includes('Launchpad') && !placement.includes('launchpad'),
    'WS-3C placement authority remains independent from WS-3E Launchpad'
);
check(
    !css.includes('@keyframes') && !dock.includes('animationend'),
    'WS-3C does not implement WS-3F minimize animation'
);
check(
    packageJson.includes('test:workspace-shell:ws3c:focused') && packageJson.includes('test:workspace-shell:ws3c-webpack'),
    'WS-3C has repeatable focused and production-entry Webpack gates'
);

process.stdout.write(`WS-3C Dock Placement & Geometry PASS (${passed.length}/${passed.length}).\n`);
process.stdout.write(`${JSON.stringify({
    placementModel: 'ngvge.workspace-dock-placement-model@1',
    preferenceSchema: 'ngvge.workspace-dock-placement-preference@1',
    placements: ['top', 'bottom', 'left', 'right'],
    alignments: ['start', 'center', 'end'],
    offsets: ['offsetX', 'offsetY'],
    offsetSemantics: 'screen-axis: +X right, +Y down',
    persistence: 'runtime-only / WS-4 deferred',
    organizationPresentationDeferredTo: 'WS-3D',
    launchpadIntegration: 'WS-3E active / authority remains separate',
    minimizeAnimationDeferredTo: 'WS-3F',
    checks: passed.length
}, null, 2)}\n`);
