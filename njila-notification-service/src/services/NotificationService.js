const  Notification  = require('../models/notification'); 
const EmailStrategy = require('../strategies/Email');
const PushStrategy = require('../strategies/Push'); 

class NotificationService {
    constructor() {
       
        this.strategies = {
            EMAIL: new EmailStrategy(),
            PUSH:  new PushStrategy()  
        };
    }

    async sendNotification(data) {
        //  Sauvegarde initiale 
        
        const notification = await Notification.create({
            userId: data.userId,
            type: data.type,
            recipient: data.recipient,
            sujet: data.subject || data.sujet, 
            content: data.content || data.contenu,
            status: 'PENDING'
        });

        try {
            //  Sélection de la stratégie (Pattern Strategy)
            const strategy = this.strategies[notification.type];
            
            if (!strategy) {
                throw new Error(`Le type de notification "${notification.type}" n'est pas supporté.`);
            }

            //  Envoi via la stratégie choisie (SMTP ou Web-Push)
            console.log(`[SERVICE] Tentative d'envoi via stratégie : ${notification.type}`);
            await strategy.send(notification);

            //  Succès : Mise à jour du statut
            await notification.update({
                status: 'SENT',
                sentAt: new Date()
            });
            console.log(` [SUCCESS] Notification ${notification.id_notification || notification.id} envoyée.`);

        } catch (error) {
            console.error(` [ERROR] ID: ${notification.id_notification || notification.id} - ${error.message}`);
            
            //  Échec : Planification de la prochaine tentative (+5 min)
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