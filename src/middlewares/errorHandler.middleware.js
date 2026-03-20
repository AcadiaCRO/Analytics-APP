module.exports = function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
};
