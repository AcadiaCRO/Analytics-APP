const express = require('express');
const config = require('../config/env');
const healthRoutes = require('./health.routes');
const metadataRoutes = require('./metadata.routes');
const revenueRoutes = require('./revenue.routes');
const engagementRoutes = require('./engagement.routes');
const socialProofRoutes = require('./socialProof.routes');
const stagingRoutes = require('./staging.routes');

function createRouter({ enableStaging = false } = {}) {
    const router = express.Router();

    router.use(healthRoutes);
    router.use(metadataRoutes);
    router.use(revenueRoutes);
    router.use(engagementRoutes);
    router.use(socialProofRoutes);

    if (enableStaging || config.isStaging) {
        router.use(stagingRoutes);
    }

    return router;
}

module.exports = createRouter;
