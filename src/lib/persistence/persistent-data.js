'use strict';

const {
    PersistentDTOValidationError,
    assertPersistentDTO,
    clonePersistentDTO,
    validatePersistentDTO
} = require('../../core/persistent');

const PERSISTENT_DATA_VALIDATION_ERROR = 'PERSISTENT_DATA_VALIDATION_FAILED';

class PersistentDataValidationError extends PersistentDTOValidationError {
    constructor (issues, message = null) {
        super(issues, message);
        this.code = PERSISTENT_DATA_VALIDATION_ERROR;
        this.name = 'PersistentDataValidationError';
    }
}

const validatePersistentData = (value, options = {}) => validatePersistentDTO(value, options);

const assertPersistentData = (value, options = {}) => {
    try {
        return assertPersistentDTO(value, options);
    } catch (error) {
        if (error instanceof PersistentDTOValidationError) {
            throw new PersistentDataValidationError(error.issues, error.message);
        }
        throw error;
    }
};

const clonePersistentData = (value, options = {}) => {
    try {
        return clonePersistentDTO(value, options);
    } catch (error) {
        if (error instanceof PersistentDTOValidationError) {
            throw new PersistentDataValidationError(error.issues, error.message);
        }
        throw error;
    }
};

module.exports = {
    PERSISTENT_DATA_VALIDATION_ERROR,
    PersistentDataValidationError,
    assertPersistentData,
    clonePersistentData,
    validatePersistentData
};
