const amqp = require('amqplib');

async function simulateTicket() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
        const channel = await connection.createChannel();
        const exchange = 'njila.notification.exchange';

        console.log("🚀 Simulation : Envoi Ticket via BOOKING CONFIRMED...");

        // Simulation du PDF en Base64 (Fidèle à ton opération Java)
        const fakePdfContent = "Contenu binaire du ticket NJILA - Confirmation de Reservation";
        const base64Ticket = Buffer.from(fakePdfContent).toString('base64');

        const payload = {
            email: "maffo.ngaleu@gmail.com",
            name: "Laetitia",
            destination: "Bafoussam",
            billetPdfBase64: base64Ticket 
        };

        // On utilise la clé liée à 'njila.booking.confirmed.queue'
        const routingKey = 'booking.confirmed'; 
        
        channel.publish(
            exchange,
            routingKey,
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        );

        console.log(`✅ Message envoyé sur la clé : ${routingKey}`);

        setTimeout(() => {
            connection.close();
            process.exit(0);
        }, 2000);

    } catch (error) {
        console.error("❌ Erreur :", error.message);
    }
}

simulateTicket();