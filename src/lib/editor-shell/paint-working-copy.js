const WORKSPACE_PAINT_WORKING_COPY_MODEL_ID = 'ngvge.workspace-paint-working-copy-model@1';
const WORKSPACE_PAINT_WORKING_COPY_SCHEMA_VERSION = 1;

let workingCopySequence = 0;

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (value && typeof value === 'object' &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const makeWorkingCopyError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const cloneContent = content => {
    if (!content || typeof content !== 'object') {
        throw makeWorkingCopyError(
            'NGVGE_WORKSPACE_PAINT_WORKING_COPY_CONTENT_INVALID',
            'Paint working-copy content must be a portable content record.',
            TypeError
        );
    }
    if (content.kind === 'data-uri') {
        if (typeof content.dataUri !== 'string' || !content.dataUri.startsWith('data:')) {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_DATA_URI_INVALID',
                'Paint working-copy data URI content is invalid.',
                TypeError
            );
        }
        return {kind: 'data-uri', dataUri: content.dataUri};
    }
    if (content.kind === 'svg-text') {
        if (typeof content.text !== 'string') {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_SVG_INVALID',
                'Paint working-copy SVG content must be text.',
                TypeError
            );
        }
        return {kind: 'svg-text', text: content.text};
    }
    throw makeWorkingCopyError(
        'NGVGE_WORKSPACE_PAINT_WORKING_COPY_CONTENT_KIND_UNSUPPORTED',
        `Unsupported Paint working-copy content kind: ${String(content.kind)}`,
        TypeError
    );
};

const normalizeEdit = edit => {
    if (!edit || typeof edit !== 'object') {
        throw makeWorkingCopyError(
            'NGVGE_WORKSPACE_PAINT_WORKING_COPY_EDIT_INVALID',
            'Paint backend edit must be a portable record.',
            TypeError
        );
    }
    const dataFormat = edit.dataFormat === 'jpeg' ? 'jpg' : edit.dataFormat;
    if (dataFormat !== 'svg' && dataFormat !== 'png' && dataFormat !== 'jpg') {
        throw makeWorkingCopyError(
            'NGVGE_WORKSPACE_PAINT_WORKING_COPY_FORMAT_UNSUPPORTED',
            `Unsupported Paint working-copy format: ${String(dataFormat)}`,
            TypeError
        );
    }
    return {
        dataFormat,
        bitmapResolution: Number.isFinite(edit.bitmapResolution) ? edit.bitmapResolution : (dataFormat === 'svg' ? 1 : 2),
        rotationCenterX: Number.isFinite(edit.rotationCenterX) ? edit.rotationCenterX : 0,
        rotationCenterY: Number.isFinite(edit.rotationCenterY) ? edit.rotationCenterY : 0,
        content: cloneContent(edit.content)
    };
};

class WorkspacePaintWorkingCopyModel {
    constructor ({resourceContentRead}) {
        if (!resourceContentRead || typeof resourceContentRead.getImageContent !== 'function' ||
            typeof resourceContentRead.subscribe !== 'function') {
            throw new TypeError('Paint Working Copy requires admitted Resource Content Read capability.');
        }
        this.id = WORKSPACE_PAINT_WORKING_COPY_MODEL_ID;
        this._resourceContentRead = resourceContentRead;
        this._listeners = new Set();
        this._copy = null;
        this._revision = 0;
        this._disposed = false;
        this._unsubscribeSource = resourceContentRead.subscribe(event => this._handleSourceEvent(event));
    }

