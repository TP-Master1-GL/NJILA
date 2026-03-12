const { Eureka } = require('eureka-js-client');
const os         = require('os');

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

function registerToEureka(port) {
    const host       = getLocalIp();
    const eurekaHost = process.env.EUREKA_HOST || 'localhost';
    const eurekaPort = parseInt(process.env.EUREKA_PORT || '8761');
    const appName    = 'NJILA-NOTIFICATION-SERVICE';

    process.stderr.write(`[EUREKA] Enregistrement : ${appName} @ ${host}:${port}\n`);

    const client = new Eureka({
        instance: {
            app:        appName,
            instanceId: `${host}:${appName.toLowerCase()}:${port}`,  // ✅ format correct
            hostName:   host,
            ipAddr:     host,
            port:       { '$': port, '@enabled': true },
            vipAddress: appName.toLowerCase(),
            healthCheckUrl:  `http://${host}:${port}/api/notifications/health`,
            statusPageUrl:   `http://${host}:${port}/api/notifications/health`,
            homePageUrl:     `http://${host}:${port}/`,
            dataCenterInfo: {
                '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
                name:     'MyOwn',
            },
        },
        eureka: {
            host:              eurekaHost,
            port:              eurekaPort,
            servicePath:       '/eureka/apps/',
            maxRetries:        5,
            requestRetryDelay: 2000,
        },
    });

    client.start(error => {
        if (error) {
            process.stderr.write(`[EUREKA] WARN - Enregistrement echoue : ${error}\n`);
        } else {
            process.stderr.write('[EUREKA] OK - njila-notification-service enregistre\n');
        }
    });

    return client;
}

module.exports = { registerToEureka };
