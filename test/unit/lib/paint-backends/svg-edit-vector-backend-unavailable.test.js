import SvgEditVectorBackendUnavailable, {
    SVG_EDIT_VECTOR_BACKEND_PACKAGE,
    createUnavailableError
} from '../../../../src/lib/paint-backends/svg-edit-vector-backend-unavailable';

describe('WS-10F HF1 SVG-Edit unavailable backend', () => {
    test('fails visibly only when the backend constructor is used', () => {
        expect(SvgEditVectorBackendUnavailable.ngvgeBackendUnavailable).toBe(true);
        expect(SvgEditVectorBackendUnavailable.package).toBe('@svgedit/svgcanvas@7.4.2');
        expect(() => new SvgEditVectorBackendUnavailable()).toThrow(/bun install --frozen-lockfile/);
    });

    test('exposes a structured package-unavailable diagnostic', () => {
        const error = createUnavailableError();
        expect(error.code).toBe('NGVGE_PAINT_SVG_EDIT_PACKAGE_UNAVAILABLE');
        expect(error.package).toBe(SVG_EDIT_VECTOR_BACKEND_PACKAGE);
    });
});
