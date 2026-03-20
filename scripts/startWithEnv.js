const path = require('path');

const rawArgs = process.argv.slice(2);

for (const arg of rawArgs) {
    const [key, ...valueParts] = arg.split('=');
    if (!key || valueParts.length === 0) {
        continue;
    }
    process.env[key] = valueParts.join('=');
}

require(path.resolve(__dirname, '..', 'server.js'));
