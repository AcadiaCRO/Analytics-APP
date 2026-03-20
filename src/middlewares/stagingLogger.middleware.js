const config = require('../config/env');
const { addLog, addErrorLog } = require('../helpers/stagingLogStore');

function shouldIgnoreErrorLog(req, statusCode) {
    if (statusCode < 400) {
        return true;
    }

    const requestPath = req.path || req.originalUrl || '';
    return config.stagingIgnoredErrorPaths.includes(requestPath);
}

module.exports = function stagingLogger(req, res, next) {
    const startedAt = Date.now();
    let responseBody;

    const originalJson = res.json.bind(res);
    res.json = (body) => {
        responseBody = body;
        return originalJson(body);
    };

    res.on('finish', () => {
        const baseLog = {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            ip: req.ip,
            userAgent: req.get('user-agent') || '',
            requestId: req.requestId || null,
        };

        addLog({
            ...baseLog,
        });

        if (!shouldIgnoreErrorLog(req, res.statusCode)) {
            addErrorLog({
                ...baseLog,
                errorMessage:
                    (responseBody && (responseBody.error || responseBody.message)) ||
                    `Request failed with status ${res.statusCode}`,
                responseBody: responseBody || null,
            });
        }
    });
    next();
};
