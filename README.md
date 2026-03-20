# Analytics-APP

Analytics-APP is a Node.js (Express) API that exposes multiple Google Analytics 4 reporting endpoints with Redis caching, environment-based configuration, and staging-only request logging.

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
    - [Development](#development)
    - [Production](#production)
    - [Staging](#staging)
- [Staging Logs](#staging-logs)
- [PM2 (2 separate processes)](#pm2-2-separate-processes)
- [Available Routes](#available-routes)
- [Project Structure](#project-structure)
- [Code Formatting (4-space indentation)](#code-formatting-4-space-indentation)
- [Troubleshooting](#troubleshooting)

## Overview

The API is organized into modular route/controller domains:

- Metadata endpoints
- Revenue endpoints
- Engagement endpoints
- Social-proof/reporting endpoints

Key runtime behavior:

- Uses `.env` variables for all runtime config
- Uses Redis for caching GA responses
- Supports dedicated `staging` mode with:
    - separate port
    - staging-only request logs in a dedicated file
    - retention-based automatic cleanup (default: 1 day)
    - routes for reading staging logs and the raw log file content

## Requirements

- Node.js 18+ (Node.js 20 recommended)
- npm
- Redis (local or remote)
- Google Analytics service account credentials (provided through environment variables)

## Installation

```bash
npm install
```

## Environment Configuration

1. Copy the template:

```bash
cp .env.example .env
```

2. Fill in values in `.env`.

### Important Environment Variables

- `NODE_ENV`: `development`, `staging`, or `production`
- `RUN_MODE`: `single` or `both` (start prod + staging together)
- `PORT`: main app port
- `STAGING_PORT`: port used when `NODE_ENV=staging`
- `BASE_URL`: base URL used in startup logs
- `CORS_ORIGIN`: allowed origins (comma-separated)
- `REDIS_URL`: optional Redis connection URL
- `CACHE_TTL_SECONDS`: cache TTL
- `STAGING_LOG_FILE_PATH`: staging log file location
- `STAGING_LOG_RETENTION_DAYS`: how many days staging logs are kept (default `1`)
- `STAGING_IGNORED_ERROR_PATHS`: comma-separated paths ignored by staging error logging (default `/favicon.ico`)

### Google Analytics Credentials (all from env)

The app expects full service-account credentials in env variables:

- `GA_TYPE`
- `GA_PROJECT_ID`
- `GA_PRIVATE_KEY_ID`
- `GA_PRIVATE_KEY` (use escaped `\n` in `.env`)
- `GA_CLIENT_EMAIL`
- `GA_CLIENT_ID`
- `GA_AUTH_URI`
- `GA_TOKEN_URI`
- `GA_AUTH_PROVIDER_X509_CERT_URL`
- `GA_CLIENT_X509_CERT_URL`
- `GA_UNIVERSE_DOMAIN`

## Running the Application

### Development

```bash
npm run dev
```

- Uses `nodemon`
- Uses `PORT`
- Recommended for local changes

### Production

```bash
npm start
```

- Starts once with Node.js
- Uses `PORT`
- Set `NODE_ENV=production` in your environment

Example:

```bash
NODE_ENV=production npm start
```

### Staging

```bash
npm run start:staging
```

- Sets `NODE_ENV=staging` (cross-platform, works on Windows too)
- Uses `STAGING_PORT` (falls back to `PORT` if needed)
- Enables staging logger middleware and staging-only routes

Example running in parallel with production:

```bash
# Terminal 1 (production)
npm start

# Terminal 2 (staging)
npm run start:staging
```

### Run production and staging in parallel (single process)

```bash
npm run start:both
```

- Starts production server on `PORT`
- Starts staging server on `STAGING_PORT`
- Keeps production logic unchanged; staging-only middleware/routes are enabled only on the staging listener
- Sets env vars in a cross-platform way (Windows/macOS/Linux)

### PM2 (2 separate processes)

If you want production and staging as two distinct PM2 processes, use `ecosystem.config.js`.

```bash
npm run pm2:start
```

This starts:

- `analytics-production` (`NODE_ENV=production`, uses `PORT`)
- `analytics-staging` (`NODE_ENV=staging`, uses `STAGING_PORT`)

Useful commands:

```bash
npm run pm2:restart
npm run pm2:stop
pm2 logs analytics-staging
pm2 logs analytics-production
```

Note: for the staging log file (`STAGING_LOG_FILE_PATH`), use a path accessible by the PM2 user.

## Staging Logs

Only active in `staging` mode.

- `GET /staging/logs` → returns parsed staging request logs
- `GET /staging/logs/errors` → returns parsed error logs captured for failed requests (`status >= 400`)
- `GET /staging/logs/file` → returns raw log file content (`text/plain`)
- `GET /staging/logs/meta` → returns active log file path
- `GET /staging/logs/clear` → clears current logs

Each log entry includes:

- `time`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `ip`
- `userAgent`
- `requestId`

Log retention:

- Controlled by `STAGING_LOG_RETENTION_DAYS` (default 1 day)
- Automatically cleaned up periodically and on read/write
- Stored on disk in `STAGING_LOG_FILE_PATH`
- Error log noise can be reduced with `STAGING_IGNORED_ERROR_PATHS` (for example `/favicon.ico`)

## Available Routes

### Health

- `GET /health`

### Metadata

- `GET /metadata-dimensions`

### Revenue

- `GET /purchase-revenue-new`
- `GET /purchase-revenue`

### Engagement

- `GET /sessions`
- `GET /add-to-carts`
- `GET /transactions`
- `GET /items-purchased-by-variant`

### Social Proof / Reporting

- `GET /reporting`
- `GET /social-proof`
- `GET /items-purchased`
- `GET /items-purchased-total`
- `GET /items-purchased-total2`
- `GET /items-purchased-total-all`

## Project Structure

```text
.
├── server.js
├── src
│   ├── app.js
│   ├── config
│   │   ├── cors.js
│   │   └── env.js
│   ├── controllers
│   │   ├── engagement.controller.js
│   │   ├── metadata.controller.js
│   │   ├── revenue.controller.js
│   │   └── socialProof.controller.js
│   ├── helpers
│   │   ├── response.js
│   │   └── stagingLogStore.js
│   ├── middlewares
│   │   ├── errorHandler.middleware.js
│   │   ├── requestId.middleware.js
│   │   └── stagingLogger.middleware.js
│   ├── routes
│   │   ├── engagement.routes.js
│   │   ├── health.routes.js
│   │   ├── index.js
│   │   ├── metadata.routes.js
│   │   ├── revenue.routes.js
│   │   ├── socialProof.routes.js
│   │   └── staging.routes.js
│   ├── services
│   │   └── clients.js
│   └── utils
│       ├── punycodeShim.js
│       └── registerPunycodeAlias.js
├── .env.example
└── package.json
```

## Code Formatting (4-space indentation)

This repository now uses Prettier with 4-space indentation.

### Format all files

```bash
npm run format
```

### Check formatting without changing files

```bash
npm run format:check
```

Configuration is in `.prettierrc`.

## Troubleshooting

### Missing environment variables on startup

If the app exits at startup, verify all required env variables are present in `.env`.

### Redis connection errors

Set `REDIS_URL` for your environment, or ensure local Redis is available.

### Staging logs route not found

`/staging/logs` exists only when app runs in `NODE_ENV=staging`.
