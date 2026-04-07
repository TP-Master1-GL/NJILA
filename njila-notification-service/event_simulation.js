const amqp = require('amqplib');

async function simulate() {
    try {
        const connection = await amqp.connect('amqp://localhost'); // Ajuste si ton RabbitMQ est ailleurs
        const channel = await connection.createChannel();
        const exchange = 'njila.notification.exchange';

        console.log("🚀 Lancement de la simulation d'événements NJILA...");

        // --- SIMULATION 1 : INSCRIPTION (Bienvenue) ---
        const welcomePayload = {
            userId: "USR-99",
            email: "maffo.ngaleu@gmail.com",
            name: "Laetitia",
            surname: "Maffo"
        };
        channel.publish(exchange, 'auth.user.welcome', Buffer.from(JSON.stringify(welcomePayload)));
        console.log(" [AUTH] Message 'Bienvenue' envoyé !");

        // --- SIMULATION 2 : RETARD DE BUS (Fleet Service) ---
        const delayPayload = {
            userId: "USR-99",
            pushToken: "fake_token_123",
            destination: "Douala",
            delayMinutes: 45,
            reason: "une panne technique sur le moteur"
        };
        setTimeout(() => {
            channel.publish(exchange, 'trip.delay.alert', Buffer.from(JSON.stringify(delayPayload)));
            console.log(" [FLEET] Message 'Alerte Retard' envoyé !");
        }, 2000); // On attend 2 sec pour le deuxième message

        // Fermeture propre après les envois
        setTimeout(() => {
            connection.close();
            console.log("\n🏁 Simulation terminée.");
            process.exit(0);
        }, 5000);

    } catch (error) {
        console.error("❌ Erreur simulation :", error.message);
    }
}

simulate();