require('dotenv').config();
const express = require('express');
const { fetchRemoteConfig }        = require('./cloud/configClient');
const { registerToEureka }         = require('./cloud/eurekaClient');
const notificationRoutes           = require('./routes/NotificationRoutes');
const { initDatabase }             = require('./config/database');
const { createDatabaseIfNotExists} = require('./config/initDb');
const { getNotificationModel }     = require('./models/notification');
const NotificationConsumer         = require('./mq/NotificationConsummer');

async function bootstrap() {
    console.log('\n=================================================');
    console.log('  NJILA - njila-notification-service');
    console.log('=================================================\n');

    let eurekaClient = null;

    try {
        // 1. CONFIG DISTANTE
        console.log('[START] Lecture config...');
        const remoteConfig = await fetchRemoteConfig();
        const PORT = parseInt(remoteConfig['server.port'] || process.env.PORT || 8085);

        // 2. CRÉATION DB SI ABSENTE
        console.log('[START] Vérification base de données...');
        await createDatabaseIfNotExists();

        // 3. CONNEXION + ENREGISTREMENT MODÈLE + SYNC
        console.log('[START] Synchronisation des tables...');
        const dbInstance = initDatabase();
        getNotificationModel();                  // enregistre le modèle sur l'instance
        await dbInstance.sync({ alter: true });
        console.log('✅ DB prête — tables synchronisées');

        // 4. RABBITMQ
        console.log('[START] RabbitMQ...');
        NotificationConsumer.start().catch(err => {
            console.error('❌ RabbitMQ:', err.message);
        });

        // 5. EXPRESS
        const app = express();
        app.use(express.json());
        app.use('/api/notifications', notificationRoutes);

        app.get('/api/notifications/health', (req, res) => {
            res.status(200).json({
                status:          'UP',
                service:         'njila-notification-service',
                timestamp:       new Date().toISOString(),
                eurekaRegistered: !!eurekaClient
            });
        });

        const server = app.listen(PORT, async () => {
            console.log(`\n SERVICE RUNNING ON ${PORT}`);
            console.log(`Health: http://localhost:${PORT}/api/notifications/health`);
            console.log('[EUREKA] Enregistrement...');
            eurekaClient = registerToEureka(PORT);
        });

        // 6. SHUTDOWN PROPRE
        const shutdown = async (signal) => {
            console.log(`\n ${signal} reçu`);
            if (eurekaClient) eurekaClient.stop();
            server.close(async () => {
                console.log('HTTP fermé');
                try { if (NotificationConsumer.stop) await NotificationConsumer.stop(); } catch (e) {}
                try { await dbInstance.close(); } catch (e) {}
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT',  shutdown);

    } catch (err) {
        console.error(' ERREUR FATALE:', err.message);
        process.exit(1);
    }
}

process.on('uncaughtException',  err => { console.error('FATAL:', err); process.exit(1); });
process.on('unhandledRejection', err => { console.error('FATAL:', err); process.exit(1); });

bootstrap();
