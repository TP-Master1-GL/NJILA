const { Sequelize } = require('sequelize');

let sequelize;

function initDatabase(config = {}) {
    sequelize = new Sequelize(
        config.dbName     || process.env.DB_NAME     || 'njila-notification-db',
        config.dbUser     || process.env.DB_USER     || 'njila',
        config.dbPassword || process.env.DB_PASSWORD || 'njila2026',
        {
            host:    config.dbHost || process.env.DB_HOST || 'localhost',
            port:    config.dbPort || process.env.DB_PORT || 5432,
            dialect: 'postgres',
            logging: false,
        }
    );
    return sequelize;
}

function getSequelize() {
    return sequelize;
}

module.exports = { initDatabase, getSequelize };
