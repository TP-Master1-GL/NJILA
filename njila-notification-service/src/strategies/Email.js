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
            subject: notification.subject,
            text: notification.content,
            // Si une pièce jointe est présente dans la base de données
            attachments: notification.pieceJointe ? [{ path: notification.pieceJointe }] : []
        };

        return await this.transporter.sendMail(mailOptions);
    }
}

module.exports = Email;