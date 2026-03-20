const express = require('express');
const { analyticsDataClient } = require('../services/clients');

const router = express.Router();
router.get('/metadata-dimensions', async (req, res) => {
    const pid = req.query.pid;

    if (!pid) return res.status(400).json({ error: 'Missing pid' });

    try {
        const [response] = await analyticsDataClient.getMetadata({
            name: `properties/${pid}/metadata`, // note the "/metadata" suffix
        });

        // Return all dimensions with displayName and apiName
        const dims = (response.dimensions || []).map((d) => ({
            displayName: d.displayName,
            apiName: d.apiName,
        }));

        res.json(dims);
    } catch (err) {
        console.error('Error fetching GA metadata:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
