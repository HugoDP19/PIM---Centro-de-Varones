const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/incidencias', require('./incidencias.routes'));

module.exports = router;
