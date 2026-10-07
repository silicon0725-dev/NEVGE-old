'use strict';

// Module capability/service facades preserve array indexing and `length`, but intentionally
// do not preserve Array identity across the authority boundary. Values returned by one
// capability therefore must be materialized before they are forwarded to another portable
// protocol/capability boundary.
const isFacadeArrayLike = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    let length;
    try {
        length = value.length;
    } catch {
        return false;
    }
    if (!Number.isSafeInteger(length) || length < 0) return false;
    const keys = Object.keys(value);
    if (keys.some(key => !/^\d+$/.test(key))) return false;
    return keys.every(key => Number(key) < length);
};

const materializePortableCapabilityValue = (value, seen = new WeakMap()) => {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);

    if (Array.isArray(value) || isFacadeArrayLike(value)) {
        const length = value.length;
        const result = [];
        seen.set(value, result);
        for (let index = 0; index < length; index++) {
            result.push(materializePortableCapabilityValue(value[index], seen));
        }
        return result;
    }

    const result = {};
    seen.set(value, result);
    Object.keys(value).forEach(key => {
        result[key] = materializePortableCapabilityValue(value[key], seen);
    });
    return result;
};

module.exports = {
    isFacadeArrayLike,
    materializePortableCapabilityValue
};
