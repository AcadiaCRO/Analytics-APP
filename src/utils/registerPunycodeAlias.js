const Module = require('module');
const punycodeShim = require('./punycodeShim');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'punycode') {
        return punycodeShim;
    }
    return originalLoad.call(this, request, parent, isMain);
};
