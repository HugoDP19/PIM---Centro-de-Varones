const router = require('express').Router();

router.use('/health', require('./health.routes'));

module.exports = router;
