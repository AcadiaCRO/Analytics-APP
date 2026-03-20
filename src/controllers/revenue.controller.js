const express = require('express');
const { redis, analyticsDataClient } = require('../services/clients');
const config = require('../config/env');

const router = express.Router();
async function fetchPurchaseRevenueNew(
    pid,
    startDate,
    endDate,
    dimensions = [],
    userVariantFilter,
    croEvents = []
) {
    try {
        const metricName = dimensions.includes('itemId') ? 'itemRevenue' : 'purchaseRevenue';

        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: metricName }],
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        const filters = [];

        // User variant filter
        if (userVariantFilter) {
            if (!dimensions.includes('customUser:user_variant')) {
                dimensions.push('customUser:user_variant');
                request.dimensions.push({ name: 'customUser:user_variant' });
            }

            filters.push({
                filter: {
                    fieldName: 'customUser:user_variant',
                    stringFilter: {
                        matchType: 'CONTAINS',
                        value: userVariantFilter,
                    },
                },
            });
        }

        // CRO event filter (eventName + event_category)
        if (croEvents.length) {
            if (!dimensions.includes('customEvent:event_category')) {
                dimensions.push('customEvent:event_category');
                request.dimensions.push({ name: 'customEvent:event_category' });
            }

            filters.push({
                andGroup: {
                    expressions: [
                        {
                            filter: {
                                fieldName: 'eventName',
                                stringFilter: {
                                    matchType: 'EXACT',
                                    value: 'cro_event',
                                },
                            },
                        },
                        {
                            filter: {
                                fieldName: 'customEvent:event_category',
                                inListFilter: {
                                    values: croEvents,
                                },
                            },
                        },
                    ],
                },
            });
        }

        // Apply filters
        if (filters.length === 1) {
            request.dimensionFilter = filters[0];
        } else if (filters.length > 1) {
            request.dimensionFilter = {
                andGroup: {
                    expressions: filters,
                },
            };
        }

        const [response] = await analyticsDataClient.runReport(request);

        if (!response?.rows?.length) {
            return [];
        }

        return response.rows.map((row) => {
            const obj = {};
            dimensions.forEach((dim, i) => {
                obj[dim] = row.dimensionValues?.[i]?.value || null;
            });
            obj[metricName] = row.metricValues?.[0]?.value || '0';
            return obj;
        });
    } catch (error) {
        console.error('Error fetching GA purchase revenue (new):', error);
        return null;
    }
}

router.get('/purchase-revenue-new', async (req, res) => {
    const pid = req.query.pid;
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'today';

    const dimensions = req.query.dimensions
        ? req.query.dimensions.split(',').map(decodeURIComponent)
        : ['deviceCategory'];

    const userVariantFilter = req.query.userVariantFilter || null;

    const croEvents = req.query.croEvents
        ? req.query.croEvents.split(',').map((e) => e.trim())
        : [];

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    try {
        const cacheKey =
            `ga:${pid}:purchaseRevenueNew:` +
            `${dimensions.join('-')}:${startDate}:${endDate}:` +
            `${userVariantFilter || ''}:` +
            `${croEvents.join('|')}`;

        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            return res.json(JSON.parse(cachedValue));
        }

        const result = await fetchPurchaseRevenueNew(
            pid,
            startDate,
            endDate,
            dimensions,
            userVariantFilter,
            croEvents
        );

        const response = {
            pid,
            metrics: [dimensions.includes('itemId') ? 'itemRevenue' : 'purchaseRevenue'],
            dimensions,
            startDate,
            endDate,
            userVariantFilter,
            croEvents,
            value: result,
            source: 'fresh',
        };

        await redis.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTtlSeconds);

        return res.json(response);
    } catch (error) {
        console.error('Error in /purchase-revenue-new:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

//ELIMINATE
// Fetch purchase revenue, optionally filtered by User Variant
async function fetchPurchaseRevenue(pid, startDate, endDate, dimensions = [], userVariantFilter) {
    try {
        // Decide metric: use itemRevenue if itemId is included
        const metricName = dimensions.includes('itemId') ? 'itemRevenue' : 'purchaseRevenue';

        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: metricName }],
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        // Add User Variant filter if provided
        if (userVariantFilter) {
            if (!dimensions.includes('customUser:user_variant')) {
                dimensions.push('customUser:user_variant');
                request.dimensions.push({ name: 'customUser:user_variant' });
            }
            request.dimensionFilter = {
                filter: {
                    fieldName: 'customUser:user_variant',
                    stringFilter: {
                        matchType: 'CONTAINS',
                        value: userVariantFilter,
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
            obj[metricName] = row.metricValues?.[0]?.value || '0';
            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error fetching GA purchase revenue:', error);
        return null;
    }
}

// Endpoint
router.get('/purchase-revenue', async (req, res) => {
    const pid = req.query.pid;
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'today';

    const dimensions = req.query.dimensions
        ? req.query.dimensions.split(',').map((d) => decodeURIComponent(d))
        : ['deviceCategory']; // default to deviceCategory if nothing passed

    const userVariantFilter = req.query.userVariantFilter || null;

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    try {
        const cacheKey = `ga:${pid}:purchaseRevenue:${dimensions.join('-')}:${startDate}:${endDate}:${userVariantFilter || ''}`;

        // Check Redis cache
        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            return res.json({
                pid,
                metrics: [dimensions.includes('itemId') ? 'itemRevenue' : 'purchaseRevenue'],
                dimensions,
                startDate,
                endDate,
                userVariantFilter,
                value: JSON.parse(cachedValue),
                source: 'cache',
            });
        }

        // Fetch fresh GA data
        const result = await fetchPurchaseRevenue(
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
            metrics: [dimensions.includes('itemId') ? 'itemRevenue' : 'purchaseRevenue'],
            dimensions,
            startDate,
            endDate,
            userVariantFilter,
            value: result,
            source: 'fresh',
        });
    } catch (error) {
        console.error('Error in /purchase-revenue:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
