import {
    ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
    normalizeAnimatedRasterDocument
} from '../../../../src/lib/art-documents/animated-raster-document-schema';

const makeDocument = () => ({
    schemaId: ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
    schemaVersion: 1,
    documentId: 'ngvge:art-document:hero',
    resourceId: 'ngvge:resource:hero',
    mode: 'pixel',
    canvas: {width: 32, height: 32, colorMode: 'indexed'},
    layers: [
        {
            layerId: 'ngvge:art-layer:body',
            name: 'Body',
            type: 'raster',
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'normal'
        }
    ],
    frames: [
        {frameId: 'ngvge:animation-frame:1', durationMs: 100},
        {frameId: 'ngvge:animation-frame:2', durationMs: 120}
    ],
    celContents: [
        {contentId: 'ngvge:cel-content:shared-body', kind: 'indexed-raster'}
    ],
    cels: [
        {
            celId: 'ngvge:animation-cel:1',
            layerId: 'ngvge:art-layer:body',
            frameId: 'ngvge:animation-frame:1',
            contentId: 'ngvge:cel-content:shared-body',
            x: 0,
            y: 0,
            opacity: 1
        },
        {
            celId: 'ngvge:animation-cel:2',
            layerId: 'ngvge:art-layer:body',
            frameId: 'ngvge:animation-frame:2',
            contentId: 'ngvge:cel-content:shared-body',
            x: 0,
            y: 0,
            opacity: 1
        }
    ],
    clips: [{
        clipId: 'ngvge:animation-clip:idle',
        name: 'idle',
        startFrameId: 'ngvge:animation-frame:1',
        endFrameId: 'ngvge:animation-frame:2',
        playbackMode: 'loop',
        loopCount: null
    }],
    markers: [{
        markerId: 'ngvge:animation-marker:blink',
        frameId: 'ngvge:animation-frame:2',
        offsetMs: 20,
        kind: 'event',
        name: 'blink',
        payload: {channel: 'visual'}
    }],
    palette: {
        paletteId: 'ngvge:palette:hero',
        storage: 'embedded',
        entries: [{
            entryId: 'ngvge:palette-entry:transparent',
            index: 0,
            rgba: {r: 0, g: 0, b: 0, a: 0}
        }]
    },
    slices: [{
        sliceId: 'ngvge:slice:hitbox',
        name: 'Hitbox',
        role: 'hitbox',
        keys: [{
            frameId: 'ngvge:animation-frame:1',
            bounds: {x: 4, y: 4, width: 24, height: 28},
            pivot: {x: 16, y: 28}
        }]
    }]
});

