const amqp = require('amqplib');
const handlers = require('./NotificationHandler');

class NotificationConsumer {
    constructor() {
        this.rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
        this.exchange = 'njila.notification.exchange';
        
        // Configuration synchronisée avec le EventPublisher Python de NJILA
        this.queuesConfig = [
            // --- AUTH SERVICE (Python) ---
            { name: 'njila.user.registered.queue', key: 'auth.user.welcome' }, 
            { name: 'njila.auth.password.reset.queue', key: 'auth.password.reset' },
            
            // --- BOOKING SERVICE ---
            { name: 'njila.booking.created.queue', key: 'booking.created' },
            { name: 'njila.booking.confirmed.queue', key: 'booking.confirmed' },
            { name: 'njila.booking.cancelled.queue', key: 'booking.cancelled' },
            
            // --- PAYMENT SERVICE ---
            { name: 'njila.payment.success.notif.queue', key: 'payment.success' },
            { name: 'njila.payment.refunded.queue', key: 'payment.refunded' },
            
            // --- FLEET/TRIP SERVICE ---
            { name: 'njila.fleet.trip.delayed.queue', key: 'fleet.trip.delayed' },
            
            // --- GENERIC/DIRECT NOTIFICATIONS ---
            { name: 'njila.notification.email.queue', key: 'notification.email' },
            { name: 'njila.notification.push.queue', key: 'notification.push' }
        ];
    }

    async start() {
        try {
            const connection = await amqp.connect(this.rabbitUrl);
            const channel = await connection.createChannel();

            // Utilisation d'un exchange de type 'topic' (indispensable pour NJILA)
            await channel.assertExchange(this.exchange, 'topic', { durable: true });

            console.log(`\n=================================================`);
            console.log(`🚀 WORKER NJILA : SERVICE DE NOTIFICATION PRÊT`);
            console.log(`📡 Exchange : ${this.exchange}`);
            console.log(`=================================================`);

            for (const config of this.queuesConfig) {
                // 1. Déclarer la file
                await channel.assertQueue(config.name, { durable: true });
                
                // 2. Lier la file à l'exchange avec sa clé spécifique
                await channel.bindQueue(config.name, this.exchange, config.key);

                console.log(`✅ File liée : ${config.name} ↔ Clé: ${config.key}`);

                // 3. Consommation des messages
                channel.consume(config.name, async (msg) => {
                    if (msg !== null) {
                        const routingKey = msg.fields.routingKey;
                        let payload;
                        
                        try {
                            payload = JSON.parse(msg.content.toString());
                            console.log(`\n📥 [MQ] MESSAGE REÇU [${routingKey}]`);

                            // Dispatching vers les handlers selon la Routing Key
                            switch (routingKey) {
                                case 'auth.user.welcome':
                                    await handlers.handleWelcome(payload);
                                    break;
                                case 'auth.password.reset':
                                    await handlers.handlePasswordReset(payload);
                                    break;
                                case 'booking.created':
                                    await handlers.handleBookingCreated(payload);
                                    break;
                                case 'booking.confirmed':
                                    await handlers.handleBookingConfirmed(payload);
                                    break;
                                case 'booking.cancelled':
                                    await handlers.handleBookingCancelled(payload);
                                    break;
                                case 'payment.success':
                                    await handlers.handlePaymentSuccess(payload);
                                    break;
                                case 'payment.refunded':
                                    await handlers.handlePaymentRefunded(payload);
                                    break;
                                case 'fleet.trip.delayed':
                                    await handlers.handleTripDelay(payload);
                                    break;
                                default:
                                    console.log(`⚠️ Aucune action définie pour la clé : ${routingKey}`);
                            }

                            channel.ack(msg); // Accusé de réception (message supprimé de la file)

                        } catch (err) {
                            console.error(`❌ Erreur de traitement (${routingKey}):`, err.message);
                            // En cas d'erreur fatale, on ne remet pas dans la file (false, false)
                            channel.nack(msg, false, false); 
                        }
                    }
                });
            }
            console.log(`\n[*] En attente d'événements...`);

        } catch (error) {
            console.error("❌ Erreur critique RabbitMQ :", error.message);
            console.log("🔄 Tentative de reconnexion dans 5 secondes...");
            setTimeout(() => this.start(), 5000);
        }
    }
}

module.exports = new NotificationConsumer();