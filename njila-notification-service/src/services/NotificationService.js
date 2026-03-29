const  Notification  = require('../models/notification'); // On récupère le modèle (ou l'objet si tu as groupé)
const EmailStrategy = require('../strategies/Email');
const PushStrategy = require('../strategies/Push'); // <-- Nouvelle stratégie

class NotificationService {
    constructor() {
        // On initialise uniquement les stratégies actives pour NJILA
        this.strategies = {
            EMAIL: new EmailStrategy(),
            PUSH:  new PushStrategy()  // <-- Ajouté ici
        };
    }

    async sendNotification(data) {
        // 1. Sauvegarde initiale (Statut PENDING par défaut)
        // Note : J'ai adapté les noms de champs à ton modèle Sequelize
        const notification = await Notification.create({
            userId: data.userId,
            type: data.type,
            recipient: data.recipient,
            sujet: data.subject || data.sujet, // Supporte les deux noms
            content: data.content || data.contenu,
            status: 'PENDING'
        });

        try {
            // 2. Sélection de la stratégie (Pattern Strategy)
            const strategy = this.strategies[notification.type];
            
            if (!strategy) {
                throw new Error(`Le type de notification "${notification.type}" n'est pas supporté.`);
            }

            // 3. Envoi via la stratégie choisie (SMTP ou Web-Push)
            console.log(`[SERVICE] Tentative d'envoi via stratégie : ${notification.type}`);
            await strategy.send(notification);

            // 4. Succès : Mise à jour du statut
            await notification.update({
                status: 'SENT',
                sentAt: new Date()
            });
            console.log(`✅ [SUCCESS] Notification ${notification.id_notification || notification.id} envoyée.`);

        } catch (error) {
            console.error(`❌ [ERROR] ID: ${notification.id_notification || notification.id} - ${error.message}`);
            
            // 5. Échec : Planification de la prochaine tentative (+5 min)
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