describe('AnimatedRasterDocument semantic freeze', () => {
    test('normalizes NGVGE-owned Layer × Frame × Cel semantics', () => {
        const document = normalizeAnimatedRasterDocument(makeDocument());
        expect(Object.isFrozen(document)).toBe(true);
        expect(document.frames).toHaveLength(2);
        expect(document.cels).toHaveLength(2);
        expect(document.cels[0].contentId).toBe(document.cels[1].contentId);
        expect(document.clips[0].playbackMode).toBe('loop');
        expect(document.markers[0].kind).toBe('event');
    });

    test('shared CelContentId represents linked/shared cel content without backend IDs', () => {
        const document = normalizeAnimatedRasterDocument(makeDocument());
        const contentIds = new Set(document.cels.map(cel => cel.contentId));
        expect(contentIds.size).toBe(1);
    });

    test('rejects backend/editor state fields from Project semantics', () => {
        const document = makeDocument();
        document.piskelFrameId = 'frame-123';
        expect(() => normalizeAnimatedRasterDocument(document)).toThrow(/unsupported field/i);
        delete document.piskelFrameId;
        document.editorState = {zoom: 12, onionSkin: true};
        expect(() => normalizeAnimatedRasterDocument(document)).toThrow(/unsupported field/i);
    });

    test('rejects duplicate Layer × Frame cel slots', () => {
        const document = makeDocument();
        document.cels.push({
            celId: 'ngvge:animation-cel:duplicate',
            layerId: 'ngvge:art-layer:body',
            frameId: 'ngvge:animation-frame:1',
            contentId: 'ngvge:cel-content:shared-body'
        });
        expect(() => normalizeAnimatedRasterDocument(document)).toThrow(/Multiple cels occupy/i);
    });

    test('rejects invalid clip ranges and marker offsets', () => {
        const reversed = makeDocument();
        reversed.clips[0].startFrameId = 'ngvge:animation-frame:2';
        reversed.clips[0].endFrameId = 'ngvge:animation-frame:1';
        expect(() => normalizeAnimatedRasterDocument(reversed)).toThrow(/start frame/i);

        const marker = makeDocument();
        marker.markers[0].offsetMs = 120;
        expect(() => normalizeAnimatedRasterDocument(marker)).toThrow(/offset must be inside/i);
    });

    test('requires palette ownership for indexed documents', () => {
        const document = makeDocument();
        document.palette = null;
        expect(() => normalizeAnimatedRasterDocument(document)).toThrow(/requires a Palette/i);
    });

    test('requires raster cel content kind to match document color mode', () => {
        const document = makeDocument();
        document.celContents[0].kind = 'rgba-raster';
        expect(() => normalizeAnimatedRasterDocument(document)).toThrow(/does not match indexed/i);
    });

    test('supports group layers but prevents cels from targeting them', () => {
        const document = makeDocument();
        document.layers.unshift({
            layerId: 'ngvge:art-layer:group',
            name: 'Group',
            type: 'group',
            visible: true
        });
        document.layers[1].parentLayerId = 'ngvge:art-layer:group';
        expect(() => normalizeAnimatedRasterDocument(document)).not.toThrow();
        document.cels[0].layerId = 'ngvge:art-layer:group';
        expect(() => normalizeAnimatedRasterDocument(document)).toThrow(/cannot target group/i);
    });

    test('freezes mask/clipping layer semantics instead of backend layer objects', () => {
        const document = makeDocument();
        document.layers.push({
            layerId: 'ngvge:art-layer:mask',
            name: 'Mask',
            type: 'mask',
            maskTargetLayerId: 'ngvge:art-layer:body',
            visible: true
        });
        document.celContents.push({contentId: 'ngvge:cel-content:mask', kind: 'indexed-raster'});
        document.cels.push({
            celId: 'ngvge:animation-cel:mask',
            layerId: 'ngvge:art-layer:mask',
            frameId: 'ngvge:animation-frame:1',
            contentId: 'ngvge:cel-content:mask'
        });
        document.layers[0].clipToLayerId = 'ngvge:art-layer:mask';
        const normalized = normalizeAnimatedRasterDocument(document);
        expect(normalized.layers[0].clipToLayerId).toBe('ngvge:art-layer:mask');
        expect(normalized.layers[1].maskTargetLayerId).toBe('ngvge:art-layer:body');
    });

    test('requires portable marker payload and bounded unique palette indexes', () => {
        const marker = makeDocument();
        marker.markers[0].payload = {unsafe: () => 'backend'};
        expect(() => normalizeAnimatedRasterDocument(marker)).toThrow(/portable JSON/i);

        const palette = makeDocument();
        palette.palette.entries.push({
            entryId: 'ngvge:palette-entry:duplicate-index',
            index: 0,
            rgba: {r: 255, g: 255, b: 255, a: 255}
        });
        expect(() => normalizeAnimatedRasterDocument(palette)).toThrow(/Duplicate Palette index/i);
    });

    test('requires nine-slice semantic keys to contain center bounds', () => {
        const document = makeDocument();
        document.slices[0] = {
            sliceId: 'ngvge:slice:panel',
            name: 'Panel',
            role: 'nine-slice',
            keys: [{bounds: {x: 0, y: 0, width: 32, height: 32}}]
        };
        expect(() => normalizeAnimatedRasterDocument(document)).toThrow(/requires center/i);
    });
});
