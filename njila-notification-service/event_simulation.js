const amqp = require('amqplib');

async function simulate() {
    try {
        // 1. Connexion à RabbitMQ (local ou URL Render)
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost'); 
        const channel = await connection.createChannel();
        const exchange = 'njila.notification.exchange';

        console.log("🚀 Simulation : Envoi d'email de Réinitialisation (Password Reset)...");

        // --- PAYLOAD EXACT DU SERVICE AUTH (PYTHON) ---
        const resetPayload = {
            email: "maffo.ngaleu@gmail.com",
            name: "Laetitia",
            resetLink: "https://njila-app.com/reset-password/token_test_abc123",
            type: "password_reset"
        };

        // 2. Publication sur l'exchange avec la clé spécifique
        const sent = channel.publish(
            exchange, 
            'auth.password.reset', 
            Buffer.from(JSON.stringify(resetPayload)),
            { persistent: true }
        );

        if (sent) {
            console.log("✅ [SUCCESS] Message 'auth.password.reset' posté !");
            console.log(`🔗 Lien envoyé : ${resetPayload.resetLink}`);
        } else {
            console.log("❌ [ERROR] Échec de l'envoi.");
        }

        // 3. Fermeture propre
        setTimeout(() => {
            connection.close();
            console.log("\n🏁 Simulation terminée. Vérifie ton email.");
            process.exit(0);
        }, 2000);

    } catch (error) {
        console.error("❌ Erreur :", error.message);
        process.exit(1);
    }
}

simulate();