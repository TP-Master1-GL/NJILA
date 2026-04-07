const webpush = require('web-push');
const NotificationStrategy = require('./NotificationStrategy');

class PushStrategy extends NotificationStrategy {
    constructor() {

        super();
        const publicVapidKey = process.env.PUBLIC_VAPID_KEY ;
        const privateVapidKey = process.env.PRIVATE_VAPID_KEY ;

        webpush.setVapidDetails(
            'mailto:maffo.ngaleu@gmail.com',
            publicVapidKey,
            privateVapidKey
        );
    }

    /**
     * Méthode send appelée par le NotificationService
     * @param {Object} notification - L'instance Sequelize de la notification
     */
    async send(notification) {
        console.log(`[STRATEGY-PUSH] Préparation de l'envoi pour : ${notification.recipient}`);

        try {
            // Le "recipient" pour un Push est un objet JSON contenant l'endpoint et les clés
            const subscription = JSON.parse(notification.recipient);

            const payload = JSON.stringify({
                title: notification.sujet || 'NJILA Notification',
                body: notification.contenu,
                icon: '/assets/icon.png' // Optionnel
            });

            // Envoi réel via le protocole Web-Push
            await webpush.sendNotification(subscription, payload);
            
            console.log('[STRATEGY-PUSH] Notification envoyée avec succès.');
            return { success: true };

        } catch (error) {
            console.error(' [STRATEGY-PUSH] Erreur lors de l\'envoi :', error.message);
            
            // Si l'abonnement est expiré ou invalide (404 ou 410)
            if (error.statusCode === 410 || error.statusCode === 404) {
                console.warn('[STRATEGY-PUSH] L\'abonnement n\'est plus valide.');
            }
            
            throw error; 
        }
    }
}

module.exports = PushStrategy;