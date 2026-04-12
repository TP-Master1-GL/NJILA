const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');


router.get('/health', notificationController.healthCheck);


router.get('/history/:userId', notificationController.getHistory);

module.exports = router;