module.exports = {
    apps: [
        {
            name: 'analytics-production',
            script: 'server.js',
            env: {
                NODE_ENV: 'production',
                RUN_MODE: 'single',
            },
        },
        {
            name: 'analytics-staging',
            script: 'server.js',
            env: {
                NODE_ENV: 'staging',
                RUN_MODE: 'single',
            },
        },
    ],
};
