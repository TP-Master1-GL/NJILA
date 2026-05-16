const { getNotificationModel } = require('../models/notification');
const { getSequelize } = require('../config/database');

class NotificationController {

    // GET /api/notifications/health
    async healthCheck(req, res) {
        try {
            const sequelize = getSequelize();
            await sequelize.authenticate();

            const Notification = getNotificationModel();
            const totalSent   = await Notification.count({ where: { status: 'SENT' } });
            const totalFailed = await Notification.count({ where: { status: 'FAILED' } });

            return res.status(200).json({
                status:    'UP',
                service:   'njila-notification-service',
                database:  'CONNECTED',
                stats:     { sent: totalSent, failed: totalFailed },
                timestamp: new Date()
            });

        } catch (error) {
            return res.status(503).json({
                status: 'DOWN',
                reason: 'Database connection failed',
                error:  error.message
            });
        }
    }

    // GET /api/notifications/history/:userId
    async getHistory(req, res) {
        const { userId } = req.params;
        try {
            const Notification    = getNotificationModel();
            const notifications   = await Notification.findAll({
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
