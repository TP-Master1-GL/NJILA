const NotificationService = require('../services/NotificationService');

class NotificationHandlers {

    // ── AUTH SERVICE ────────────────────────────────────────────────────────

    async handleWelcome(payload) {
        const { email, name, surname } = payload;
        console.log(`[HANDLER] Email de Bienvenue → ${email}`);

        return await NotificationService.sendNotification({
            userId:    payload.userId || 'SYSTEM',
            type:      'EMAIL',
            recipient: email,
            subject:   ' Bienvenue chez NJILA – Vos voyages commencent ici !',
            content:   `
                Bonjour ${name} ${surname},

                Nous sommes ravis de vous compter parmi la communauté NJILA.
                Votre compte a été créé avec succès et vous pouvez désormais réserver
                vos trajets interurbains en toute simplicité.

                Ce que vous pouvez faire dès maintenant :
                - Consulter les horaires des agences partenaires.
                - Réserver vos billets en quelques clics.

                Merci de nous faire confiance.
                L'équipe NJILA — Bon voyage !
            `
        });
    }

    async handlePasswordReset(payload) {
        const { email, name, resetLink } = payload;
        console.log(`[HANDLER] Reset Password → ${email}`);

        return await NotificationService.sendNotification({
            userId:    payload.userId || 'SYSTEM',
            type:      'EMAIL',
            recipient: email,
            subject:   ' Réinitialisation de votre mot de passe NJILA',
            content:   `
                Bonjour ${name},

                Nous avons reçu une demande de réinitialisation de mot de passe.
                Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :
                ${resetLink}

                Ce lien expirera dans 15 minutes.
                Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.

                L'équipe technique NJILA.
            `
        });
    }

    // ── USER SERVICE ────────────────────────────────────────────────────────

    /**
     * staff.created — publié par NotificationEventPublisher.publishStaffCreated()
     * Payload : userId, email, role, name, surname, agenceId, filialeId,
     *           createdBy, createdByName, eventType, timestamp
     */
    async handleStaffCreated(payload) {
        const { email, name, surname, role, agenceId, filialeId,
                createdByName, userId } = payload;

        console.log(`[HANDLER] staff.created → ${email} (${role})`);

        return await NotificationService.sendNotification({
            userId:    userId || 'SYSTEM',
            type:      'EMAIL',
            recipient: email,
            subject:   ' Votre compte staff NJILA a été créé',
            content:   `
                Bonjour ${name} ${surname},

                Un compte staff vous a été attribué sur la plateforme NJILA.

                Détails de votre compte :
                - Rôle       : ${role}
                - Agence     : ${agenceId  || 'N/A'}
                - Filiale    : ${filialeId || 'N/A'}
                - Créé par   : ${createdByName || 'Administrateur'}

                Veuillez vous connecter et modifier votre mot de passe dès que possible.

                L'équipe NJILA.
            `
        });
    }

    /**
     * staff.deleted — publié par NotificationEventPublisher.publishStaffDeleted()
     * Payload : userId, email, role, agenceId, filialeId,
     *           deletedBy, deletedByName, eventType, timestamp
     */
    async handleStaffDeleted(payload) {
        const { email, role, agenceId, filialeId,
                deletedByName, userId } = payload;

        console.log(`[HANDLER] staff.deleted → ${email} (${role})`);

        return await NotificationService.sendNotification({
            userId:    userId || 'SYSTEM',
            type:      'EMAIL',
            recipient: email,
            subject:   ' Votre accès staff NJILA a été révoqué',
            content:   `
                Bonjour,

                Votre compte staff sur la plateforme NJILA a été supprimé.

                Détails :
                - Rôle       : ${role}
                - Agence     : ${agenceId  || 'N/A'}
                - Filiale    : ${filialeId || 'N/A'}
                - Supprimé par : ${deletedByName || 'Administrateur'}

                Si vous pensez qu'il s'agit d'une erreur, contactez votre responsable.

                L'équipe NJILA.
            `
        });
    }

    /**
     * profile.updated — publié par NotificationEventPublisher.publishProfileUpdated()
     * Payload : userId, email, name, surname, updatedBy, eventType, timestamp
     */
    async handleProfileUpdated(payload) {
        const { email, name, surname, updatedBy, userId } = payload;

        console.log(`[HANDLER] profile.updated → ${email}`);

        return await NotificationService.sendNotification({
            userId:    userId || 'SYSTEM',
            type:      'EMAIL',
            recipient: email,
            subject:   ' Votre profil NJILA a été mis à jour',
            content:   `
                Bonjour ${name} ${surname},

                Votre profil sur la plateforme NJILA vient d'être modifié.

                - Mis à jour par : ${updatedBy || 'Vous-même'}
                - Date           : ${new Date().toLocaleString('fr-FR')}

                Si vous n'êtes pas à l'origine de cette modification,
                contactez immédiatement le support NJILA.

                L'équipe NJILA.
            `
        });
    }

