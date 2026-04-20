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
        console.log(`[SMTP] Envoi Email avec pièce jointe binaire vers ${notification.recipient}`);

        const mailOptions = {
            from: `"NJILA Platform" <${process.env.SMTP_USER}>`,
            to: notification.recipient,
            subject: notification.sujet || notification.subject, 
            html: notification.content, // Ton template NJILA décoré
            text: "Votre client mail ne supporte pas le HTML. Veuillez ouvrir ce message sur un appareil moderne pour voir votre ticket.",
            attachments: []
        };

        // --- INJECTION DIRECTE DU BUFFER (DÉCRYPTÉ) ---
        if (notification.attachment && notification.attachment.content) {
            mailOptions.attachments.push({
                filename: notification.attachment.filename || 'ticket_njila.pdf',
                content: notification.attachment.content, // Le Buffer (byte[]) décodé
                contentType: 'application/pdf'
            });
        }

        try {
            const info = await this.transporter.sendMail(mailOptions);
            return info;
        } catch (error) {
            console.error(`[SMTP ERROR] Échec de l'envoi :`, error.message);
            throw error; 
        }
    }
}

module.exports = Email;