const express = require('express');
const { redis, analyticsDataClient } = require('../services/clients');
const config = require('../config/env');

const router = express.Router();
async function fetchSessions(pid, startDate, endDate, dimensions = [], userVariantFilter = null) {
    try {
        // Include the variant dimension if not already present
        if (!dimensions.includes('customUser:user_variant')) {
            dimensions.push('customUser:user_variant');
        }

        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: 'sessions' }],
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        // Filter on user_variant using CONTAINS
        if (userVariantFilter) {
            request.dimensionFilter = {
                filter: {
                    stringFilter: {
                        value: userVariantFilter,
                        matchType: 'CONTAINS',
                    },
                    fieldName: 'customUser:user_variant',
                },
            };
        }

        const [response] = await analyticsDataClient.runReport(request, {});

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        const data = response.rows.map((row) => {
            const obj = {};
            dimensions.forEach((dim, i) => {
                obj[dim] = row.dimensionValues?.[i]?.value || null;
            });
            obj.sessions = row.metricValues?.[0]?.value || '0';
            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error fetching GA sessions:', error);
        return null;
    }
}

router.get('/sessions', async (req, res) => {
    const pid = req.query.pid;
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'today';
    const dimensions = req.query.dimensions ? req.query.dimensions.split(',') : [];
    const userVariantFilter = req.query.userVariantFilter || null; // NEW

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    try {
        const cacheKey = `ga:${pid}:sessions:${dimensions.join('-')}:${startDate}:${endDate}:${userVariantFilter || 'none'}`;

        // Check Redis
        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            return res.json({
                pid,
                metrics: ['sessions'],
                dimensions,
                startDate,
                endDate,
                userVariantFilter,
                value: JSON.parse(cachedValue),
                source: 'cache',
            });
        }

        // Fresh fetch
        const result = await fetchSessions(pid, startDate, endDate, dimensions, userVariantFilter);

        if (result !== null) {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds); // cache 24h
        }

        return res.json({
            pid,
            metrics: ['sessions'],
            dimensions,
            startDate,
            endDate,
            userVariantFilter,
            value: result,
            source: 'fresh',
        });
    } catch (error) {
        console.error('Error in /sessions:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch addToCarts metric with optional user_variant filter
async function fetchAddToCarts(pid, startDate, endDate, dimensions = [], userVariantFilter = null) {
    try {
        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: 'addToCarts' }],
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        // add user_variant dimension if not already included
        if (!dimensions.includes('customUser:user_variant')) {
            request.dimensions.push({ name: 'customUser:user_variant' });
        }

        // add filter if provided
        if (userVariantFilter) {
            request.dimensionFilter = {
                filter: {
                    fieldName: 'customUser:user_variant',
                    stringFilter: {
                        matchType: 'CONTAINS', // ✅ matches partials
                        value: userVariantFilter,
                    },
                },
            };
        }

        const [response] = await analyticsDataClient.runReport(request, {});

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        // map + group results by user_variant
        const data = response.rows.map((row) => {
            const obj = {};
            dimensions.forEach((dim, i) => {
                obj[dim] = row.dimensionValues?.[i]?.value || null;
            });

            // last dimension is always user_variant
            obj.user_variant = row.dimensionValues?.[dimensions.length]?.value || null;
            obj.addToCarts = row.metricValues?.[0]?.value || '0';
            return obj;
        });

        // group by variant for easier consumption
        const grouped = {};
        data.forEach((item) => {
            if (!grouped[item.user_variant]) grouped[item.user_variant] = [];
            grouped[item.user_variant].push(item);
        });

        return grouped;
    } catch (error) {
        console.error('Error fetching GA addToCarts:', error);
        return null;
    }
}

