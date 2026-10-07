let fallbackSequence = 0;

const sanitizePrefix = prefix => (
    typeof prefix === 'string' && prefix.trim() ? prefix.trim() : 'id'
);

const createId = prefix => {
    const safePrefix = sanitizePrefix(prefix);
    fallbackSequence = (fallbackSequence + 1) % Number.MAX_SAFE_INTEGER;
    const time = Date.now().toString(36);
    const sequence = fallbackSequence.toString(36);
    const random = Math.floor(Math.random() * 0x100000000).toString(36);
    return `${safePrefix}_${time}_${sequence}_${random}`;
};

const createIdFactory = prefix => () => createId(prefix);

module.exports = {
    createId,
    createIdFactory
};
