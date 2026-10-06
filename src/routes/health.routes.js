const router = require('express').Router();
const { check } = require('../controllers/health.controller');

router.get('/', check);

module.exports = router;
