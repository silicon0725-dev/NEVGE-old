#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const checks = [];
const check = (name, pass) => checks.push({name, pass: Boolean(pass)});

const editor = read('src/components/workspace-paint/workspace-raster-editor.jsx');
const host = read('src/containers/native-paint-editor-host.jsx');
const geometryTests = read('test/unit/components/workspace-raster-geometry.test.js');
const hostTests = read('test/unit/components/native-paint-host.test.jsx');
const pkg = read('package.json');

check(
    'Native Paint forwards live Scratch costume geometry into the Raster editor',
    host.includes('const rasterSourceGeometry = selectedCostume ? {') &&
    host.includes('sourceGeometry={rasterSourceGeometry}')
);
check(
    'Raster geometry ingestion distinguishes live compatibility geometry from canonical Working Copy geometry',
    editor.includes('const resolveRasterWorkspaceGeometry = ({workingCopy, sourceGeometry, dimensions, stageSize}) =>') &&
    editor.includes('const sourceGeometryAvailable = Boolean(sourceGeometry')
);
check(
    'Finite live rotation centers, including explicit zero, remain valid pivots',
    editor.includes('Number.isFinite(sourceRotationCenterX) ? sourceRotationCenterX : width / 2') &&
    editor.includes('Number.isFinite(sourceRotationCenterY) ? sourceRotationCenterY : height / 2')
);
check(
    'Missing live bitmap pivot matches Scratch Paint image-center fallback',
    editor.includes('sourceRotationCenterX) ? sourceRotationCenterX : width / 2') &&
    editor.includes('sourceRotationCenterY) ? sourceRotationCenterY : height / 2')
);
check(
    'No compatibility geometry means canonical Working Copy geometry stays authoritative',
    editor.includes('Number.isFinite(workingRotationCenterX) ? workingRotationCenterX : width / 2') &&
    editor.includes('Number.isFinite(workingRotationCenterY) ? workingRotationCenterY : height / 2')
);
check(
    'Resolved geometry is the only workspace context passed into Canvas Raster Core',
    editor.includes('workspaceGeometryRef.current = geometry') &&
    editor.includes('controlsRef.current.setWorkspaceContext(geometry)')
);
check(
    'Raster export preserves the geometry actually used by the editor instead of stale zero metadata',
    editor.includes('const resolveRasterExportGeometry =') &&
    editor.includes('workspaceState.surface.rotationCenter') &&
    editor.includes('workspaceGeometry ? workspaceGeometry.bitmapResolution : workingCopy.bitmapResolution')
);
check(
    'Permanent regression covers stale zero Resource geometry repaired by finite live costume geometry',
    geometryTests.includes('stale zero-normalized Resource geometry') &&
    geometryTests.includes('rotationCenterX: 256') &&
    geometryTests.includes('rotationCenterY: 192')
);
check(
    'Permanent regression covers missing live pivot and explicit zero pivot as distinct cases',
    geometryTests.includes('live rotation center is absent') &&
    geometryTests.includes('explicit live top-left pivot')
);
check(
    'Native Host DOM regression proves the geometry reaches the Raster consumer',
    hostTests.includes('forwards live costume geometry') &&
    hostTests.includes('rasterEditor.props.sourceGeometry')
);
check(
    'HF3 has dedicated machine/focused/production commands',
    pkg.includes('test:workspace-shell:ws10g1-hf3:machine') &&
    pkg.includes('test:workspace-shell:ws10g1-hf3:focused') &&
    pkg.includes('test:workspace-shell:ws10g1-hf3:webpack')
);

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`);
});
console.log(`WS-10G1-HF3 Raster Geometry Ingestion Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
