const amqp = require('amqplib');
const NotificationService = require('../services/NotificationService');

class NotificationConsumer {
    constructor() {
        this.rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
        this.exchange = 'njila.notification.exchange'; // Défini dans la doc 
        
        // Les routing keys que nous devons intercepter
        this.routingKeys = [
            'auth.user.welcome',
            'auth.password.reset',
            'user.profile.updated',
            'avis.submitted'
        ];
    }

    async start() {
        try {
            const connection = await amqp.connect(this.rabbitUrl);
            const channel = await connection.createChannel();

            // Déclaration de l'exchange (Topic comme spécifié) [cite: 33, 36]
            await channel.assertExchange(this.exchange, 'topic', { durable: true });

            // Création d'une queue unique pour ce service
            const queueName = 'njila.notification.main.queue';
            await channel.assertQueue(queueName, { durable: true });

            console.log(`[*] Connexion RabbitMQ NJILA établie.`);

            // On lie la queue à chaque routing key
            for (const key of this.routingKeys) {
                await channel.bindQueue(queueName, this.exchange, key);
                console.log(`   -> Lié à la clé : ${key}`);
            }

            channel.consume(queueName, async (msg) => {
                if (msg !== null) {
                    const routingKey = msg.fields.routingKey;
                    const payload = JSON.parse(msg.content.toString());
                    
                    console.log(`[MQ] Nouveau message [${routingKey}]`);

                    // On adapte le payload pour notre NotificationService
                    const notificationData = {
                        userId: payload.userId || 'SYSTEM',
                        type: payload.type === 'sms' ? 'SMS' : 'EMAIL', // La doc mentionne surtout des emails
                        recipient: payload.email,
                        subject: this.getSubjectByKey(routingKey, payload),
                        content: payload.message || payload.resetLink || `Notification NJILA: ${routingKey}`
                    };

                    try {
                        await NotificationService.sendNotification(notificationData);
                        channel.ack(msg);
                    } catch (error) {
                        console.error(`[MQ] Erreur de traitement :`, error.message);
                        channel.nack(msg, false, false); 
                    }
                }
            });
        } catch (error) {
            console.error("[MQ] Erreur RabbitMQ :", error.message);
            setTimeout(() => this.start(), 5000);
        }
    }

    // Utilitaire pour générer un sujet en fonction de la provenance [cite: 38, 42]
    getSubjectByKey(key, payload) {
        const subjects = {
            'auth.user.welcome': `Bienvenue chez NJILA, ${payload.name} !`,
            'auth.password.reset': "Réinitialisation de votre mot de passe",
            'user.profile.updated': "Votre profil a été mis à jour",
            'avis.submitted': `Nouvel avis sur l'agence ${payload.agenceNom}`
        };
        return subjects[key] || "Notification NJILA";
    }
}

module.exports = new NotificationConsumer();