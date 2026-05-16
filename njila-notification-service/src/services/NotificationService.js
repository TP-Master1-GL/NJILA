const { getNotificationModel } = require('../models/notification');
const EmailStrategy = require('../strategies/Email');
const PushStrategy  = require('../strategies/Push');
const MailDecorator = require('../utils/MailDecorator');

class NotificationService {
    constructor() {
        this.strategies = {
            EMAIL: new EmailStrategy(),
            PUSH:  new PushStrategy()
        };
    }

    async sendNotification(data) {
        const Notification = getNotificationModel();

        // 1. Décoration du contenu email
        const rawContent = data.content || data.contenu;
        let finalContent = rawContent;

        if (data.type === 'EMAIL') {
            console.log(`[SERVICE] Décoration de l'email avec le template NJILA`);
            finalContent = MailDecorator.decorate(rawContent);
        }

        // 2. Sauvegarde initiale en base de données
        const notification = await Notification.create({
            userId:    data.userId || 'SYSTEM',
            type:      data.type,
            recipient: data.recipient,
            content:   finalContent,
            status:    'PENDING'
        });

        try {
            // 3. Sélection de la stratégie
            const strategy = this.strategies[notification.type];
            if (!strategy) {
                throw new Error(`Le type de notification "${notification.type}" n'est pas supporté.`);
            }

            // 4. Rattachement de la pièce jointe (non persistée en DB)
            if (data.attachment) {
                notification.attachment = data.attachment;
                console.log(`[SERVICE] Pièce jointe détectée : ${data.attachment.filename}`);
            }

            // 5. Envoi via la stratégie
            console.log(`[SERVICE] Tentative d'envoi via stratégie : ${notification.type}`);
            await strategy.send(notification);

            // 6. Mise à jour succès
            await notification.update({ status: 'SENT' });
            console.log(`[SUCCESS] Notification ${notification.id} envoyée avec succès.`);

        } catch (error) {
            console.error(`[ERROR] ID: ${notification.id} - ${error.message}`);

            // 7. Mise à jour échec
            await notification.update({ status: 'FAILED' });
        }
    }
}

module.exports = new NotificationService();
