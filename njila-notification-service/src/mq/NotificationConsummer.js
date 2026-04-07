const amqp = require('amqplib');
const handlers = require('./NotificationHandler');

class NotificationConsumer {
    constructor() {
        this.rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
        this.exchange = 'njila.notification.exchange';
        
        // Ta liste complète de files d'attente selon la doc technique
        this.queuesConfig = [
            { name: 'njila.user.registered.queue', key: 'user.registered' },
            { name: 'njila.booking.created.queue', key: 'booking.created' },
            { name: 'njila.booking.confirmed.queue', key: 'booking.confirmed' },
            { name: 'njila.booking.cancelled.queue', key: 'booking.cancelled' },
            { name: 'njila.payment.success.notif.queue', key: 'payment.success' },
            { name: 'njila.payment.refunded.queue', key: 'payment.refunded' },
            { name: 'njila.fleet.trip.delayed.queue', key: 'fleet.trip.delayed' },
            { name: 'njila.notification.email.queue', key: 'notification.email' },
            { name: 'njila.notification.push.queue', key: 'notification.push' }
        ];
    }

    async start() {
        try {
            const connection = await amqp.connect(this.rabbitUrl);
            const channel = await connection.createChannel();

            // On utilise un exchange de type 'topic' pour la flexibilité des routing keys
            await channel.assertExchange(this.exchange, 'topic', { durable: true });

            console.log(`\nWORKER NJILA : SERVICE DE NOTIFICATION DÉMARRÉ`);
            console.log(` Exchange : ${this.exchange}`);
            console.log(`--------------------------------------------------`);

            // Configuration de chaque file d'attente
            for (const config of this.queuesConfig) {
                // Créer la queue
                await channel.assertQueue(config.name, { durable: true });
                
                // Lier la queue à l'exchange avec sa clé de routage
                await channel.bindQueue(config.name, this.exchange, config.key);

                console.log(` File prête : ${config.name} (Clé: ${config.key})`);

                // Consommer les messages
                channel.consume(config.name, async (msg) => {
                    if (msg !== null) {
                        const routingKey = msg.fields.routingKey;
                        const payload = JSON.parse(msg.content.toString());

                        console.log(`\n MESSAGE REÇU [${routingKey}]`);

                        try {
                            // Dispatching vers les handlers spécifiques
                            switch (routingKey) {
                                case 'user.registered':
                                    await handlers.handleWelcome(payload);
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
                                // Cas génériques pour les files email/push si nécessaire
                                case 'notification.email':
                                case 'notification.push':
                                    console.log(`[MQ] Traitement direct de notification brute`);
                                    break;
                                default:
                                    console.log(` Aucune action définie pour la clé : ${routingKey}`);
                            }

                            channel.ack(msg); // Confirmer la lecture
                        } catch (err) {
                            console.error(` Erreur sur ${routingKey}: ${err.message}`);
                            // En cas d'erreur, on ne re-queue pas (false) pour éviter les boucles infinies
                            channel.nack(msg, false, false); 
                        }
                    }
                });
            }
            console.log(`--------------------------------------------------\n[*] En attente de messages...`);

        } catch (error) {
            console.error(" Connexion RabbitMQ échouée", error);
            setTimeout(() => this.start(), 5000); // Reconnexion automatique
        }
    }
}

module.exports = new NotificationConsumer();