const toCodePoints = value => Array.from(String(value), character => character.codePointAt(0));

const compareCanonicalStrings = (leftValue, rightValue) => {
    const left = toCodePoints(leftValue);
    const right = toCodePoints(rightValue);
    const length = Math.min(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        if (left[index] === right[index]) continue;
        return left[index] < right[index] ? -1 : 1;
    }
    if (left.length === right.length) return 0;
    return left.length < right.length ? -1 : 1;
};

module.exports = {
    compareCanonicalStrings
};
