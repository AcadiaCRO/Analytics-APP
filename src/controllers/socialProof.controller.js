const express = require('express');
const { redis, analyticsDataClient } = require('../services/clients');
const config = require('../config/env');

const router = express.Router();
async function fetchReportingData(
    pid,
    metrics,
    dimensions,
    startDate = '7daysAgo',
    endDate = 'yesterday',
    filters = {}
) {
    try {
        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: metrics.map((metric) => ({ name: metric })),
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        let expressions = [];

        // Apply dynamic filters (e.g., user, event, product, pagePath)
        Object.keys(filters).forEach((key) => {
            expressions.push({
                filter: {
                    fieldName: key,
                    stringFilter: { matchType: 'EXACT', value: filters[key] },
                },
            });
        });

        if (expressions.length > 0) {
            request.dimensionFilter = { andGroup: { expressions } };
        }

        //console.log("GA4 Reporting Request:", JSON.stringify(request, null, 2));

        const [response] = await analyticsDataClient.runReport(request);

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        return response.rows.map((row) => {
            let obj = {};
            dimensions.forEach((dim, index) => {
                obj[dim] = row.dimensionValues?.[index]?.value || null;
            });
            metrics.forEach((metric, index) => {
                obj[metric] = row.metricValues?.[index]?.value || '0';
            });
            return obj;
        });
    } catch (error) {
        console.error('Error fetching GA reporting data:', error);
        return null;
    }
}

