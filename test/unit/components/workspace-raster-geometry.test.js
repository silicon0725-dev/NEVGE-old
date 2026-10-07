import {
    resolveRasterExportGeometry,
    resolveRasterWorkspaceGeometry
} from '../../../src/components/workspace-paint/workspace-raster-editor.jsx';

describe('WS-10G1-HF3 Raster geometry ingestion', () => {
    const workingCopy = {
        bitmapResolution: 2,
        rotationCenterX: 0,
        rotationCenterY: 0
    };
    const dimensions = {width: 512, height: 384};
    const stageSize = {width: 480, height: 360};

    test('uses live Scratch costume geometry instead of stale zero-normalized Resource geometry', () => {
        expect(resolveRasterWorkspaceGeometry({
            workingCopy,
            sourceGeometry: {bitmapResolution: 2, rotationCenterX: 256, rotationCenterY: 192},
            dimensions,
            stageSize
        })).toEqual({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 256,
            rotationCenterY: 192,
            bitmapResolution: 2
        });
    });

    test('matches Scratch fallback by centering a bitmap whose live rotation center is absent', () => {
        expect(resolveRasterWorkspaceGeometry({
            workingCopy,
            sourceGeometry: {bitmapResolution: 2},
            dimensions,
            stageSize
        })).toEqual(expect.objectContaining({rotationCenterX: 256, rotationCenterY: 192}));
    });

    test('preserves an explicit live top-left pivot instead of treating finite zero as missing', () => {
        expect(resolveRasterWorkspaceGeometry({
            workingCopy: {...workingCopy, rotationCenterX: 200, rotationCenterY: 100},
            sourceGeometry: {bitmapResolution: 2, rotationCenterX: 0, rotationCenterY: 0},
            dimensions,
            stageSize
        })).toEqual(expect.objectContaining({rotationCenterX: 0, rotationCenterY: 0}));
    });

    test('exports the expanded world-surface pivot instead of the imported PNG pivot', () => {
        expect(resolveRasterExportGeometry({
            workspaceState: {surface: {rotationCenter: {x: 384, y: 256}}},
            workspaceGeometry: {bitmapResolution: 2, rotationCenterX: 256, rotationCenterY: 192},
            workingCopy
        })).toEqual({
            bitmapResolution: 2,
            rotationCenterX: 384,
            rotationCenterY: 256
        });
    });

    test('keeps canonical Working Copy geometry when no Scratch compatibility geometry is supplied', () => {
        expect(resolveRasterWorkspaceGeometry({
            workingCopy: {...workingCopy, rotationCenterX: 17, rotationCenterY: 19},
            sourceGeometry: null,
            dimensions,
            stageSize
        })).toEqual(expect.objectContaining({rotationCenterX: 17, rotationCenterY: 19}));
    });
});
