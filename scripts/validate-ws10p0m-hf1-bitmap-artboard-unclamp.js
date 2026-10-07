const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const checks = [];
const check = (name, condition) => {
    if (!condition) throw new Error(`WS-10P0M-HF1 check failed: ${name}`);
    checks.push(name);
};

const layer = read('src/lib/vendor/scratch-paint/src/helper/layer.js');
const view = read('src/lib/vendor/scratch-paint/src/helper/view.js');
const canvas = read('src/lib/vendor/scratch-paint/src/containers/paper-canvas.jsx');
const selectionBox = read('src/lib/vendor/scratch-paint/src/helper/selection-tools/selection-box-tool.js');
const brush = read('src/lib/vendor/scratch-paint/src/helper/bit-tools/brush-tool.js');
const line = read('src/lib/vendor/scratch-paint/src/helper/bit-tools/line-tool.js');
const fill = read('src/lib/vendor/scratch-paint/src/helper/bit-tools/fill-tool.js');
const bitmap = read('src/lib/vendor/scratch-paint/src/helper/bitmap.js');
const updateImage = read('src/lib/vendor/scratch-paint/src/hocs/update-image-hoc.jsx');
const textTool = read('src/lib/vendor/scratch-paint/src/helper/tools/text-tool.js');
const workspaceGeometry = read('src/lib/vendor/scratch-paint/src/helper/raster-workspace.js');

check('pure raster storage expansion helper exists', workspaceGeometry.includes('expandRasterStorageBounds'));
check('raster backing storage can grow independently from stage guide', layer.includes('const ensureRasterBounds = function'));
check('raster growth preserves old pixels with offset', layer.includes('target.oldPixelOffsetX') && layer.includes('target.oldPixelOffsetY'));
check('stage outline remains ART_BOARD_BOUNDS guide', layer.includes('new paper.Shape.Rectangle(ART_BOARD_BOUNDS.expand(1))'));
check('bitmap checkerboard is workspace-sized rather than stage-sized',
    layer.includes('const bWorkspaceBounds = new paper.Shape.Rectangle(MAX_WORKSPACE_BOUNDS)'));
check('bitmap import expands backing raster to decoded image bounds',
    canvas.includes('const imageBounds = new paper.Rectangle') && canvas.includes('ensureRasterBounds(imageBounds)'));
check('bitmap import no longer installs fixed raster clip mask',
    !canvas.includes('const mask = new paper.Shape.Rectangle(getRaster().getBounds())'));
check('bitmap tool action bounds include current raster bounds',
    view.includes('.unite(getRaster().bounds)'));
check('bitmap rectangular selection clamps to raster bounds instead of ART_BOARD dimensions',
    selectionBox.includes('const rasterBounds = getRaster().bounds') && !selectionBox.includes('Math.min(ART_BOARD_WIDTH'));
check('brush expands backing raster to writable visible view',
    brush.includes('ensureRasterBounds(paper.view.bounds') && brush.includes('projectToRasterPoint'));
check('line tool expands backing raster and uses raster-local coordinates',
    line.includes('ensureRasterBounds(paper.view.bounds') && line.includes('projectToRasterPoint'));
check('fill converts project coordinates to raster-local coordinates', fill.includes('projectToRasterPoint(event.point, raster)'));
check('text rasterization expands storage before commit', textTool.includes('ensureRasterBounds(textRaster.bounds)'));
check('moved/scaled bitmap selection expands storage before export plastering',
    updateImage.includes('ensureRasterBounds(selectedItems[0].drawnBounds.expand(4))'));
check('selection commit can expand authored bitmap storage', bitmap.includes('ensureRasterBounds(selection.drawnBounds.expand(4))'));
check('rectangle commit can expand authored bitmap storage', bitmap.includes('ensureRasterBounds(rect.drawnBounds.expand'));
check('oval commit can expand authored bitmap storage', bitmap.includes('ensureRasterBounds(oval.drawnBounds.expand'));
check('vector workspace branch remains separate from bitmap action policy',
    view.includes('return paper.view.bounds.unite(ART_BOARD_BOUNDS).unite(getWorkspaceBounds());'));

console.log(`WS-10P0M-HF1 Bitmap Artboard Unclamp gate: ${checks.length}/${checks.length} PASS`);
checks.forEach((name, index) => console.log(`${String(index + 1).padStart(2, '0')}. PASS ${name}`));
