const axios = require('axios');

const CONFIG_SERVER_URL = process.env.CONFIG_SERVER_URL || 'http://localhost:8080';
const APP_NAME          = process.env.APP_NAME || 'njila-notification-service';
const PROFILE           = 'default';

async function fetchRemoteConfig() {
    const url = `${CONFIG_SERVER_URL}/${APP_NAME}/${PROFILE}`;
    process.stderr.write(`[CONFIG] Connexion a njila-conf-service : ${url}\n`);

    try {
        const response   = await axios.get(url, { timeout: 10000 });
        const properties = {};

        for (const source of response.data.propertySources || []) {
            Object.assign(properties, source.source || {});
        }

        process.stderr.write(`[CONFIG] OK - Port recu : ${properties['server.port'] || 'non defini'}\n`);
        return properties;

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            process.stderr.write('[CONFIG] WARN - Timeout - utilisation valeurs locales\n');
        } else {
            process.stderr.write(`[CONFIG] WARN - ${error.message} - utilisation valeurs locales\n`);
        }
        return {};
    }
}

module.exports = { fetchRemoteConfig };
