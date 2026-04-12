const { Notification } = require('../models/notification');
const db = require('../config/database'); // Ton instance Sequelize

class NotificationController {
    
    // GET /api/notifications/health
    async healthCheck(req, res) {
        try {
            // Vérifier la base de données
            await db.authenticate();
            
            //  Récupérer des stats rapides
            const totalSent = await Notification.count({ where: { status: 'SENT' } });
            const totalFailed = await Notification.count({ where: { status: 'FAILED' } });

            return res.status(200).json({
                status: "UP",
                service: "njila-notification-service",
                database: "CONNECTED",
                stats: {
                    sent: totalSent,
                    failed: totalFailed
                },
                timestamp: new Date()
            });
        } catch (error) {
            return res.status(503).json({
                status: "DOWN",
                reason: "Database connection failed",
                error: error.message
            });
        }
    }

    // GET /api/notifications/history/:userId
    async getHistory(req, res) {
        const { userId } = req.params;
        try {
            const notifications = await Notification.findAll({
                where: { userId },
                order: [['createdAt', 'DESC']],
                limit: 20
            });
            return res.status(200).json(notifications);
        } catch (error) {
            return res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
        }
    }
}

module.exports = new NotificationController();