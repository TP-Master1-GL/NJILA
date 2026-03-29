/**
 * Interface de base pour toutes les stratégies de notification.
 * Toutes les classes de stratégie (Email, Push, etc.) doivent hériter de celle-ci.
 */
class NotificationStrategy {
    /**
     * @param {Object} notification - L'instance de la notification (Sequelize)
     */
    async send(notification) {
        // Cette erreur force le développeur à implémenter la méthode dans les sous-classes
        throw new Error("La méthode send() doit être implémentée dans la sous-classe");
    }
}

module.exports = NotificationStrategy;