router.get('/reporting', async (req, res) => {
    const pid = req.query.pid;
    const metrics = req.query.metrics ? req.query.metrics.split(',') : [];
    const dimensions = req.query.dimensions ? req.query.dimensions.split(',') : [];
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'yesterday';

    // Extract filters from query params
    let filters = {};
    ['eventName', 'userId', 'productId', 'pagePath', 'customDimension'].forEach((param) => {
        if (req.query[param]) {
            filters[param === 'userId' ? 'userPseudoId' : param] = req.query[param];
        }
    });

    if (!pid || metrics.length === 0 || dimensions.length === 0) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const result = await fetchReportingData(
            pid,
            metrics,
            dimensions,
            startDate,
            endDate,
            filters
        );
        return res.json({ pid, metrics, dimensions, startDate, endDate, filters, value: result });
    } catch (error) {
        console.error('Error processing reporting request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

async function fetchAnalyticsDataNew(
    pid,
    eventName,
    metrics,
    dimensions,
    url = null,
    startDate = '7daysAgo',
    endDate = 'yesterday',
    productIds = []
) {
    try {
        // Replace `eventCount` with `itemsAddedToCart` if tracking Add to Cart events
        metrics = metrics.map((metric) => (metric === 'eventCount' ? 'itemsAddedToCart' : metric));

        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: metrics.map((metric) => ({ name: metric })),
            dimensions: dimensions.length ? dimensions.map((dim) => ({ name: dim })) : [],
        };

        let expressions = [];

        if (eventName) {
            request.dimensions.push({ name: 'eventName' });
            expressions.push({
                filter: {
                    fieldName: 'eventName',
                    stringFilter: { matchType: 'EXACT', value: eventName },
                },
            });
        }

        if (Array.isArray(productIds) && productIds.length > 0) {
            request.dimensions.push({ name: 'itemId' });
            expressions.push({
                filter: {
                    fieldName: 'itemId',
                    inListFilter: { values: productIds },
                },
            });
        }

        if (metrics.includes('screenPageViews') && url) {
            if (!dimensions.includes('pagePath')) {
                request.dimensions.push({ name: 'pagePath' });
            }
            expressions.push({
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: { matchType: 'EXACT', value: url },
                },
            });
        }

        if (expressions.length > 0) {
            request.dimensionFilter = { andGroup: { expressions } };
        }

        const [response] = await analyticsDataClient.runReport(request, {});

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        const data = response.rows.map((row, rowIndex) => {
            let obj = {};

            // add dimensions if any
            if (dimensions.length) {
                dimensions.forEach(
                    (dim, index) => (obj[dim] = row.dimensionValues?.[index]?.value || null)
                );
            }

            // include productId if we asked for productIds
            if (productIds.length > 0) {
                // GA returns itemId as the last dimension we added
                const itemIdIndex = row.dimensionValues?.length - 1;
                obj.productId =
                    row.dimensionValues?.[itemIdIndex]?.value || productIds[rowIndex] || null;
            }

            // add metrics
            metrics.forEach(
                (metric, index) => (obj[metric] = row.metricValues?.[index]?.value || '0')
            );

            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error fetching GA data:', error);
        return null;
    }
}

async function fetchAnalyticsData(
    pid,
    eventName,
    metrics,
    dimensions,
    url = null,
    startDate = '7daysAgo',
    endDate = 'yesterday',
    productIds = []
) {
    try {
        // Replace `eventCount` with `itemsAddedToCart` if tracking Add to Cart events
        metrics = metrics.map((metric) => (metric === 'eventCount' ? 'itemsAddedToCart' : metric));

        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: metrics.map((metric) => ({ name: metric })),
            dimensions: dimensions.length ? dimensions.map((dim) => ({ name: dim })) : [],
        };

        let expressions = [];

        if (eventName) {
            request.dimensions.push({ name: 'eventName' });
            expressions.push({
                filter: {
                    fieldName: 'eventName',
                    stringFilter: { matchType: 'EXACT', value: eventName },
                },
            });
        }

        if (Array.isArray(productIds) && productIds.length > 0) {
            request.dimensions.push({ name: 'itemId' });
            expressions.push({
                filter: {
                    fieldName: 'itemId',
                    inListFilter: { values: productIds },
                },
            });
        }

        if (metrics.includes('screenPageViews') && url) {
            if (!dimensions.includes('pagePath')) {
                request.dimensions.push({ name: 'pagePath' });
            }
            expressions.push({
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: { matchType: 'EXACT', value: url },
                },
            });
        }

        if (expressions.length > 0) {
            request.dimensionFilter = { andGroup: { expressions } };
        }

        //    console.log("GA4 Request Before Execution:", JSON.stringify(request, null, 2));

        const [response, metadata] = await analyticsDataClient.runReport(request, {});

        //    if (metadata && metadata.internalRepr) {
        //      console.log("Quota Info:");
        //      console.log("Requests Per 100 Seconds:", metadata.internalRepr.get('x-goog-quota-project'));
        //      console.log("Tokens Used:", metadata.internalRepr.get('x-goog-api-client'));
        //    }

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        const data = response.rows.map((row) => {
            let obj = {};
            if (dimensions.length) {
                dimensions.forEach(
                    (dim, index) => (obj[dim] = row.dimensionValues?.[index]?.value || null)
                );
            }
            metrics.forEach(
                (metric, index) => (obj[metric] = row.metricValues?.[index]?.value || '0')
            );
            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error fetching GA data:', error);
        return null;
    }
}

router.get('/social-proof', async (req, res) => {
    const pid = req.query.pid;
    const eventName = req.query.eventName || null;
    const metrics = req.query.metrics ? req.query.metrics.split(',') : ['eventCount'];
    const dimensions = req.query.dimensions ? req.query.dimensions.split(',') : [];
    const url = req.query.url ? decodeURIComponent(req.query.url) : null;
    const startDate = req.query.startDate || '7daysAgo';
    const endDate = req.query.endDate || 'yesterday';

    let productIds = [];
    if (req.query.productIds) {
        productIds = req.query.productIds.includes(',')
            ? req.query.productIds.split(',')
            : [req.query.productIds];
    }

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    const cacheKey = `ga:${pid}:${eventName || 'all'}:${metrics.join('-')}:${dimensions.join('-')}:${url || 'all'}:${productIds.join('-')}:${startDate}:${endDate}`;

    try {
        // Check Redis cache
        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            //console.log(`Returning cached data for ${cacheKey}`);
            return res.json({
                pid,
                eventName,
                metrics,
                dimensions,
                url,
                productIds,
                startDate,
                endDate,
                value: JSON.parse(cachedValue),
            });
        }

        //console.log(`Fetching fresh analytics data for ${cacheKey}...`);
        const result = await fetchAnalyticsDataNew(
            pid,
            eventName,
            metrics,
            dimensions,
            url,
            startDate,
            endDate,
            productIds
        );

        if (result !== null) {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds); // Cache for 24 hours
        }

        return res.json({
            pid,
            eventName,
            metrics,
            dimensions,
            url,
            productIds,
            startDate,
            endDate,
            value: result,
        });
    } catch (error) {
        console.error('Error processing analytics request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

//////
async function fetchItemsPurchased(
    pid,
    metrics = ['itemsPurchased'],
    dimensions = ['itemId'],
    startDate,
    endDate,
    productIds = []
) {
    try {
        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: metrics.map((metric) => ({ name: metric })),
            dimensions: dimensions.map((dim) => ({ name: dim })),
        };

        const expressions = [];

        // Filter by itemId if productIds are provided
        if (Array.isArray(productIds) && productIds.length > 0) {
            if (!dimensions.includes('itemId')) {
                request.dimensions.push({ name: 'itemId' });
            }
            expressions.push({
                filter: {
                    fieldName: 'itemId',
                    inListFilter: { values: productIds },
                },
            });
        }

        // Add filter group only if expressions exist
        if (expressions.length > 0) {
            request.dimensionFilter = { andGroup: { expressions } };
        }

        const [response] = await analyticsDataClient.runReport(request, {});

        if (!response || !response.rows || response.rows.length === 0) {
            return { message: 'No data found', data: {} };
        }

        const data = response.rows.map((row) => {
            const obj = {};
            dimensions.forEach((dim, index) => {
                obj[dim] = row.dimensionValues?.[index]?.value || null;
            });
            metrics.forEach((metric, index) => {
                obj[metric] = row.metricValues?.[index]?.value || '0';
            });
            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error fetching GA data:', error);
        return null;
    }
}
router.get('/items-purchased', async (req, res) => {
    const pid = req.query.pid;
    const itemIds = req.query.productIds?.split(',') || []; // Expecting GA4-formatted IDs
    const metrics = ['itemsPurchased'];
    const dimensions = ['itemId'];
    const startDate = 'yesterday';
    const endDate = 'today';

    if (!pid || itemIds.length === 0) {
        return res.status(400).json({ error: 'Missing pid or productIds' });
    }

    try {
        // Build Redis cache key
        const cacheKey = `ga:${pid}:itemsPurchased:${itemIds.join('-')}:${startDate}:${endDate}`;

        // Check Redis
        const cachedValue = await redis.get(cacheKey);
        if (cachedValue !== null) {
            //console.log(`Returning cached data for ${cacheKey}`);
            return res.json({
                pid,
                productIds: itemIds,
                metrics,
                dimensions,
                startDate,
                endDate,
                value: JSON.parse(cachedValue),
                source: 'cache',
            });
        }

        // Fetch fresh GA4 data
        const result = await fetchItemsPurchased(
            pid,
            metrics,
            dimensions,
            startDate,
            endDate,
            itemIds
        );

        if (result !== null) {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds); // Cache 24 hours
        }

        return res.json({
            pid,
            productIds: itemIds,
            metrics,
            dimensions,
            startDate,
            endDate,
            value: result,
            source: 'fresh',
        });
    } catch (error) {
        console.error('Error in /social-proof:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
//////
async function fetchTotalItemsPurchased(pid, startDate, endDate, productIds = []) {
    try {
        // Build the request to aggregate itemsPurchased over all productIds
        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: 'itemsPurchased' }],
            // no dimensions => GA4 returns a single aggregated row
            dimensionFilter: {
                filter: {
                    fieldName: 'itemId',
                    inListFilter: { values: productIds },
                },
            },
        };

        //console.log('GA4 Aggregate Request:', JSON.stringify(request, null, 2));
        const [response] = await analyticsDataClient.runReport(request);

        if (!response.rows || response.rows.length === 0) {
            return 0;
        }

        // response.rows[0].metricValues[0].value is the total across all variants
        return Number(response.rows[0].metricValues[0].value);
    } catch (err) {
        console.error('Error fetching total itemsPurchased:', err);
        return null;
    }
}

router.get('/items-purchased-total', async (req, res) => {
    const pid = req.query.pid;
    const productIds = (req.query.productIds || '').split(',');
    const startDate = req.query.startDate || 'today';
    const endDate = req.query.endDate || 'today';

    if (!pid || productIds.length === 0) {
        return res.status(400).json({ error: 'Missing pid or productIds' });
    }

    const cacheKey = `ga:${pid}:itemsPurchasedTotal:${productIds.join('-')}:${startDate}:${endDate}`;
    const cached = await redis.get(cacheKey);
    if (cached != null) {
        return res.json({ pid, productIds, total: Number(cached), source: 'cache' });
    }

    const total = await fetchTotalItemsPurchased(pid, startDate, endDate, productIds);

    if (total != null) {
        await redis.set(cacheKey, String(total), 'EX', config.cacheTtlSeconds);
        return res.json({ pid, productIds, total, source: 'fresh' });
    } else {
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
});

async function fetchTotalItemsPurchased2(pid, startDate, endDate, productIds = []) {
    try {
        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: 'itemsPurchased' }],
            dimensions: [{ name: 'itemId' }],
            dimensionFilter: {
                filter: {
                    fieldName: 'itemId',
                    inListFilter: { values: productIds },
                },
            },
        };

        //console.log('GA4 Per-Variant Request:', JSON.stringify(request, null, 2));
        const [response] = await analyticsDataClient.runReport(request);

        if (!response.rows || response.rows.length === 0) {
            return { total: 0, perVariant: {} };
        }

        let total = 0;
        const perVariant = {};

        for (const row of response.rows) {
            const itemId = row.dimensionValues[0].value;
            const count = Number(row.metricValues[0].value);
            perVariant[itemId] = count;
            total += count;
        }

        return { total, perVariant };
    } catch (err) {
        console.error('Error fetching item purchases:', err);
        return null;
    }
}

router.get('/items-purchased-total2', async (req, res) => {
    const pid = req.query.pid;
    const productIds = (req.query.productIds || '').split(',');
    const startDate = req.query.startDate || 'today';
    const endDate = req.query.endDate || 'today';

    if (!pid || productIds.length === 0) {
        return res.status(400).json({ error: 'Missing pid or productIds' });
    }

    const cacheKey = `ga:${pid}:itemsPurchasedTotal:${productIds.join('-')}:${startDate}:${endDate}`;
    const cached = await redis.get(cacheKey);
    if (cached != null) {
        const parsed = JSON.parse(cached);
        return res.json({ pid, productIds, ...parsed, source: 'cache' });
    }

    const result = await fetchTotalItemsPurchased2(pid, startDate, endDate, productIds);

    if (result != null) {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds);
        return res.json({ pid, productIds, ...result, source: 'fresh' });
    } else {
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
});

async function fetchTotalItemsPurchasedAll(pid, startDate, endDate) {
    try {
        const request = {
            property: `properties/${pid}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: 'itemsPurchased' }],
        };

        const [response] = await analyticsDataClient.runReport(request);

        if (!response.rows || response.rows.length === 0) {
            return { total: 0 };
        }

        const total = Number(response.rows[0].metricValues[0].value);
        return { total };
    } catch (err) {
        console.error('Error fetching total item purchases:', err);
        return null;
    }
}

router.get('/items-purchased-total-all', async (req, res) => {
    const pid = req.query.pid;
    const startDate = req.query.startDate || 'today';
    const endDate = req.query.endDate || 'today';

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    const cacheKey = `ga:${pid}:itemsPurchasedTotalAll:${startDate}:${endDate}`;
    const cached = await redis.get(cacheKey);

    if (cached != null) {
        const parsed = JSON.parse(cached);
        return res.json({ pid, ...parsed, source: 'cache' });
    }

    const result = await fetchTotalItemsPurchasedAll(pid, startDate, endDate);

    if (result != null) {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', config.cacheTtlSeconds);
        return res.json({ pid, ...result, source: 'fresh' });
    }

    return res.status(500).json({ error: 'Failed to fetch data' });
});

module.exports = router;
