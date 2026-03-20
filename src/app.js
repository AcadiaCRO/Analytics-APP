const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const corsConfig = require('./config/cors');
const createRouter = require('./routes');
const requestIdMiddleware = require('./middlewares/requestId.middleware');
const stagingLogger = require('./middlewares/stagingLogger.middleware');
const errorHandler = require('./middlewares/errorHandler.middleware');

function createApp({ enableStaging = false } = {}) {
    const app = express();

    app.use(express.json());
    app.use(cors(corsConfig));
    app.use(requestIdMiddleware);

    if (enableStaging || config.isStaging) {
        app.use(stagingLogger);
    }

    app.use(createRouter({ enableStaging }));
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
