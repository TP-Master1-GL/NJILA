const amqp = require('amqplib');
const handlers = require('./NotificationHandler');

class NotificationConsumer {
    constructor() {
        this.rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
        this.exchange = 'njila.notification.exchange';
        this.queueName = 'njila.notification.main.queue';
    }

    async start() {
        try {
            const connection = await amqp.connect(this.rabbitUrl);
            const channel = await connection.createChannel();

            await channel.assertExchange(this.exchange, 'topic', { durable: true });
            await channel.assertQueue(this.queueName, { durable: true }); 

            // On s'abonne aux clés définies dans la doc 
            const keys = ['auth.user.welcome', 'auth.password.reset', 'user.profile.updated', 'avis.submitted'];
            
            for (const key of keys) {
                await channel.bindQueue(this.queueName, this.exchange, key);
            }

            console.log(`[*] Worker NJILA prêt. Écoute sur ${this.exchange}`);

            channel.consume(this.queueName, async (msg) => {
                if (msg !== null) {
                    const routingKey = msg.fields.routingKey;
                    const payload = JSON.parse(msg.content.toString());

                    try {
                        // Dispatching vers le  handler
                        if (routingKey === 'auth.user.welcome') await handlers.handleWelcome(payload);
                        if (routingKey === 'auth.password.reset') await handlers.handlePasswordReset(payload);
                        if (routingKey === 'avis.submitted') await handlers.handleAvisSubmitted(payload);
                        if (routingKey === 'booking.confirmed') await handlers.handleBookingConfirmed(payload);
                        if (routingKey === 'booking.ticket.ready') await handlers.handleTicketReady(payload);
                        if (routingKey === 'payment.success') await handlers.handlePaymentSuccess(payload);
                        if (routingKey === 'trip.departure.reminder') {
                            await handlers.handleTripReminder(payload);
                        }
                        if (routingKey === 'trip.delay.alert') {
                            await handlers.handleTripDelay(payload);
                        }
                        channel.ack(msg);
                    } catch (err) {
                        console.error(`[MQ] Erreur : ${err.message}`);
                        channel.nack(msg, false, false); 
                    }
                }
            });
        } catch (error) {
            console.error("[MQ] Connexion échouée", error);
            setTimeout(() => this.start(), 5000);
        }
    }
}

module.exports = new NotificationConsumer();