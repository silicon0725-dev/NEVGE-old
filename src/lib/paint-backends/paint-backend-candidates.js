import {
    ANIMATED_RASTER_DOCUMENT_SCHEMA_ID
} from '../art-documents/animated-raster-document-schema';
import {VECTOR_ART_DOCUMENT_SCHEMA_ID} from '../art-documents/vector-art-document-schema';
import {normalizeBackendDescriptor} from './paint-backend-contract';

const SOURCE_RESEARCH_DATE = '2026-08-15';

const makeAuthority = () => ({
    semanticIdentity: false,
    project: false,
    resource: false,
    transaction: false,
    persistence: false,
    timeline: false
});

const SVG_EDIT_BACKEND_ID = 'ngvge.paint-backend.svg-edit';
const MINIPAINT_BACKEND_ID = 'ngvge.paint-backend.minipaint';
const PISKEL_BACKEND_ID = 'ngvge.paint-backend.piskel';
const SCRATCH_PAINT_COMPAT_BACKEND_ID = 'ngvge.paint-backend.scratch-paint-compat';

const PAINT_BACKEND_CANDIDATES = Object.freeze([
    normalizeBackendDescriptor({
        schemaVersion: 1,
        backendId: SVG_EDIT_BACKEND_ID,
        displayName: 'SVG-Edit / @svgedit/svgcanvas',
        kind: 'vector',
        integrationMode: 'library',
        admission: 'approved-for-poc',
        documentSchemaIds: [VECTOR_ART_DOCUMENT_SCHEMA_ID],
        editScope: 'document',
        semanticCoverage: {
            documentSource: 'adapter',
            layers: 'unsupported',
            frames: 'unsupported',
            cels: 'unsupported',
            linkedCels: 'unsupported',
            clips: 'unsupported',
            markers: 'unsupported',
            palette: 'unsupported',
            slices: 'ngvge-owned',
            timeline: 'unsupported'
        },
        authority: makeAuthority(),
        oss: {
            project: 'SVG-Edit/svgedit',
            source: 'https://github.com/SVG-Edit/svgedit',
            package: '@svgedit/svgcanvas',
            version: '7.4.2',
            license: 'MIT',
            researchDate: SOURCE_RESEARCH_DATE,
            productionIntake: 'VECTOR_ADAPTER_INTEGRATED_WS10F'
        }
    }),
    normalizeBackendDescriptor({
        schemaVersion: 1,
        backendId: MINIPAINT_BACKEND_ID,
        displayName: 'miniPaint',
        kind: 'bitmap',
        integrationMode: 'controlled-fork',
        admission: 'conditional-poc',
        documentSchemaIds: [ANIMATED_RASTER_DOCUMENT_SCHEMA_ID],
        editScope: 'frame',
        semanticCoverage: {
            documentSource: 'adapter',
            layers: 'adapter',
            frames: 'ngvge-owned',
            cels: 'adapter',
            linkedCels: 'ngvge-owned',
            clips: 'ngvge-owned',
            markers: 'ngvge-owned',
            palette: 'ngvge-owned',
            slices: 'ngvge-owned',
            timeline: 'ngvge-owned'
        },
        authority: makeAuthority(),
        oss: {
            project: 'viliusle/miniPaint',
            source: 'https://github.com/viliusle/miniPaint',
            license: 'MIT',
            licenseFile: 'MIT-LICENSE.txt',
            sourceRef: 'master',
            observedCommit: 'a79733eb803fc97084ef0ee4faa96b031e69e1c0',
            researchDate: SOURCE_RESEARCH_DATE,
            productionIntake: 'CONTROLLED_FORK_COMPONENT_EXTRACTION_REQUIRED',
            iframeProductionEmbedding: false
        }
    }),
    normalizeBackendDescriptor({
        schemaVersion: 1,
        backendId: PISKEL_BACKEND_ID,
        displayName: 'Piskel',
        kind: 'pixel',
        integrationMode: 'controlled-fork',
        admission: 'conditional-poc',
        documentSchemaIds: [ANIMATED_RASTER_DOCUMENT_SCHEMA_ID],
        editScope: 'document',
        semanticCoverage: {
            documentSource: 'adapter',
            layers: 'adapter',
            frames: 'adapter',
            cels: 'adapter',
            linkedCels: 'adapter',
            clips: 'ngvge-owned',
            markers: 'ngvge-owned',
            palette: 'adapter',
            slices: 'ngvge-owned',
            timeline: 'ngvge-owned'
        },
        authority: makeAuthority(),
        oss: {
            project: 'piskelapp/piskel',
            source: 'https://github.com/piskelapp/piskel',
            license: 'Apache-2.0',
            licenseFile: 'LICENSE',
            sourceRef: 'master',
            observedCommit: 'a6b9c02daefceb10093f71e92d52d16920ccb16e',
            researchDate: SOURCE_RESEARCH_DATE,
            productionIntake: 'CONTROLLED_FORK_COMPONENT_EXTRACTION_REQUIRED',
            upstreamLargeUxChangesExpected: false
        }
    }),
    normalizeBackendDescriptor({
        schemaVersion: 1,
        backendId: SCRATCH_PAINT_COMPAT_BACKEND_ID,
        displayName: 'Scratch Paint compatibility backend',
        kind: 'bitmap',
        integrationMode: 'compatibility',
        admission: 'compatibility-only',
        documentSchemaIds: [ANIMATED_RASTER_DOCUMENT_SCHEMA_ID],
        editScope: 'cel-content',
        semanticCoverage: {
            documentSource: 'adapter',
            layers: 'unsupported',
            frames: 'ngvge-owned',
            cels: 'adapter',
            linkedCels: 'ngvge-owned',
            clips: 'ngvge-owned',
            markers: 'ngvge-owned',
            palette: 'unsupported',
            slices: 'ngvge-owned',
            timeline: 'ngvge-owned'
        },
        authority: makeAuthority(),
        oss: {
            project: 'scratch-paint',
            source: 'existing NGVGE dependency',
            license: 'AGPL-3.0',
            licenseFile: 'LICENSE',
            sourceRef: 'develop',
            observedCommit: 'f8966f09df9a994c207db10b4ab52f530a1172d8',
            researchDate: SOURCE_RESEARCH_DATE,
            productionIntake: 'COMPATIBILITY_REFERENCE_ONLY'
        }
    })
]);

const getPaintBackendCandidate = backendId => PAINT_BACKEND_CANDIDATES.find(candidate => candidate.backendId === backendId) || null;

export {
    SOURCE_RESEARCH_DATE,
    SVG_EDIT_BACKEND_ID,
    MINIPAINT_BACKEND_ID,
    PISKEL_BACKEND_ID,
    SCRATCH_PAINT_COMPAT_BACKEND_ID,
    PAINT_BACKEND_CANDIDATES,
    getPaintBackendCandidate
};