    // ── BOOKING SERVICE ─────────────────────────────────────────────────────

    async handleBookingCreated(payload) {
        console.log(`[HANDLER] booking.created → bookingId=${payload.bookingId}`);

        return await NotificationService.sendNotification({
            userId:    payload.userId,
            type:      'EMAIL',
            recipient: payload.email,
            subject:   ' Votre réservation NJILA est enregistrée',
            content:   `
                Votre réservation #${payload.bookingId} pour ${payload.destination}
                est en attente de paiement.
                Elle sera validée dès réception des fonds.
            `
        });
    }

    async handleBookingConfirmed(payload) {
        const { email, name, billetPdfBase64, destination } = payload;
        console.log(`[HANDLER] booking.confirmed → ticket pour ${email}`);

        try {
            const pdfBuffer = Buffer.from(billetPdfBase64, 'base64');

            return await NotificationService.sendNotification({
                type:      'EMAIL',
                recipient: email,
                subject:   ' Votre billet de voyage NJILA est disponible',
                content:   `
                    Bonjour ${name},<br><br>
                    Merci d'avoir choisi NJILA pour votre trajet vers <b>${destination}</b>.<br>
                    Vous trouverez votre billet électronique en pièce jointe.
                `,
                attachment: {
                    content:     pdfBuffer,
                    filename:    `Ticket_NJILA_${destination}.pdf`,
                    contentType: 'application/pdf'
                }
            });
        } catch (error) {
            console.error(' Erreur décodage ticket :', error.message);
        }
    }

    async handleBookingCancelled(payload) {
        console.log(`[HANDLER] booking.cancelled → bookingId=${payload.bookingId}`);

        return await NotificationService.sendNotification({
            userId:    payload.userId,
            type:      'EMAIL',
            recipient: payload.email,
            subject:   ' Annulation de votre trajet - NJILA',
            content:   `
                Nous vous confirmons l'annulation de votre réservation #${payload.bookingId}.
                Si un paiement a été effectué, le processus de remboursement est activé.
            `
        });
    }

    // ── PAYMENT SERVICE ─────────────────────────────────────────────────────

    async handlePaymentSuccess(payload) {
        console.log(`[HANDLER] payment.success → bookingId=${payload.bookingId}`);

        return await NotificationService.sendNotification({
            userId:    payload.userId,
            type:      'EMAIL',
            recipient: payload.email,
            subject:   ' Paiement confirmé - NJILA',
            content:   `
                Votre paiement de ${payload.amount} ${payload.currency || 'XAF'}
                pour la réservation #${payload.bookingId} a été confirmé avec succès.
            `
        });
    }

    async handlePaymentRefunded(payload) {
        console.log(`[HANDLER] payment.refunded → transactionId=${payload.transactionId}`);

        return await NotificationService.sendNotification({
            userId:    payload.userId,
            type:      'EMAIL',
            recipient: payload.email,
            subject:   ' Remboursement NJILA confirmé',
            content:   `
                Le remboursement de ${payload.montant} FCFA lié à votre
                transaction ${payload.transactionId} a été crédité sur votre compte.
            `
        });
    }

    // ── FLEET SERVICE ───────────────────────────────────────────────────────

    async handleTripDelay(payload) {
        return await NotificationService.sendNotification({
            userId:    payload.userId,
            type:      'PUSH',
            recipient: payload.pushToken,
            subject:   ' Information sur votre voyage',
            content:   `
                Le départ de votre bus vers ${payload.destination} est retardé
                de ${payload.delayMinutes} min suite à ${payload.reason}.
                Nous nous excusons pour le désagrément.
            `
        });
    }

    // ── DIVERS ──────────────────────────────────────────────────────────────

    async handleAvisSubmitted(payload) {
        const { agenceNom, note, commentaire } = payload;
        console.log(`[HANDLER] avis.submitted → agence=${agenceNom}`);

        return await NotificationService.sendNotification({
            userId:    'ADMIN',
            type:      'PUSH',
            recipient: payload.managerToken,
            subject:   ' Nouvel avis client !',
            content:   `L'agence ${agenceNom} a reçu une note de ${note}/5 : "${commentaire}"`
        });
    }

    async handleTripReminder(payload) {
        return await NotificationService.sendNotification({
            userId:    payload.userId,
            type:      'PUSH',
            recipient: payload.pushToken,
            subject:   ' Départ imminent !',
            content:   `
                Rappel : Votre bus pour ${payload.destination}
                (Voyage #${payload.tripId}) part dans 30 minutes.
                Veuillez vous présenter au quai d'embarquement.
            `
        });
    }
}

module.exports = new NotificationHandlers();