    _assertActive () {
        if (this._disposed) {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_DISPOSED',
                'Paint Working Copy model has been disposed.'
            );
        }
    }

    _emit (type) {
        this._revision += 1;
        const event = freezeDeep({modelId: this.id, revision: this._revision, type});
        this._listeners.forEach(listener => {
            try {
                listener(event);
            } catch {
                // Working-copy observers never become Project/Resource authority.
            }
        });
    }

    _handleSourceEvent (event) {
        if (!this._copy || !event || !event.contentMayHaveChanged) return;
        if (event.resourceId && event.resourceId !== this._copy.resourceId) return;
        if (event.sourceAuthorityRevision === this._copy.sourceAuthorityRevision) return;
        if (!this._copy.stale) {
            this._copy.stale = true;
            this._emit('source:stale');
        }
    }

    _installSource (source) {
        if (!source || source.kind !== 'image') {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_SOURCE_INVALID',
                'Paint Working Copy source must be a portable image Resource snapshot.'
            );
        }
        workingCopySequence += 1;
        this._copy = {
            schemaVersion: WORKSPACE_PAINT_WORKING_COPY_SCHEMA_VERSION,
            workingCopyId: `ngvge.workspace-paint-working-copy.${workingCopySequence}`,
            resourceId: source.resourceId,
            sourceAuthorityRevision: source.sourceAuthorityRevision,
            dataFormat: source.dataFormat,
            bitmapResolution: source.bitmapResolution,
            rotationCenterX: source.rotationCenterX,
            rotationCenterY: source.rotationCenterY,
            byteLength: source.byteLength,
            dirty: false,
            stale: false,
            content: cloneContent(source.content)
        };
    }

    load (resourceId, {discardDirty = false} = {}) {
        this._assertActive();
        if (this._copy && this._copy.dirty && !discardDirty) {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_DIRTY',
                'Discard the current Paint working copy before loading another Resource.'
            );
        }
        const source = this._resourceContentRead.getImageContent(resourceId);
        this._installSource(source);
        this._emit('working-copy:loaded');
        return this.getState();
    }

    reload () {
        this._assertActive();
        if (!this._copy) {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_REQUIRED',
                'No Paint working copy is loaded.'
            );
        }
        if (this._copy.dirty) {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_DIRTY',
                'Discard local Paint edits before reloading source content.'
            );
        }
        return this.load(this._copy.resourceId, {discardDirty: true});
    }

    discard () {
        this._assertActive();
        if (!this._copy) return null;
        return this.load(this._copy.resourceId, {discardDirty: true});
    }

    clear ({discardDirty = false} = {}) {
        this._assertActive();
        if (this._copy && this._copy.dirty && !discardDirty) {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_DIRTY',
                'Discard local Paint edits before clearing the working copy.'
            );
        }
        if (!this._copy) return false;
        this._copy = null;
        this._emit('working-copy:cleared');
        return true;
    }

    applyEdit (edit) {
        this._assertActive();
        if (!this._copy) {
            throw makeWorkingCopyError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_REQUIRED',
                'Load an image Resource before applying Paint backend edits.'
            );
        }
        const normalized = normalizeEdit(edit);
        this._copy.dataFormat = normalized.dataFormat;
        this._copy.bitmapResolution = normalized.bitmapResolution;
        this._copy.rotationCenterX = normalized.rotationCenterX;
        this._copy.rotationCenterY = normalized.rotationCenterY;
        this._copy.content = normalized.content;
        this._copy.dirty = true;
        this._emit('working-copy:edited');
        return this.getState();
    }

    getContent () {
        this._assertActive();
        if (!this._copy) return null;
        return freezeDeep({
            schemaVersion: this._copy.schemaVersion,
            workingCopyId: this._copy.workingCopyId,
            resourceId: this._copy.resourceId,
            sourceAuthorityRevision: this._copy.sourceAuthorityRevision,
            dataFormat: this._copy.dataFormat,
            bitmapResolution: this._copy.bitmapResolution,
            rotationCenterX: this._copy.rotationCenterX,
            rotationCenterY: this._copy.rotationCenterY,
            dirty: this._copy.dirty,
            stale: this._copy.stale,
            content: cloneContent(this._copy.content)
        });
    }

    getState () {
        this._assertActive();
        if (!this._copy) {
            return freezeDeep({
                schemaVersion: WORKSPACE_PAINT_WORKING_COPY_SCHEMA_VERSION,
                modelId: this.id,
                revision: this._revision,
                loaded: false,
                workingCopyId: null,
                resourceId: null,
                sourceAuthorityRevision: null,
                dataFormat: null,
                contentKind: null,
                dirty: false,
                stale: false
            });
        }
        return freezeDeep({
            schemaVersion: WORKSPACE_PAINT_WORKING_COPY_SCHEMA_VERSION,
            modelId: this.id,
            revision: this._revision,
            loaded: true,
            workingCopyId: this._copy.workingCopyId,
            resourceId: this._copy.resourceId,
            sourceAuthorityRevision: this._copy.sourceAuthorityRevision,
            dataFormat: this._copy.dataFormat,
            bitmapResolution: this._copy.bitmapResolution,
            rotationCenterX: this._copy.rotationCenterX,
            rotationCenterY: this._copy.rotationCenterY,
            byteLength: this._copy.byteLength,
            contentKind: this._copy.content.kind,
            dirty: this._copy.dirty,
            stale: this._copy.stale
        });
    }

    subscribe (listener) {
        this._assertActive();
        if (typeof listener !== 'function') throw new TypeError('Paint Working Copy listener must be a function.');
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    dispose () {
        if (this._disposed) return false;
        this._disposed = true;
        if (this._unsubscribeSource) this._unsubscribeSource();
        this._unsubscribeSource = null;
        this._copy = null;
        this._listeners.clear();
        return true;
    }
}

export {
    WORKSPACE_PAINT_WORKING_COPY_MODEL_ID,
    WORKSPACE_PAINT_WORKING_COPY_SCHEMA_VERSION,
    WorkspacePaintWorkingCopyModel
};
