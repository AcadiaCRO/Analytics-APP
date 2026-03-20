const fs = require('fs');
const path = require('path');
const config = require('../config/env');

function now() {
    return Date.now();
}

function retentionMs() {
    return Math.max(config.stagingLogRetentionDays || 1, 1) * 24 * 60 * 60 * 1000;
}

function resolveLogPath() {
    return path.resolve(config.stagingLogFilePath);
}

function ensureLogFile() {
    const filePath = resolveLogPath();
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
    }
    return filePath;
}

function parseLogLine(line) {
    if (!line.trim()) {
        return null;
    }
    try {
        return JSON.parse(line);
    } catch {
        return null;
    }
}

function readRawEntries() {
    const filePath = ensureLogFile();
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
        return [];
    }
    return raw.split('\n').map(parseLogLine).filter(Boolean);
}

function persistEntries(entries) {
    const filePath = ensureLogFile();
    const serialized =
        entries.length > 0 ? `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n` : '';
    fs.writeFileSync(filePath, serialized, 'utf8');
}

function cleanup() {
    const minTime = now() - retentionMs();
    const current = readRawEntries();
    const retained = current.filter((entry) => Number(entry.ts || 0) >= minTime);
    if (retained.length !== current.length) {
        persistEntries(retained);
    }
}

function addLog(entry) {
    cleanup();
    const filePath = ensureLogFile();
    const payload = { type: 'request', ...entry, ts: now() };
    fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function getLogs() {
    cleanup();
    return readRawEntries()
        .filter((entry) => entry.type === 'request')
        .map(({ ts, ...rest }) => ({
            ...rest,
            time: new Date(ts).toISOString(),
        }));
}

function addErrorLog(entry) {
    cleanup();
    const filePath = ensureLogFile();
    const payload = { type: 'error', ...entry, ts: now() };
    fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function getErrorLogs() {
    cleanup();
    return readRawEntries()
        .filter((entry) => entry.type === 'error')
        .map(({ ts, ...rest }) => ({
            ...rest,
            time: new Date(ts).toISOString(),
        }));
}

function getLogFileContent() {
    cleanup();
    const filePath = ensureLogFile();
    return fs.readFileSync(filePath, 'utf8');
}

function getLogFilePath() {
    return ensureLogFile();
}

function clearLogs() {
    persistEntries([]);
}

setInterval(cleanup, 30 * 60 * 1000).unref();

module.exports = {
    addLog,
    addErrorLog,
    getLogs,
    getErrorLogs,
    clearLogs,
    getLogFilePath,
    getLogFileContent,
};