router.get('/add-to-carts', async (req, res) => {
    const pid = req.query.pid;
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'today';
    const userVariantFilter = req.query.userVariantFilter || null;
    const dimensions = req.query.dimensions ? req.query.dimensions.split(',') : [];

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    try {
        const cacheKey = `ga:${pid}:addToCarts:${dimensions.join('-')}:${userVariantFilter || 'all'}:${startDate}:${endDate}`;

        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            return res.json({
                pid,
                metrics: ['addToCarts'],
                dimensions: [...dimensions, 'customUser:user_variant'],
                startDate,
                endDate,
                userVariantFilter,
                value: JSON.parse(cachedValue),
                source: 'cache',
            });
        }

        const result = await fetchAddToCarts(
            pid,
            startDate,
            endDate,
            dimensions,
            userVariantFilter
        );

        if (result !== null) {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds);
        }

        return res.json({
            pid,
            metrics: ['addToCarts'],
            dimensions: [...dimensions, 'customUser:user_variant'],
            startDate,
            endDate,
            userVariantFilter,
            value: result,
            source: 'fresh',
        });
    } catch (error) {
        console.error('Error in /analytics/add-to-carts:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch transactions & purchaseRevenue, optionally filtered by user_variant
async function fetchTransactionsWithRevenue(
    pid,
    startDate,
    endDate,
    dimensions = [],
    userVariantFilter = null
) {
    try {
        let metrics = [{ name: 'transactions' }, { name: 'purchaseRevenue' }];
        if (dimensions.includes('itemId')) {
            metrics = [{ name: 'itemsPurchased' }, { name: 'itemRevenue' }];
        }

        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics,
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        // Optionally add a user variant filter if passed
        if (userVariantFilter) {
            request.dimensionFilter = {
                filter: {
                    fieldName: 'customUser:user_variant',
                    stringFilter: {
                        value: userVariantFilter,
                        matchType: 'CONTAINS', // use CONTAINS instead of EXACT
                    },
                },
            };
        }

        const [response] = await analyticsDataClient.runReport(request, {});

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        const data = response.rows.map((row) => {
            const obj = {};
            dimensions.forEach((dim, i) => {
                obj[dim] = row.dimensionValues?.[i]?.value || null;
            });
            obj.transactions = row.metricValues?.[0]?.value || '0';
            obj.purchaseRevenue = row.metricValues?.[1]?.value || '0';
            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error fetching GA transactions:', error);
        return null;
    }
}

// Updated endpoint
router.get('/transactions', async (req, res) => {
    const pid = req.query.pid;
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'today';
    const dimensions = req.query.dimensions ? req.query.dimensions.split(',') : [];
    const userVariantFilter = req.query.userVariantFilter || null;

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    try {
        const cacheKey = `ga:${pid}:transactions:${dimensions.join('-')}:${startDate}:${endDate}:${userVariantFilter || ''}`;

        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            return res.json({
                pid,
                metrics: ['transactions', 'purchaseRevenue'],
                dimensions,
                startDate,
                endDate,
                value: JSON.parse(cachedValue),
                source: 'cache',
            });
        }

        const result = await fetchTransactionsWithRevenue(
            pid,
            startDate,
            endDate,
            dimensions,
            userVariantFilter
        );

        if (result !== null) {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds);
        }

        return res.json({
            pid,
            metrics: ['transactions', 'purchaseRevenue'],
            dimensions,
            startDate,
            endDate,
            userVariantFilter,
            value: result,
            source: 'fresh',
        });
    } catch (error) {
        console.error('Error in /transactions:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch items purchased from GA4
async function fetchItemsPurchased(
    pid,
    startDate,
    endDate,
    dimensions = [],
    userVariantFilter = null
) {
    try {
        //    const metrics = [{ name: "itemsPurchased" }];
        const metrics = [{ name: 'itemsPurchased' }, { name: 'itemRevenue' }];
        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics,
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        // Apply userVariantFilter as a dimension filter if provided
        if (userVariantFilter) {
            request.dimensionFilter = {
                filter: {
                    fieldName: 'customUser:user_variant',
                    stringFilter: {
                        value: userVariantFilter,
                        matchType: 'CONTAINS', // use CONTAINS to match all variants that include the string
                    },
                },
            };
        }

        const [response] = await analyticsDataClient.runReport(request, {});

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        const data = response.rows.map((row) => {
            const obj = {};
            dimensions.forEach((dim, i) => {
                obj[dim] = row.dimensionValues?.[i]?.value || null;
            });
            obj.itemsPurchased = parseInt(row.metricValues?.[0]?.value || '0', 10);
            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error fetching items purchased:', error);
        return null;
    }
}

// New API endpoint
router.get('/items-purchased-by-variant', async (req, res) => {
    const pid = req.query.pid;
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'today';
    const dimensions = req.query.dimensions
        ? req.query.dimensions.split(',')
        : ['deviceCategory', 'customUser:user_variant'];
    const userVariantFilter = req.query.userVariantFilter || null;

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    try {
        const cacheKey = `ga:${pid}:itemsPurchased:${dimensions.join('-')}:${startDate}:${endDate}:${userVariantFilter || ''}`;

        // Check Redis cache
        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            return res.json({
                pid,
                metrics: ['itemsPurchased'],
                dimensions,
                startDate,
                endDate,
                value: JSON.parse(cachedValue),
                source: 'cache',
            });
        }

        // Fetch fresh data
        const result = await fetchItemsPurchased(
            pid,
            startDate,
            endDate,
            dimensions,
            userVariantFilter
        );

        if (result !== null) {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds); // cache 24h
        }

        return res.json({
            pid,
            metrics: ['itemsPurchased'],
            dimensions,
            startDate,
            endDate,
            value: result,
            source: 'fresh',
        });
    } catch (error) {
        console.error('Error in /items-purchased-by-variant:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
