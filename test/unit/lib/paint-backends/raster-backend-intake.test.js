import {
    MINIPAINT_BACKEND_ID,
    PISKEL_BACKEND_ID,
    SCRATCH_PAINT_COMPAT_BACKEND_ID
} from '../../../../src/lib/paint-backends/paint-backend-candidates';
import {
    RASTER_BACKEND_INTAKE_ID,
    REJECTED_RASTER_AUTHORITIES,
    getRasterBackendIntake
} from '../../../../src/lib/paint-backends/raster-backend-intake';

describe('WS-10G0 controlled OSS Raster intake', () => {
    test('records miniPaint implementation surfaces without importing its application authority', () => {
        const intake = getRasterBackendIntake(MINIPAINT_BACKEND_ID);
        expect(intake.intakeId).toBe(RASTER_BACKEND_INTAKE_ID);
        expect(intake.strategy).toBe('controlled-extraction');
        expect(intake.license).toBe('MIT');
        expect(intake.licenseFile).toBe('MIT-LICENSE.txt');
        expect(intake.observedCommit).toBe('a79733eb803fc97084ef0ee4faa96b031e69e1c0');
        expect(intake.verifiedSourcePaths).toContain('src/js/core/base-layers.js');
        expect(intake.verifiedSourcePaths).toContain('src/js/tools/brush.js');
        expect(intake.verifiedSourcePaths).toContain('src/js/tools/fill.js');
        expect(intake.rejectedSurfaces).toContain('app-shell');
        expect(intake.rejectedSurfaces).toContain('file-open-save');
        expect(intake.rejectedSurfaces).toContain('persistence');
    });

    test('records Piskel pixel algorithms, palette and onion skin as implementation support only', () => {
        const intake = getRasterBackendIntake(PISKEL_BACKEND_ID);
        expect(intake.strategy).toBe('controlled-extraction');
        expect(intake.license).toBe('Apache-2.0');
        expect(intake.observedCommit).toBe('a6b9c02daefceb10093f71e92d52d16920ccb16e');
        expect(intake.verifiedSourcePaths).toContain('src/js/tools/drawing/SimplePen.js');
        expect(intake.verifiedSourcePaths).toContain('src/js/service/palette/PaletteService.js');
        expect(intake.verifiedSourcePaths).toContain('src/js/rendering/OnionSkinRenderer.js');
        expect(intake.rejectedSurfaces).toContain('timeline');
        expect(intake.rejectedSurfaces).toContain('frame-id');
        expect(intake.rejectedSurfaces).toContain('layer-id');
    });

    test('keeps Scratch Paint as a compatibility/reference source rather than a new backend authority', () => {
        const intake = getRasterBackendIntake(SCRATCH_PAINT_COMPAT_BACKEND_ID);
        expect(intake.strategy).toBe('compatibility-reference');
        expect(intake.license).toBe('AGPL-3.0');
        expect(intake.observedCommit).toBe('f8966f09df9a994c207db10b4ab52f530a1172d8');
        expect(intake.verifiedSourcePaths).toEqual(expect.arrayContaining([
            'src/helper/view.js',
            'src/helper/layer.js',
            'src/containers/paper-canvas.jsx',
            'src/containers/scrollable-canvas.jsx'
        ]));
    });

    test('globally rejects all ARC-0001 / WS-10D / WS-10E authority leaks', () => {
        expect(REJECTED_RASTER_AUTHORITIES).toEqual(expect.arrayContaining([
            'semantic-identity',
            'project',
            'resource',
            'transaction',
            'persistence',
            'timeline',
            'frame-id',
            'layer-id',
            'cel-id',
            'workspace-window'
        ]));
    });
});
