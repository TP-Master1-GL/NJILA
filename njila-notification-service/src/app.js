require('dotenv').config();
const express               = require('express');
const { fetchRemoteConfig } = require('./cloud/configClient');
const notificationRoutes    = require('./routes/NotificationRoutes');
const { initDatabase }      = require('./config/database');
const NotificationConsumer  = require('./mq/NotificationConsumer'); // Import du Consumer

async function bootstrap() {
    console.log('\n=================================================');
    console.log('  NJILA - njila-notification-service');
    console.log('=================================================\n');

    try {
        // --- Étape 1 : Lecture de la Configuration ---
        console.log('[START] Etape 1 - Lecture config sur njila-conf-service (8080)...');
        const remoteConfig = await fetchRemoteConfig();
        const PORT = parseInt(remoteConfig['server.port'] || process.env.PORT || 8085);
        console.log(`[START] Port résolu : ${PORT}`);

        // --- Étape 2 : Initialisation de la Base de Données ---
        console.log('[START] Etape 2 - Initialisation de la base de données...');
        const dbInstance = initDatabase(); 
        
        // Chargement du modèle pour Sequelize
        require('./models/notification'); 

        try {
            await dbInstance.sync({ alter: true }); 
            console.log('✅ Base de données synchronisée.');
        } catch (error) {
            console.error('❌ Erreur de synchro DB :', error.message);
        }

        // --- Étape 3 : Lancement de RabbitMQ (Le "Worker") ---
        console.log('[START] Etape 3 - Connexion au Broker RabbitMQ...');
        // On lance l'écoute des queues (Welcome, Reset, Booking, Fleet, etc.)
        NotificationConsumer.start().catch(err => {
            console.error('❌ Impossible de démarrer le Consumer RabbitMQ :', err.message);
        });

        // --- Étape 4 : Serveur Express (API Rest) ---
        const app = express();
        app.use(express.json());

        // Branchement des routes : /api/notifications/health et /api/notifications/history/:userId
        app.use('/api/notifications', notificationRoutes);

        app.listen(PORT, () => {
            console.log(`\n🚀 SERVICE OPÉRATIONNEL`);
            console.log(`📡 Port      : ${PORT}`);
            console.log(`🏥 Health    : http://localhost:${PORT}/api/notifications/health`);
            console.log(`📜 Historique: http://localhost:${PORT}/api/notifications/history/ID_USER`);
            console.log(`\n[*] En attente d'événements sur njila.notification.exchange...\n`);
        });

    } catch (err) {
        console.error('[START] Erreur critique au démarrage :', err.message);
        process.exit(1);
    }
}

bootstrap();