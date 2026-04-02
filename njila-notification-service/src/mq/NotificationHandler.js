const NotificationService = require('../services/NotificationService');

class NotificationHandlers {
    
    // Traitement de : auth.user.welcome 
    async handleWelcome(payload) {
        const { email, name, surname } = payload;
        
        console.log(`[HANDLER] Préparation Email de Bienvenue pour : ${email}`);
        
        const subject = " Bienvenue chez NJILA – Vos voyages commencent ici !";
        const content = `
            Bonjour ${name} ${surname},
            
            Nous sommes ravis de vous compter parmi la communauté NJILA. 
            Votre compte a été créé avec succès et vous pouvez désormais réserver 
            vos trajets interurbains en toute simplicité.
            
            Ce que vous pouvez faire dès maintenant :
            - Consulter les horaires des agences partenaires.
            - Réserver vos billets en quelques clics.
            
            Merci de nous faire confiance.
            L'équipe NJILA — Bon voyage !
        `;

        return await NotificationService.sendNotification({
            userId: payload.userId || 'SYSTEM',
            type: 'EMAIL',
            recipient: email,
            subject: subject,
            content: content
        });
    }

    // Traitement de : auth.password.reset 
    async handlePasswordReset(payload) {
        const { email, name, resetLink } = payload;

        console.log(`[HANDLER] Préparation Reset Password pour : ${email}`);

        const subject = " Réinitialisation de votre mot de passe NJILA";
        const content = `
            Bonjour ${name},
            
            Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte NJILA.
            
            Pour choisir un nouveau mot de passe, veuillez cliquer sur le lien ci-dessous :
            ${resetLink}
            
            Note : Ce lien expirera dans 15 minutes. Si vous n'êtes pas à l'origine 
            de cette demande, ignorez cet e-mail.
            
            L'équipe technique NJILA.
        `;

        return await NotificationService.sendNotification({
            userId: payload.userId || 'SYSTEM',
            type: 'EMAIL',
            recipient: email,
            subject: subject,
            content: content
        });
    }

    // Traitement de : avis.submitted 
    async handleAvisSubmitted(payload) {
        const { agenceNom, note, commentaire } = payload;
        
        console.log(`[HANDLER] Notification Avis pour l'agence : ${agenceNom}`);

        return await NotificationService.sendNotification({
            userId: 'ADMIN', 
            type: 'PUSH',
            recipient: payload.managerToken, // Token push du manager
            subject: " Nouvel avis client !",
            content: `L'agence ${agenceNom} a reçu une note de ${note}/5 : "${commentaire}"`
        });
    }

    async handleBookingConfirmed(payload) {
        return await NotificationService.sendNotification({
            userId: payload.userId,
            type: 'EMAIL',
            recipient: payload.email,
            subject: ` Confirmation de réservation - Trajet ${payload.depart} -> ${payload.destination}`,
            content: `Votre siège est réservé pour le ${payload.dateVoyage} à ${payload.heure}. Merci d'avoir choisi NJILA.`
        });
    }

    async handleTicketReady(payload) {
        
        return await NotificationService.sendNotification({
            userId: payload.userId,
            type: 'PUSH',
            recipient: payload.pushToken,
            subject: " Votre billet est disponible !",
            content: `Le ticket pour votre voyage vers ${payload.destination} est prêt. Présentez l'identifiant unique pour votre voyage.`
        });
    }

    // --- 4. PAYMENT SERVICE ---
    async handlePaymentSuccess(payload) {
        return await NotificationService.sendNotification({
            userId: payload.userId,
            type: 'EMAIL',
            recipient: payload.email,
            subject: ` Reçu de paiement NJILA - ${payload.montant} FCFA`,
            content: `Paiement réussi via ${payload.method} (ID: ${payload.transactionId}). Votre réservation est validée.`
        });
    }

    async handleTripReminder(payload) {
        return await NotificationService.sendNotification({
            userId: payload.userId,
            type: 'PUSH',
            recipient: payload.pushToken,
            subject: " Départ imminent !",
            content: `Rappel : Votre bus pour ${payload.destination} (Voyage #${payload.tripId}) part dans 30 minutes. Veuillez vous présenter au quai d'embarquement.`
        });
    }

    
    async handleTripDelay(payload) {
        return await NotificationService.sendNotification({
            userId: payload.userId,
            type: 'PUSH',
            recipient: payload.pushToken,
            subject: "Information sur votre voyage",
            content: `Le départ de votre bus vers ${payload.destination} est retardé de ${payload.delayMinutes} min suite à ${payload.reason}. Nous nous excusons pour le désagrément.`
        });
    }
}

module.exports = new NotificationHandlers();