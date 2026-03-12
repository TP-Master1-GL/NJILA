const express = require('express');
const router  = express.Router();

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'njila-search-service' });
});

module.exports = router;
