const WORKSPACE_WINDOW_MODEL_ID = 'ngvge.workspace-window-model@1';
const WINDOW_DESCRIPTOR_SCHEMA_VERSION = 1;
const WINDOW_STATE_SCHEMA_VERSION = 1;

const WINDOW_ROLES = Object.freeze({
    PRIMARY: 'primary',
    SUPPORTING: 'supporting',
    SURFACE: 'surface',
    COMPATIBILITY: 'compatibility',
    EDITOR: 'editor'
});

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const clonePoint = value => ({x: value.x, y: value.y});
const cloneSize = value => ({width: value.width, height: value.height});

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (isPlainObject(value)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const assertNonEmptyString = (value, label) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${label} must be a non-empty string.`);
    }
    return value;
};

const assertPoint = (value, label) => {
    if (!isPlainObject(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
        throw new TypeError(`${label} must be a finite {x, y} point.`);
    }
    return value;
};

const assertSize = (value, label) => {
    if (!isPlainObject(value) || !Number.isFinite(value.width) || !Number.isFinite(value.height) ||
        value.width < 0 || value.height < 0) {
        throw new TypeError(`${label} must be a non-negative finite {width, height} size.`);
    }
    return value;
};

const normalizeBoolean = (value, fallback) => (
    typeof value === 'boolean' ? value : fallback
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveWindowId = (toolDefinition, instanceId) => {
    const template = toolDefinition.window;
    if (toolDefinition.singleton) {
        return assertNonEmptyString(template.id, 'Singleton window id');
    }
    assertNonEmptyString(template.idPrefix, 'Multi-instance window idPrefix');
    const normalizedInstanceId = assertNonEmptyString(String(instanceId || ''), 'Window instanceId');
    return `${template.idPrefix}${normalizedInstanceId}`;
};

const createWindowDescriptor = (toolDefinition, options = {}) => {
    if (!isPlainObject(toolDefinition) || !isPlainObject(toolDefinition.window)) {
        throw new TypeError('Window descriptor requires a valid ToolDefinition with a window template.');
    }

    const template = toolDefinition.window;
    const descriptor = {
        schemaVersion: WINDOW_DESCRIPTOR_SCHEMA_VERSION,
        modelId: WORKSPACE_WINDOW_MODEL_ID,
        windowId: resolveWindowId(toolDefinition, options.instanceId),
        toolId: assertNonEmptyString(toolDefinition.id, 'Tool id'),
        role: assertNonEmptyString(template.role, 'Window role'),
        title: typeof options.title === 'string' && options.title.length ? options.title : template.title,
        singleton: Boolean(toolDefinition.singleton),
        defaultVisible: Boolean(template.defaultVisible),
        capabilities: {
            close: template.capabilities.close !== false,
            minimize: template.capabilities.minimize !== false,
            maximize: template.capabilities.maximize !== false,
            resize: template.capabilities.resize !== false,
            persist: template.capabilities.persist !== false
        },
        geometry: {
            defaultPosition: clonePoint(assertPoint(
                options.defaultPosition || template.defaultPosition,
                'Window defaultPosition'
            )),
            defaultSize: cloneSize(assertSize(
                options.defaultSize || template.defaultSize,
                'Window defaultSize'
            )),
            minSize: cloneSize(assertSize(template.minSize, 'Window minSize')),
            maxSize: cloneSize(assertSize(template.maxSize, 'Window maxSize'))
        },
        commandScope: toolDefinition.commandScope || null,
        compatibility: toolDefinition.compatibility ? {...toolDefinition.compatibility} : null
    };

    return freezeDeep(descriptor);
};

const normalizeWindowState = (descriptor, candidate = {}) => {
    if (!isPlainObject(descriptor) || descriptor.modelId !== WORKSPACE_WINDOW_MODEL_ID) {
        throw new TypeError('normalizeWindowState requires a Workspace Window descriptor.');
    }
    const source = isPlainObject(candidate) ? candidate : {};
    const defaultPosition = descriptor.geometry.defaultPosition;
    const defaultSize = descriptor.geometry.defaultSize;
    const minSize = descriptor.geometry.minSize;
    const maxSize = descriptor.geometry.maxSize;
    const sourcePosition = isPlainObject(source.position) ? source.position : defaultPosition;
    const sourceSize = isPlainObject(source.size) ? source.size : defaultSize;
    const visible = normalizeBoolean(source.visible, descriptor.defaultVisible);
    const minimized = visible && descriptor.capabilities.minimize ?
        normalizeBoolean(source.minimized, normalizeBoolean(source.isMinimized, false)) : false;
    const maximized = visible && descriptor.capabilities.maximize ?
        normalizeBoolean(source.maximized, normalizeBoolean(source.isFullScreen, false)) : false;

    return freezeDeep({
        schemaVersion: WINDOW_STATE_SCHEMA_VERSION,
        modelId: WORKSPACE_WINDOW_MODEL_ID,
        windowId: descriptor.windowId,
        toolId: descriptor.toolId,
        visible,
        minimized,
        maximized,
        position: {
            x: Number.isFinite(sourcePosition.x) ? sourcePosition.x : defaultPosition.x,
            y: Number.isFinite(sourcePosition.y) ? sourcePosition.y : defaultPosition.y
        },
        size: {
            width: clamp(
                Number.isFinite(sourceSize.width) ? sourceSize.width : defaultSize.width,
                minSize.width,
                maxSize.width
            ),
            height: clamp(
                Number.isFinite(sourceSize.height) ? sourceSize.height : defaultSize.height,
                minSize.height,
                maxSize.height
            )
        }
    });
};

export {
    WORKSPACE_WINDOW_MODEL_ID,
    WINDOW_DESCRIPTOR_SCHEMA_VERSION,
    WINDOW_STATE_SCHEMA_VERSION,
    WINDOW_ROLES,
    createWindowDescriptor,
    normalizeWindowState
};
