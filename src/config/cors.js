const config = require('./env');

module.exports = {
    origin(origin, callback) {
        if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
};
