const Redis = require('ioredis');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const config = require('../config/env');

const redis = config.redisUrl ? new Redis(config.redisUrl) : new Redis();

const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: config.gaServiceAccount,
});

module.exports = {
    redis,
    analyticsDataClient,
};
