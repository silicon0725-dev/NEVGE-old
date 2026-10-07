const {clonePersistentData} = require('../persistence/persistent-data');

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneSerializable = value => {
    if (value === null || typeof value === 'undefined') return value;
    return clonePersistentData(value);
};

const normalizeSerializableObject = value => (
    isObject(value) ? cloneSerializable(value) : {}
);

module.exports = {
    cloneSerializable,
    isObject,
    normalizeSerializableObject
};
