const router = require('express').Router();
const controller = require('../controllers/incidencias.controller');

router.get('/', controller.list);
router.post('/', controller.create);

module.exports = router;
