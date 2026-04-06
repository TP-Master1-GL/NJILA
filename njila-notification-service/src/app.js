require('dotenv').config();
const express               = require('express');
const { fetchRemoteConfig } = require('./cloud/configClient');
const { registerToEureka }  = require('./cloud/eurekaClient');
const notificationRoutes    = require('./routes/notifications');

async function bootstrap() {
    console.log('');
    console.log('=================================================');
    console.log('  NJILA - njila-notification-service');
    console.log('=================================================');
    console.log('');

    // Etape 1 : Fetch config
    console.log('[START] Etape 1 - Lecture config sur njila-conf-service (8080)...');
    const remoteConfig = await fetchRemoteConfig();
    const PORT = parseInt(remoteConfig['server.port'] || process.env.PORT || 8085);
    console.log(`[START] Port resolu : ${PORT}`);
    console.log('');

    // Etape 2 : Enregistrement Eureka
    console.log('[START] Etape 2 - Enregistrement sur njila-registry-service (8761)...');
    registerToEureka(PORT);
    console.log('');

    // Etape 3 : Serveur Express
    const app = express();
    app.use(express.json());
    app.use('/api/notifications', notificationRoutes);

    app.listen(PORT, () => {
        console.log(`[START] njila-notification-service demarre sur le port ${PORT}`);
        console.log(`[START] Health : http://localhost:${PORT}/api/notifications/health`);
    });
}

bootstrap().catch(err => {
    console.error('[START] Erreur demarrage :', err.message);
    process.exit(1);
});
