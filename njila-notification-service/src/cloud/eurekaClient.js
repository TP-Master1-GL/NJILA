const { Eureka } = require('eureka-js-client');
const os = require('os');

/**
 * Récupère une IP locale (fallback)
 */
function getLocalIp() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }

    return '127.0.0.1';
}

/**
 * Enregistrement Eureka
 */
function registerToEureka(port) {

    // 🔥 Priorité Docker / Env > hostname > IP locale
    const host =
        process.env.INSTANCE_HOST ||
        process.env.HOSTNAME ||
        getLocalIp();

    // 🔥 Host accessible publiquement (important en microservices)
    const publicHost = process.env.PUBLIC_HOST || host;

    const eurekaHost = process.env.EUREKA_HOST || 'njila-registry-service';
    const eurekaPort = parseInt(process.env.EUREKA_PORT || '8761');

    const appName = 'NJILA-NOTIFICATION-SERVICE';

    // 🔥 Instance ID unique (évite conflits en scaling)
    const instanceId = `${host}:${appName.toLowerCase()}:${port}:${Date.now()}`;

    console.log(`[EUREKA] Configuration pour ${appName}`);
    console.log(`[EUREKA] Host: ${host}:${port}`);
    console.log(`[EUREKA] Public Host: ${publicHost}:${port}`);
    console.log(`[EUREKA] Registry: ${eurekaHost}:${eurekaPort}`);
    console.log(`[EUREKA] Instance ID: ${instanceId}`);

    const client = new Eureka({
        instance: {
            app: appName,
            instanceId: instanceId,

            hostName: host,
            ipAddr: host,

            port: {
                '$': port,
                '@enabled': true
            },

            // 🔥 Important pour discovery
            vipAddress: appName,
            secureVipAddress: appName,

            status: 'UP',

            // 🔥 URLs accessibles
            statusPageUrl: `http://${publicHost}:${port}/api/notifications/health`,
            healthCheckUrl: `http://${publicHost}:${port}/api/notifications/health`,
            homePageUrl: `http://${publicHost}:${port}/`,

            dataCenterInfo: {
                '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
                name: 'MyOwn',
            },

            metadata: {
                'startup-time': new Date().toISOString(),
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'dev'
            }
        },

        eureka: {
            host: eurekaHost,
            port: eurekaPort,
            servicePath: '/eureka/apps/',

            maxRetries: 10,
            requestRetryDelay: 3000,

            heartbeatInterval: 30000,
            registryFetchInterval: 30000,
        }
    });

    // ========================
    // 🎯 EVENTS
    // ========================

    client.on('started', () => {
        console.log('[EUREKA] ✅ Client démarré');
    });

    client.on('deregistered', () => {
        console.log('[EUREKA] ⚠️ Instance désenregistrée');
    });

    // 🔇 éviter spam en prod
    if (process.env.NODE_ENV !== 'production') {
        client.on('heartbeat', () => {
            console.log('[EUREKA] ❤️ Heartbeat');
        });
    }

    client.on('registryUpdated', () => {
        console.log('[EUREKA] 📋 Registre mis à jour');
    });

    client.on('error', (err) => {
        console.error('[EUREKA] ❌ Erreur:', err.message);
    });

    // ========================
    // 🔁 START avec retry manuel
    // ========================

    const startClient = () => {
        client.start((error) => {
            if (error) {
                console.error('[EUREKA] ❌ Échec enregistrement:', error.message);
                console.log('[EUREKA] 🔄 Retry dans 5s...');
                setTimeout(startClient, 5000);
            } else {
                console.log('[EUREKA] ✅ Enregistré avec succès');
                console.log(`[EUREKA] 📍 Instance active: ${instanceId}`);
            }
        });
    };

    startClient();

    return client;
}

module.exports = { registerToEureka };
