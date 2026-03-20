require('./src/utils/registerPunycodeAlias');

const createApp = require('./src/app');
const config = require('./src/config/env');

function startServer({ port, enableStaging, label }) {
    const app = createApp({ enableStaging });
    app.listen(port, () => {
        console.log(`Server is running on ${config.baseUrl}:${port} (${label})`);
    });
}

if (config.runBothServers) {
    startServer({ port: config.port, enableStaging: false, label: 'production' });
    startServer({ port: config.stagingPort, enableStaging: true, label: 'staging' });
} else {
    const isStagingServer = config.isStaging;
    const port = isStagingServer ? config.stagingPort : config.port;
    startServer({ port, enableStaging: isStagingServer, label: config.nodeEnv });
}
