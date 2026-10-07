const {
    AUTHORITY_MODES,
    AUTHORITY_REGISTRATION_SCHEMA,
    AUTHORITY_REGISTRY_DUPLICATE,
    AUTHORITY_REGISTRY_WRITER_CONFLICT,
    AuthorityRegistrationValidationError,
    PROJECTION_DIRECTIONS,
    createAuthorityRegistry,
    normalizeAuthorityRegistration,
    validateAuthorityRegistration
} = require('../../../../src/core/authority');

const writer = (domain = 'Transform2D', authorityId = 'scratch.compat.transform') => ({
    authorityId,
    domain,
    mode: AUTHORITY_MODES.WRITER
});

const projection = (domain = 'Transform2D', authorityId = 'ngvge.semantic.transform') => ({
    authorityId,
    domain,
    mode: AUTHORITY_MODES.PROJECTION,
    projectionDirection: PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION
});

describe('ARC-C001 Authority Registry Foundation', () => {
    test('normalizes and freezes explicit writer/projection/observer registrations', () => {
        const normalizedWriter = normalizeAuthorityRegistration(writer());
        const normalizedProjection = normalizeAuthorityRegistration(projection());
        const normalizedObserver = normalizeAuthorityRegistration({
            authorityId: 'editor.inspector',
            domain: 'Transform2D',
            mode: AUTHORITY_MODES.OBSERVER
        });

        expect(normalizedWriter).toEqual(writer());
        expect(normalizedProjection).toEqual(projection());
        expect(normalizedObserver.mode).toBe('observer');
        expect(Object.isFrozen(normalizedWriter)).toBe(true);
        expect(Object.isFrozen(normalizedProjection)).toBe(true);
        expect(Object.isFrozen(normalizedObserver)).toBe(true);
    });

    test('rejects invalid domain, authority id, mode and unknown fields', () => {
        const result = validateAuthorityRegistration({
            authorityId: 'bad id',
            domain: 'bad domain',
            extra: true,
            mode: 'owner'
        });
        expect(result).toMatchObject({schema: AUTHORITY_REGISTRATION_SCHEMA, valid: false});
        expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
            'authority.registration.field-unknown',
            'authority.domain.invalid',
            'authority.id.invalid',
            'authority.mode.invalid'
        ]));
    });

    test('requires projection direction only for projection registrations', () => {
        expect(validateAuthorityRegistration({
            authorityId: 'projection.a',
            domain: 'Transform2D',
            mode: AUTHORITY_MODES.PROJECTION
        }).issues.map(issue => issue.code)).toContain('authority.projection.direction-invalid');

        expect(validateAuthorityRegistration({
            authorityId: 'writer.a',
            domain: 'Transform2D',
            mode: AUTHORITY_MODES.WRITER,
            projectionDirection: PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION
        }).issues.map(issue => issue.code)).toContain('authority.projection.direction-not-applicable');
    });

    test('rejects non-plain registrations', () => {
        expect(() => normalizeAuthorityRegistration(null)).toThrow(AuthorityRegistrationValidationError);
        expect(() => normalizeAuthorityRegistration(Object.create(null))).toThrow(AuthorityRegistrationValidationError);
        expect(() => normalizeAuthorityRegistration([])).toThrow(AuthorityRegistrationValidationError);
    });

    test('registers one writer plus projections and observers for a domain', () => {
        const registry = createAuthorityRegistry([
            writer(),
            projection(),
            {authorityId: 'editor.inspector', domain: 'Transform2D', mode: AUTHORITY_MODES.OBSERVER}
        ]);

        expect(registry.getWriter('Transform2D')).toEqual(writer());
        expect(registry.has('Transform2D', 'ngvge.semantic.transform')).toBe(true);
        expect(registry.list('Transform2D')).toHaveLength(3);
        expect(registry.getRevision()).toBe(1);
    });

    test('rejects a second active writer for the same State Domain', () => {
        const registry = createAuthorityRegistry([writer()]);
        expect(() => registry.register(writer('Transform2D', 'ngvge.native.transform'))).toThrow(expect.objectContaining({
            activeAuthorityId: 'scratch.compat.transform',
            code: AUTHORITY_REGISTRY_WRITER_CONFLICT,
            domain: 'Transform2D',
            requestedAuthorityId: 'ngvge.native.transform'
        }));
        expect(registry.getWriter('Transform2D').authorityId).toBe('scratch.compat.transform');
    });

    test('allows independent writers for different State Domains', () => {
        const registry = createAuthorityRegistry([
            writer('Transform2D', 'scratch.compat.transform'),
            writer('AudioState', 'ngvge.audio')
        ]);
        expect(registry.getWriter('Transform2D').authorityId).toBe('scratch.compat.transform');
        expect(registry.getWriter('AudioState').authorityId).toBe('ngvge.audio');
    });

    test('registerMany is atomic for existing and in-batch writer conflicts', () => {
        const registry = createAuthorityRegistry([writer()]);
        expect(() => registry.registerMany([
            {authorityId: 'observer.new', domain: 'Transform2D', mode: AUTHORITY_MODES.OBSERVER},
            writer('Transform2D', 'ngvge.native.transform')
        ])).toThrow(expect.objectContaining({code: AUTHORITY_REGISTRY_WRITER_CONFLICT}));
        expect(registry.has('Transform2D', 'observer.new')).toBe(false);

        const empty = createAuthorityRegistry();
        expect(() => empty.registerMany([
            writer('Transform2D', 'writer.a'),
            writer('Transform2D', 'writer.b')
        ])).toThrow(expect.objectContaining({code: AUTHORITY_REGISTRY_WRITER_CONFLICT}));
        expect(empty.list()).toHaveLength(0);
    });

    test('rejects duplicate participant registration without replacing its role', () => {
        const registry = createAuthorityRegistry([
            {authorityId: 'editor.inspector', domain: 'Transform2D', mode: AUTHORITY_MODES.OBSERVER}
        ]);
        expect(() => registry.register({
            authorityId: 'editor.inspector',
            domain: 'Transform2D',
            mode: AUTHORITY_MODES.PROJECTION,
            projectionDirection: PROJECTION_DIRECTIONS.PROJECTION_TO_AUTHORITY
        })).toThrow(expect.objectContaining({code: AUTHORITY_REGISTRY_DUPLICATE}));
        expect(registry.get('Transform2D', 'editor.inspector').mode).toBe(AUTHORITY_MODES.OBSERVER);
    });

    test('unregister releases writer ownership without claiming switch transaction semantics', () => {
        const registry = createAuthorityRegistry([writer()]);
        const removed = registry.unregister('Transform2D', 'scratch.compat.transform');
        expect(removed).toEqual(writer());
        expect(registry.getWriter('Transform2D')).toBeNull();
        registry.register(writer('Transform2D', 'ngvge.native.transform'));
        expect(registry.getWriter('Transform2D').authorityId).toBe('ngvge.native.transform');
        expect(registry.getRevision()).toBe(3);
    });

    test('returns immutable deterministic snapshots', () => {
        const registry = createAuthorityRegistry([
            {authorityId: 'z.observer', domain: 'ZDomain', mode: AUTHORITY_MODES.OBSERVER},
            projection('ADomain', 'b.projection'),
            writer('ADomain', 'a.writer')
        ]);
        const snapshot = registry.snapshot();
        expect(snapshot.registrations.map(item => `${item.domain}:${item.mode}:${item.authorityId}`)).toEqual([
            'ADomain:projection:b.projection',
            'ADomain:writer:a.writer',
            'ZDomain:observer:z.observer'
        ]);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.registrations)).toBe(true);
        expect(Object.isFrozen(snapshot.registrations[0])).toBe(true);
    });
});
