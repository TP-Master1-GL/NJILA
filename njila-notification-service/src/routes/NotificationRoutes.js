const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');

// Route de santé (utilisée par Gateway ou Kubernetes)
router.get('/health', notificationController.healthCheck);

// Route pour l'historique d'un utilisateur (utilisée par le Frontend Mobile)
router.get('/history/:userId', notificationController.getHistory);

module.exports = router;