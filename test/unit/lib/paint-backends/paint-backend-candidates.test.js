import {
    PAINT_BACKEND_CANDIDATES,
    SVG_EDIT_BACKEND_ID,
    MINIPAINT_BACKEND_ID,
    PISKEL_BACKEND_ID,
    SCRATCH_PAINT_COMPAT_BACKEND_ID,
    getPaintBackendCandidate
} from '../../../../src/lib/paint-backends/paint-backend-candidates';

describe('WS-10E formal OSS intake candidates', () => {
    test('keeps the production shortlist explicit and non-authoritative', () => {
        expect(PAINT_BACKEND_CANDIDATES.map(item => item.backendId)).toEqual([
            SVG_EDIT_BACKEND_ID,
            MINIPAINT_BACKEND_ID,
            PISKEL_BACKEND_ID,
            SCRATCH_PAINT_COMPAT_BACKEND_ID
        ]);
        PAINT_BACKEND_CANDIDATES.forEach(candidate => {
            expect(Object.values(candidate.authority).every(value => value === false)).toBe(true);
        });
    });

    test('pins SVG-Edit 7.4.2 for the library-style vector integration', () => {
        const candidate = getPaintBackendCandidate(SVG_EDIT_BACKEND_ID);
        expect(candidate.integrationMode).toBe('library');
        expect(candidate.admission).toBe('approved-for-poc');
        expect(candidate.oss.package).toBe('@svgedit/svgcanvas');
        expect(candidate.oss.version).toBe('7.4.2');
        expect(candidate.oss.productionIntake).toBe('VECTOR_ADAPTER_INTEGRATED_WS10F');
        expect(candidate.oss.license).toBe('MIT');
    });

    test('requires controlled extraction instead of miniPaint iframe production embedding', () => {
        const candidate = getPaintBackendCandidate(MINIPAINT_BACKEND_ID);
        expect(candidate.integrationMode).toBe('controlled-fork');
        expect(candidate.admission).toBe('conditional-poc');
        expect(candidate.oss.iframeProductionEmbedding).toBe(false);
        expect(candidate.oss.licenseFile).toBe('MIT-LICENSE.txt');
        expect(candidate.oss.sourceRef).toBe('master');
        expect(candidate.oss.observedCommit).toBe('a79733eb803fc97084ef0ee4faa96b031e69e1c0');
        expect(candidate.semanticCoverage.timeline).toBe('ngvge-owned');
    });

    test('keeps Piskel timeline identity under NGVGE even though Piskel has frames/layers', () => {
        const candidate = getPaintBackendCandidate(PISKEL_BACKEND_ID);
        expect(candidate.integrationMode).toBe('controlled-fork');
        expect(candidate.semanticCoverage.frames).toBe('adapter');
        expect(candidate.semanticCoverage.layers).toBe('adapter');
        expect(candidate.semanticCoverage.timeline).toBe('ngvge-owned');
        expect(candidate.oss.license).toBe('Apache-2.0');
        expect(candidate.oss.licenseFile).toBe('LICENSE');
        expect(candidate.oss.sourceRef).toBe('master');
        expect(candidate.oss.observedCommit).toBe('a6b9c02daefceb10093f71e92d52d16920ccb16e');
    });

    test('demotes scratch-paint to compatibility/reference status', () => {
        const candidate = getPaintBackendCandidate(SCRATCH_PAINT_COMPAT_BACKEND_ID);
        expect(candidate.admission).toBe('compatibility-only');
        expect(candidate.integrationMode).toBe('compatibility');
        expect(candidate.oss.license).toBe('AGPL-3.0');
        expect(candidate.oss.sourceRef).toBe('develop');
        expect(candidate.oss.observedCommit).toBe('f8966f09df9a994c207db10b4ab52f530a1172d8');
    });
});
