const amqp = require('amqplib');
const handlers = require('./NotificationHandler');

class NotificationConsumer {
    constructor() {
        this.rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
        this.exchange = 'njila.notification.exchange';

        this.queuesConfig = [
            // ── AUTH SERVICE ───────────────────────────────────────────────
            {
                name: 'njila.notification.welcome.queue',
                key: 'auth.user.welcome',
                deadLetterExchange: 'njila.dead.letter.exchange',
                deadLetterRoutingKey: 'dead.letter',
                messageTtl: 86400000
            },
            {
                name: 'njila.notification.password.reset.queue',
                key: 'auth.password.reset',
                deadLetterExchange: 'njila.dead.letter.exchange',
                deadLetterRoutingKey: 'dead.letter',
                messageTtl: 86400000
            },

            // ── USER SERVICE ───────────────────────────────────────────────
            // staff.created — déjà lié dans RabbitMQConfig Java via njila.notification.exchange
            {
                name: 'njila.notification.staff.created.queue',
                key: 'staff.created',
                deadLetterExchange: 'njila.dead.letter.exchange',
                deadLetterRoutingKey: 'dead.letter',
                messageTtl: 86400000
            },
            // staff.deleted
            {
                name: 'njila.notification.staff.deleted.queue',
                key: 'staff.deleted',
                deadLetterExchange: 'njila.dead.letter.exchange',
                deadLetterRoutingKey: 'dead.letter',
                messageTtl: 86400000
            },
            // profile.updated — nouveau
            {
                name: 'njila.notification.profile.updated.queue',
                key: 'profile.updated',
                deadLetterExchange: 'njila.dead.letter.exchange',
                deadLetterRoutingKey: 'dead.letter',
                messageTtl: 86400000
            },

            // ── BOOKING SERVICE ────────────────────────────────────────────
            { name: 'njila.booking.created.queue',   key: 'booking.created' },
            { name: 'njila.booking.confirmed.queue', key: 'booking.confirmed' },
            { name: 'njila.booking.cancelled.queue', key: 'booking.cancelled' },

            // ── PAYMENT SERVICE ────────────────────────────────────────────
            { name: 'njila.payment.success.notif.queue', key: 'payment.success' },
            { name: 'njila.payment.refunded.queue',      key: 'payment.refunded' },

            // ── FLEET SERVICE ──────────────────────────────────────────────
            { name: 'njila.fleet.trip.delayed.queue', key: 'fleet.trip.delayed' },

            // ── GENERIC ────────────────────────────────────────────────────
            { name: 'njila.notification.email.queue', key: 'notification.email' },
            { name: 'njila.notification.push.queue',  key: 'notification.push' }
        ];
    }

    async start() {
        try {
            const connection = await amqp.connect(this.rabbitUrl);
            const channel    = await connection.createChannel();

            await channel.assertExchange('njila.dead.letter.exchange', 'direct', { durable: true });
            await channel.assertExchange(this.exchange, 'topic', { durable: true });

            // Déclarer aussi njila.user.exchange pour recevoir les événements user
            await channel.assertExchange('njila.user.exchange', 'topic', { durable: true });

            console.log(`\n=================================================`);
            console.log(` WORKER NJILA : SERVICE DE NOTIFICATION PRÊT`);
            console.log(` Exchange principal : ${this.exchange}`);
            console.log(`=================================================`);

            for (const config of this.queuesConfig) {
                const queueArgs = {};

                if (config.deadLetterExchange) {
                    queueArgs['x-dead-letter-exchange']    = config.deadLetterExchange;
                    queueArgs['x-dead-letter-routing-key'] = config.deadLetterRoutingKey || 'dead.letter';
                }
                if (config.messageTtl) {
                    queueArgs['x-message-ttl'] = config.messageTtl;
                }

                await channel.assertQueue(config.name, {
                    durable:   true,
                    arguments: Object.keys(queueArgs).length > 0 ? queueArgs : undefined
                });

                // Les événements user sont publiés sur njila.notification.exchange
                // (voir NotificationEventPublisher.java) — on bind sur le même exchange
                await channel.bindQueue(config.name, this.exchange, config.key);

                console.log(` File liée : ${config.name} ↔ Clé: ${config.key}`);

                channel.consume(config.name, async (msg) => {
                    if (msg === null) return;

                    const routingKey = msg.fields.routingKey;
                    let payload;

                    try {
                        payload = JSON.parse(msg.content.toString());
                        console.log(`\n [MQ] MESSAGE REÇU [${routingKey}]`);

                        switch (routingKey) {

                            // ── AUTH ───────────────────────────────────────
                            case 'auth.user.welcome':
                                await handlers.handleWelcome(payload);
                                break;
                            case 'auth.password.reset':
                                await handlers.handlePasswordReset(payload);
                                break;

                            // ── USER ───────────────────────────────────────
                            case 'staff.created':
                                await handlers.handleStaffCreated(payload);
                                break;
                            case 'staff.deleted':
                                await handlers.handleStaffDeleted(payload);
                                break;
                            case 'profile.updated':
                                await handlers.handleProfileUpdated(payload);
                                break;

                            // ── BOOKING ────────────────────────────────────
                            case 'booking.created':
                                await handlers.handleBookingCreated(payload);
                                break;
                            case 'booking.confirmed':
                                await handlers.handleBookingConfirmed(payload);
                                break;
                            case 'booking.cancelled':
                                await handlers.handleBookingCancelled(payload);
                                break;

                            // ── PAYMENT ────────────────────────────────────
                            case 'payment.success':
                                await handlers.handlePaymentSuccess(payload);
                                break;
                            case 'payment.refunded':
                                await handlers.handlePaymentRefunded(payload);
                                break;

                            // ── FLEET ──────────────────────────────────────
                            case 'fleet.trip.delayed':
                                await handlers.handleTripDelay(payload);
                                break;

                            default:
                                console.log(` Aucune action définie pour la clé : ${routingKey}`);
                        }

                        channel.ack(msg);

                    } catch (err) {
                        console.error(`Erreur de traitement (${routingKey}):`, err.message);
                        channel.nack(msg, false, false);
                    }
               });
            }

            console.log(`\n[*] En attente d'événements...`);

        } catch (error) {
            console.error(' Erreur critique RabbitMQ :', error.message);
            console.log(' Tentative de reconnexion dans 5 secondes...');
            setTimeout(() => this.start(), 5000);
        }
    }
}

module.exports = new NotificationConsumer();
