const { DataTypes } = require('sequelize');
const { getSequelize } = require('../config/database');

const sequelize = getSequelize(); 


const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('EMAIL','PUSH'), allowNull: false },
    recipient: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('PENDING', 'SENT', 'FAILED'), defaultValue: 'PENDING' }
}, {
    tableName: 'Notifications',
    schema: 'public',
    timestamps: false
});

module.exports = Notification;





