const { Sequelize } = require('sequelize');

async function createDatabaseIfNotExists() {
    const dbName     = process.env.DB_NAME     || 'njila_notification_db';
    const dbUser     = process.env.DB_USER     || 'njila';
    const dbPassword = process.env.DB_PASSWORD || 'njila2026';
    const dbHost     = process.env.DB_HOST     || 'njila-notification-db';
    const dbPort     = process.env.DB_PORT     || 5432;

    console.log(`[DB] Vérification base "${dbName}" sur ${dbHost}:${dbPort}`);

    // Connexion à "postgres" (DB système par défaut, toujours présente)
    const adminSequelize = new Sequelize('postgres', dbUser, dbPassword, {
        host:    dbHost,
        port:    dbPort,
        dialect: 'postgres',
        logging: false,
    });

    try {
        await adminSequelize.authenticate();
        console.log('[DB] Connexion admin PostgreSQL OK');

        const [results] = await adminSequelize.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            { bind: [dbName], type: Sequelize.QueryTypes.SELECT }
        );

        if (!results) {
            console.log(`[DB] Base "${dbName}" introuvable → création...`);
            // Pas de bind possible sur CREATE DATABASE, on sanitize manuellement
            await adminSequelize.query(
                `CREATE DATABASE "${dbName.replace(/"/g, '')}"`
            );
            console.log(`✅ [DB] Base "${dbName}" créée avec succès`);
        } else {
            console.log(`✅ [DB] Base "${dbName}" déjà existante`);
        }

    } catch (err) {
        // Si la DB existe déjà (erreur 42P04), on continue sans planter
        if (err.original && err.original.code === '42P04') {
            console.log(`✅ [DB] Base "${dbName}" déjà existante (42P04)`);
        } else {
            console.error('❌ [DB] Erreur init base:', err.message);
            throw err;
        }
    } finally {
        await adminSequelize.close();
    }
}

module.exports = { createDatabaseIfNotExists };
