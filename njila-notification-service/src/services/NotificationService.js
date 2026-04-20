const Notification = require('../models/notification'); 
const EmailStrategy = require('../strategies/Email');
const PushStrategy = require('../strategies/Push'); 
const MailDecorator = require('../utils/MailDecorator');

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
        // Note: 'attachment' n'est pas dans le modèle DB, Sequelize va donc l'ignorer ici.
        const notification = await Notification.create({
            userId: data.userId || 'SYSTEM',
            type: data.type,
            recipient: data.recipient,
            sujet: data.subject || data.sujet, 
            content: finalContent, // Stockage du HTML décoré
            status: 'PENDING'
        });

        try {
            // 3. Sélection de la stratégie
            const strategy = this.strategies[notification.type];
            
            if (!strategy) {
                throw new Error(`Le type de notification "${notification.type}" n'est pas supporté.`);
            }

            // --- 4. RÉCUPÉRATION DE L'ATTACHEMENT (LE TICKET PDF) ---
            // On re-fixe l'objet attachment (Buffer binaire) à l'instance notification 
            // car cet objet est nécessaire pour Email.js mais n'existe pas en DB.
            if (data.attachment) {
                notification.attachment = data.attachment;
                console.log(`[SERVICE] Pièce jointe détectée pour l'envoi : ${data.attachment.filename}`);
            }

            // 5. Envoi via la stratégie choisie
            console.log(`[SERVICE] Tentative d'envoi via stratégie : ${notification.type}`);
            await strategy.send(notification);

            // 6. Mise à jour en cas de succès
            await notification.update({
                status: 'SENT',
                sentAt: new Date()
            });
            console.log(`[SUCCESS] Notification ${notification.id} envoyée avec succès.`);

        } catch (error) {
            console.error(`[ERROR] ID: ${notification.id} - ${error.message}`);
            
            // 7. Gestion de l'échec et planification (Retry dans 5 min)
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