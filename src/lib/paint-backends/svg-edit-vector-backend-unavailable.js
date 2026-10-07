const SVG_EDIT_VECTOR_BACKEND_PACKAGE = '@svgedit/svgcanvas@7.4.2';

const createUnavailableError = () => {
    const error = new Error(
        'SVG-Edit vector backend is not installed. Stop the dev server, run `bun install --frozen-lockfile` ' +
        `to install ${SVG_EDIT_VECTOR_BACKEND_PACKAGE}, then restart NGVGE.`
    );
    error.code = 'NGVGE_PAINT_SVG_EDIT_PACKAGE_UNAVAILABLE';
    error.package = SVG_EDIT_VECTOR_BACKEND_PACKAGE;
    return error;
};

/**
 * Build-time fallback used only when the optional SVG-Edit package is absent.
 *
 * This module deliberately exposes the same default-constructor shape as
 * @svgedit/svgcanvas so the Editor bundle can still compile and boot. The
 * constructor fails visibly only when the Vector tool actually tries to mount
 * the unavailable backend. Tool failure must never escalate into Workspace
 * bootstrap failure.
 */
class SvgEditVectorBackendUnavailable {
    constructor () {
        throw createUnavailableError();
    }
}

SvgEditVectorBackendUnavailable.ngvgeBackendUnavailable = true;
SvgEditVectorBackendUnavailable.package = SVG_EDIT_VECTOR_BACKEND_PACKAGE;

export {SVG_EDIT_VECTOR_BACKEND_PACKAGE, createUnavailableError};
export default SvgEditVectorBackendUnavailable;
