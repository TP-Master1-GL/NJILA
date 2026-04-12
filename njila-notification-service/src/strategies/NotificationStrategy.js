
class NotificationStrategy {
    /**
     * @param {Object} notification - L'instance de la notification (Sequelize)
     */
    async send(notification) {
       
        throw new Error("La méthode send() doit être implémentée dans la sous-classe");
    }
}

module.exports = NotificationStrategy;