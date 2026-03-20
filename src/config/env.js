const dotenv = require('dotenv');

dotenv.config();

function required(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const runMode = process.env.RUN_MODE || 'single';

const config = {
    nodeEnv,
    runMode,
    runBothServers: runMode === 'both',
    isDevelopment: nodeEnv === 'development',
    isStaging: nodeEnv === 'staging',
    isProduction: nodeEnv === 'production',
    port: toNumber(required('PORT'), 8647),
    stagingPort: toNumber(process.env.STAGING_PORT || process.env.PORT, 8648),
    baseUrl: required('BASE_URL'),
    corsOrigins: required('CORS_ORIGIN')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    stagingIgnoredErrorPaths: (process.env.STAGING_IGNORED_ERROR_PATHS || '/favicon.ico')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    stagingLogFilePath: process.env.STAGING_LOG_FILE_PATH || './logs/staging.log',
    stagingLogRetentionDays: toNumber(process.env.STAGING_LOG_RETENTION_DAYS, 1),
    cacheTtlSeconds: toNumber(process.env.CACHE_TTL_SECONDS, 86400),
    redisUrl: process.env.REDIS_URL || '',
    gaServiceAccount: {
        type: required('GA_TYPE'),
        project_id: required('GA_PROJECT_ID'),
        private_key_id: required('GA_PRIVATE_KEY_ID'),
        private_key: required('GA_PRIVATE_KEY').replace(/\\n/g, '\n'),
        client_email: required('GA_CLIENT_EMAIL'),
        client_id: required('GA_CLIENT_ID'),
        auth_uri: required('GA_AUTH_URI'),
        token_uri: required('GA_TOKEN_URI'),
        auth_provider_x509_cert_url: required('GA_AUTH_PROVIDER_X509_CERT_URL'),
        client_x509_cert_url: required('GA_CLIENT_X509_CERT_URL'),
        universe_domain: required('GA_UNIVERSE_DOMAIN'),
    },
};

module.exports = config;
