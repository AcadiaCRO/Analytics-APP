const { domainToASCII, domainToUnicode } = require('url');

const ucs2 = {
    decode(input = '') {
        return Array.from(input).map((char) => char.codePointAt(0));
    },
    encode(codePoints = []) {
        return String.fromCodePoint(...codePoints);
    },
};

function toASCII(input = '') {
    const result = domainToASCII(input);
    if (!result) {
        throw new Error('Invalid domain for ASCII conversion');
    }
    return result;
}

function toUnicode(input = '') {
    return domainToUnicode(input);
}

module.exports = {
    toASCII,
    toUnicode,
    ucs2,
};
