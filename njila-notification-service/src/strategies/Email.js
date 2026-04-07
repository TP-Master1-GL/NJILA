const NotificationStrategy = require('./NotificationStrategy');
const nodemailer = require('nodemailer');

class Email extends NotificationStrategy {
    constructor() {
        super();
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465, 
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    async send(notification) {
        console.log(`[SMTP] Envoi Email vers ${notification.recipient}`);

        const mailOptions = {
            from: `"NJILA Platform" <${process.env.SMTP_USER}>`,
            to: notification.recipient,
            subject: notification.sujet || notification.subject, // Supporte les deux noms de colonnes
            
            // --- LA MODIFICATION EST ICI ---
            html: notification.content, // On utilise 'html' pour interpréter le design du MailDecorator
            // On peut garder 'text' en backup pour les vieux téléphones (optionnel)
            text: "Veuillez utiliser un client mail compatible HTML pour voir ce message.", 
            
            // Si une pièce jointe est présente
            attachments: notification.pieceJointe ? [{ path: notification.pieceJointe }] : []
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            return info;
        } catch (error) {
            console.error(`[SMTP ERROR] Erreur lors de l'envoi à ${notification.recipient}:`, error.message);
            throw error; // On relance l'erreur pour que le NotificationService passe en status 'FAILED'
        }
    }
}

module.exports = Email;