const {validatePersistentData} = require('../persistence/persistent-data');

const PORTABLE_DATA_VALIDATION_ERROR = 'PORTABLE_DATA_VALIDATION_FAILED';

class PortableDataValidationError extends TypeError {
    constructor (issues, message = null) {
        const normalizedIssues = Array.isArray(issues) ? issues : [];
        const first = normalizedIssues[0];
        super(message || (first ?
            `Portable data is invalid at ${first.path}: ${first.message}` :
            'Portable data is invalid.'));
        this.code = PORTABLE_DATA_VALIDATION_ERROR;
        this.issues = normalizedIssues;
        this.name = 'PortableDataValidationError';
    }
}

const normalizePortableIssues = issues => Object.freeze((Array.isArray(issues) ? issues : []).map(issue => Object.freeze({
    code: typeof issue.code === 'string' ? issue.code.replace(/^persistent\./, 'portable.') : 'portable.value.invalid',
    message: issue.message,
    path: issue.path,
    valueType: issue.valueType
})));

const validatePortableData = (value, options = {}) => {
    const persistent = validatePersistentData(value, options);
    const issues = normalizePortableIssues(persistent.issues);
    return Object.freeze({
        issues,
        valid: issues.length === 0
    });
};

const assertPortableData = (value, options = {}) => {
    const result = validatePortableData(value, options);
    if (!result.valid) throw new PortableDataValidationError(result.issues);
    return value;
};

const clonePortableData = (value, options = {}) => {
    if (typeof value === 'undefined' && options.allowTopLevelUndefined === true) return undefined;
    assertPortableData(value, options);
    return JSON.parse(JSON.stringify(value));
};

module.exports = {
    PORTABLE_DATA_VALIDATION_ERROR,
    PortableDataValidationError,
    assertPortableData,
    clonePortableData,
    validatePortableData
};
