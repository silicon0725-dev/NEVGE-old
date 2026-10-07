const {
    ENGINE_PROTOCOL_ID,
    ENGINE_PROTOCOL_VERSION,
    PROTOCOL_DTO_KINDS,
    PROTOCOL_DTO_SCHEMA,
    PROTOCOL_DTO_VALIDATION_ERROR,
    PROTOCOL_VALUE_VALIDATION_ERROR,
    ProtocolDTOValidationError,
    ProtocolValueValidationError,
    cloneProtocolValue,
    createEngineCommand,
    createEngineEvent,
    createEngineQuery,
    createProtocolError,
    createQuerySnapshot,
    normalizeProtocolDTO,
    validateProtocolDTO,
    validateProtocolValue
} = require('../../../../src/core/protocol');

describe('ARC-C001 Protocol DTO Foundation', () => {
    test('defines one explicit engine protocol identity and version', () => {
        expect(ENGINE_PROTOCOL_ID).toBe('ngvge.engine-protocol');
        expect(ENGINE_PROTOCOL_VERSION).toBe(1);
        expect(PROTOCOL_DTO_SCHEMA).toBe('ngvge-engine-protocol-dto/v1');
    });

    test('creates immutable command/query/event DTOs with detached payloads', () => {
        const payload = {nodeId: 'ngvge:node:abcdefgh', patch: [{path: '/x', value: 10}]};
        const command = createEngineCommand('PatchComponent', payload);
        const query = createEngineQuery('GetNodeSnapshot', {nodeId: payload.nodeId});
        const event = createEngineEvent('NodeChanged', {nodeId: payload.nodeId});

        expect(command).toMatchObject({
            kind: PROTOCOL_DTO_KINDS.COMMAND,
            protocol: ENGINE_PROTOCOL_ID,
            protocolVersion: ENGINE_PROTOCOL_VERSION,
            type: 'PatchComponent'
        });
        expect(query.kind).toBe(PROTOCOL_DTO_KINDS.QUERY);
        expect(event.kind).toBe(PROTOCOL_DTO_KINDS.EVENT);
        expect(Object.isFrozen(command)).toBe(true);
        expect(Object.isFrozen(command.payload)).toBe(true);
        expect(Object.isFrozen(command.payload.patch)).toBe(true);
        expect(Object.isFrozen(command.payload.patch[0])).toBe(true);
        expect(command.payload).not.toBe(payload);
        expect(command.payload.patch).not.toBe(payload.patch);
    });

    test('creates a portable immutable ProtocolError DTO', () => {
        const error = createProtocolError('NODE_NOT_FOUND', 'Node does not exist.', {
            nodeId: 'ngvge:node:abcdefgh'
        });
        expect(error).toEqual(expect.objectContaining({
            code: 'NODE_NOT_FOUND',
            kind: PROTOCOL_DTO_KINDS.ERROR,
            message: 'Node does not exist.',
            protocol: ENGINE_PROTOCOL_ID,
            protocolVersion: ENGINE_PROTOCOL_VERSION
        }));
        expect(Object.isFrozen(error)).toBe(true);
        expect(Object.isFrozen(error.details)).toBe(true);
    });

    test('rejects DTO protocol version and unknown fields fail closed', () => {
        const result = validateProtocolDTO({
            extra: true,
            kind: 'command',
            payload: {},
            protocol: ENGINE_PROTOCOL_ID,
            protocolVersion: 2,
            type: 'PatchComponent'
        });
        expect(result.valid).toBe(false);
        expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
            'protocol.dto.field-unknown',
            'protocol.dto.version-invalid'
        ]));
    });

    test('rejects invalid DTO type and malformed error fields', () => {
        expect(validateProtocolDTO({
            kind: 'query',
            payload: {},
            protocol: ENGINE_PROTOCOL_ID,
            protocolVersion: 1,
            type: 'bad type'
        }).issues.map(issue => issue.code)).toContain('protocol.dto.type-invalid');

        expect(validateProtocolDTO({
            code: 'bad code!',
            details: null,
            kind: 'error',
            message: '',
            protocol: ENGINE_PROTOCOL_ID,
            protocolVersion: 1
        }).issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
            'protocol.error.code-invalid',
            'protocol.error.message-invalid'
        ]));
    });

    test('rejects functions, promises and custom class/native-style objects', () => {
        class NativeTextureHandle {}
        const values = [
            () => true,
            Promise.resolve(true),
            new NativeTextureHandle()
        ];
        for (const value of values) {
            expect(validateProtocolValue({value}).valid).toBe(false);
        }
    });

    test('rejects BigInt/native integer handles, symbols and non-finite numbers', () => {
        const result = validateProtocolValue({
            gpuHandle: 1n,
            marker: Symbol('runtime'),
            x: Number.POSITIVE_INFINITY
        });
        expect(result.valid).toBe(false);
        expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
            'protocol.number.non-finite',
            'protocol.value.bigint',
            'protocol.value.symbol'
        ]));
    });

    test('rejects circular references and accessors without invoking getters', () => {
        const cycle = {};
        cycle.self = cycle;
        expect(validateProtocolValue(cycle).issues.map(issue => issue.code)).toContain('protocol.object.cycle');

        let accessed = false;
        const accessor = {};
        Object.defineProperty(accessor, 'native', {
            enumerable: true,
            get () {
                accessed = true;
                return {};
            }
        });
        expect(validateProtocolValue(accessor).issues.map(issue => issue.code)).toContain('protocol.object.accessor');
        expect(accessed).toBe(false);
    });

    test('rejects sparse arrays, custom array properties and unsafe object keys', () => {
        const sparse = [];
        sparse.length = 2;
        sparse[0] = 'a';
        expect(validateProtocolValue(sparse).issues.map(issue => issue.code)).toContain('protocol.array.sparse');

        const custom = [];
        custom.push('a');
        custom.extra = true;
        expect(validateProtocolValue(custom).issues.map(issue => issue.code)).toContain('protocol.array.custom-property');

        const unsafe = Object.create(null);
        unsafe.prototype = 'x';
        expect(validateProtocolValue(unsafe).issues.map(issue => issue.code)).toContain('protocol.object.unsafe-key');
    });

    test('normalizes arbitrary valid DTO input without retaining mutable references', () => {
        const source = {
            kind: 'event',
            payload: {items: [{id: 'a'}]},
            protocol: ENGINE_PROTOCOL_ID,
            protocolVersion: 1,
            type: 'RegistryChanged'
        };
        const normalized = normalizeProtocolDTO(source);
        source.payload.items[0].id = 'mutated';
        expect(normalized.payload.items[0].id).toBe('a');
        expect(Object.isFrozen(normalized.payload.items[0])).toBe(true);
    });

    test('creates deeply frozen detached Query snapshots', () => {
        const serviceState = {nodes: [{id: 'ngvge:node:abcdefgh', transform: {x: 10}}]};
        const snapshot = createQuerySnapshot(serviceState);
        serviceState.nodes[0].transform.x = 99;
        expect(snapshot.nodes[0].transform.x).toBe(10);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.nodes)).toBe(true);
        expect(Object.isFrozen(snapshot.nodes[0])).toBe(true);
        expect(Object.isFrozen(snapshot.nodes[0].transform)).toBe(true);
    });

    test('cloneProtocolValue rejects live services and returns immutable plain data', () => {
        expect(() => cloneProtocolValue({call: () => true})).toThrow(ProtocolValueValidationError);
        expect(() => cloneProtocolValue({call: () => true})).toThrow(expect.objectContaining({
            code: PROTOCOL_VALUE_VALIDATION_ERROR
        }));
        const value = cloneProtocolValue({b: 2, a: 1});
        expect(Object.keys(value)).toEqual(['a', 'b']);
        expect(Object.getPrototypeOf(value)).toBeNull();
    });

    test('constructors surface structured DTO validation failures', () => {
        expect(() => createEngineCommand('bad type', {})).toThrow(ProtocolDTOValidationError);
        expect(() => createEngineCommand('bad type', {})).toThrow(expect.objectContaining({
            code: PROTOCOL_DTO_VALIDATION_ERROR
        }));
    });
});
