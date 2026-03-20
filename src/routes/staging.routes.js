const express = require('express');
const {
    getLogs,
    getErrorLogs,
    clearLogs,
    getLogFilePath,
    getLogFileContent,
} = require('../helpers/stagingLogStore');

const router = express.Router();

router.get('/staging/logs', (req, res) => {
    res.json({ logs: getLogs() });
});

router.get('/staging/logs/errors', (req, res) => {
    res.json({ logs: getErrorLogs() });
});

router.get('/staging/logs/file', (req, res) => {
    res.type('text/plain').send(getLogFileContent());
});

router.get('/staging/logs/meta', (req, res) => {
    res.json({ filePath: getLogFilePath() });
});

router.get('/staging/logs/clear', (req, res) => {
    clearLogs();
    res.json({ ok: true });
});

module.exports = router;
