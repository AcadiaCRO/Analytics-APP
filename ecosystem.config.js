module.exports = {
    apps: [
        {
            name: "analytics-production",
            script: "server.js",
            cwd: "/var/www/analytics-app",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "300M",
            env: {
                NODE_ENV: "production",
                RUN_MODE: "single",
                PORT: 8647,
                STAGING_PORT: 8648
            }
        },
        {
            name: "analytics-staging",
            script: "server.js",
            cwd: "/var/www/analytics-app",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "300M",
            env: {
                NODE_ENV: "staging",
                RUN_MODE: "single",
                PORT: 8647,
                STAGING_PORT: 8648
            }
        }
    ]
};