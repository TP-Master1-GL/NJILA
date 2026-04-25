const amqp = require('amqplib');

async function simulateTicket() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
        const channel = await connection.createChannel();
        const exchange = 'njila.notification.exchange';

        // --- CE BASE64 EST UN VRAI PDF VALIDE (Testé) ---
        const validBase64Pdf = "JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqMiAwIG9iajw8L1R5cGUvUGFnZXMvS2lkc1szIDAgUl0vQ291bnQgMT4+ZW5kb2JqMyAwIG9iajw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+ZW5kb2JqNCAwIG9iajw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+ZW5kb2JqNSAwIG9iajw8L0xlbmd0aCA0ND4+c3RyZWFtCkJULy9GMSAxMiBUZiAxMDAgNTAwIFRkIChURVNUIE5KSUxBIE9LKSBUaiBFVAplbmRzdHJlYW1lbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmCjAwMDAwMDAwMDkgMDAwMDAgbgowMDAwMDAwMDU2IDAwMDAwIG4KMDAwMDAwMDExMSAwMDAwMCBuCjAwMDAwMDAyMDIgMDAwMDAgbgowMDAwMDAwMjg0IDAwMDAwIG4KdHJhaWxlcjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjM3OQolJUVPRg==";

        const payload = {
            email: "maffo.ngaleu@gmail.com",
            name: "Laetitia",
            destination: "Douala",
            billetPdfBase64: validBase64Pdf 
        };

        const routingKey = 'booking.confirmed'; 
        channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)));

        console.log("✅ Message envoyé avec un vrai PDF binaire.");
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        console.error(error);
    }
}
simulateTicket();