require('dotenv').config();
const express               = require('express');
const { fetchRemoteConfig } = require('./cloud/configClient');
const { registerToEureka }  = require('./cloud/eurekaClient');
const notificationRoutes    = require('./routes/notifications');

// --- AJOUTS POUR LA DB ---
const { initDatabase }      = require('./config/database');
// ------------------------------------

async function bootstrap() {
    console.log('');
    console.log('=================================================');
    console.log('  NJILA - njila-notification-service');
    console.log('=================================================');

    try {
        // Etape 1 : Fetch config
        console.log('[START] Etape 1 - Lecture config sur njila-conf-service (8080)...');
        const remoteConfig = await fetchRemoteConfig();
        const PORT = parseInt(remoteConfig['server.port'] || process.env.PORT || 8085);
        console.log(`[START] Port resolu : ${PORT}`);

        // Etape 2 : Initialisation de la Base de Données (PostgreSQL)
        console.log('[START] Etape 2 - Initialisation de la base de données...');
        const dbInstance = initDatabase(); 

        // !!! IMPORTANT !!! 
        // On charge le modèle explicitement ici pour que Sequelize le connaisse 
        // avant de lancer la synchronisation.
        require('./models/notification'); 

        try {
            // On force la création de la table
            await dbInstance.sync({ alter: true }); 
            console.log('✅ Base de données synchronisée (Table créée proprement).');

            // VERIFICATION REELLE DANS POSTGRES
            const [results] = await dbInstance.query(
                "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"
            );
            console.log('Tables réellement présentes dans Postgres :', results.map(r => r.tablename));
            
        } catch (error) {
            console.error('❌ Erreur de synchro DB :', error.message);
        }

        // Etape 3 : Enregistrement Eureka
        // console.log('[START] Etape 3 - Enregistrement sur njila-registry-service (8761)...');
        // registerToEureka(PORT);

        // Etape 4 : Serveur Express
        const app = express();
        app.use(express.json());
        app.use('/api/notifications', notificationRoutes);

        app.listen(PORT, async () => {
            console.log(`[START] njila-notification-service démarré sur le port ${PORT}`);
            console.log(`[START] Health : http://localhost:${PORT}/api/notifications/health`);

            // --- TEST AUTOMATIQUE AU DÉMARRAGE ---
           setTimeout(async () => {
    console.log('\n--- 🧪 DÉBUT DU TEST GLOBAL ---');
    const NotificationService = require('./services/NotificationService');

    // 1. Test de l'Email
    try {
        console.log('[TEST] Envoi Email...');
        await NotificationService.sendNotification({
            userId: "USER_001",
            type: "EMAIL",
            recipient: "maffo.ngaleu@gmail.com",
            subject: "Test Architecture NJILA",
            content: "L'héritage des stratégies fonctionne !"
        });
        console.log('✅ Email traité avec succès.');
    } catch (e) {
        console.error('❌ Échec du test Email :', e.message);
    }

    // 2. Test du Push
    try {
        console.log('\n[TEST] Envoi Push (Simulation)...');
        // Note: Le recipient doit être un JSON de souscription valide pour web-push
        // Ici on met un faux JSON pour tester si la stratégie PUSH est bien appelée
        const fakeSubscription = JSON.stringify({
            endpoint: "https://fcm.googleapis.com/fcm/send/fake-token",
            keys: { p256dh: "abc", auth: "123" }
        });

        await NotificationService.sendNotification({
            userId: "USER_001",
            type: "PUSH",
            recipient: fakeSubscription,
            subject: "Alerte NJILA",
            content: "Ceci est un test de notification Push."
        });
        console.log('✅ Push traité avec succès.');
    } catch (e) {
        // C'est normal si ça échoue ici (car le token est faux), 
        // mais on veut voir si le statut passe bien en "FAILED" en base de données !
        console.log('ℹ️ Le Push a échoué comme prévu (Token invalide), vérifions la DB.');
    }

    console.log('--- 🧪 FIN DU TEST GLOBAL ---\n');
}, 5000);// On laisse 5 secondes pour être large
        });

    } catch (err) {
        console.error('[START] Erreur critique au démarrage :', err.message);
        process.exit(1);
    }
}

bootstrap();