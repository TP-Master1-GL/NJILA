const Notification = require('../models/notification'); 
const EmailStrategy = require('../strategies/Email');
const PushStrategy = require('../strategies/Push'); 
const MailDecorator = require('../utils/MailDecorator'); // Import du décorateur

class NotificationService {
    constructor() {
        this.strategies = {
            EMAIL: new EmailStrategy(),
            PUSH:  new PushStrategy()  
        };
    }

    async sendNotification(data) {
        // 1. Récupération et décoration du contenu
        const rawContent = data.content || data.contenu;
        let finalContent = rawContent;

        // On applique le design NJILA systématiquement pour les emails
        if (data.type === 'EMAIL') {
            console.log(`[SERVICE] Décoration de l'email avec le template NJILA`);
            finalContent = MailDecorator.decorate(rawContent);
        }

        // 2. Sauvegarde initiale en base de données
        const notification = await Notification.create({
            userId: data.userId || 'SYSTEM',
            type: data.type,
            recipient: data.recipient,
            sujet: data.subject || data.sujet, 
            content: finalContent, // On stocke le HTML pour l'historique
            status: 'PENDING'
        });

        try {
            // 3. Sélection de la stratégie
            const strategy = this.strategies[notification.type];
            
            if (!strategy) {
                throw new Error(`Le type de notification "${notification.type}" n'est pas supporté.`);
            }

            // 4. Envoi via la stratégie choisie
            console.log(`[SERVICE] Tentative d'envoi via stratégie : ${notification.type}`);
            
            // On passe l'objet notification (qui contient le content décoré)
            await strategy.send(notification);

            // 5. Mise à jour en cas de succès
            await notification.update({
                status: 'SENT',
                sentAt: new Date()
            });
            console.log(` [SUCCESS] Notification ${notification.id} envoyée.`);

        } catch (error) {
            console.error(` [ERROR] ID: ${notification.id} - ${error.message}`);
            
            // 6. Gestion de l'échec et planification (Retry)
            const retryDate = new Date();
            retryDate.setMinutes(retryDate.getMinutes() + 5);

            await notification.update({
                status: 'FAILED',
                errorMessage: error.message,
                prochaineTentative: retryDate
            });
        }
    }
}

module.exports = new NotificationService();