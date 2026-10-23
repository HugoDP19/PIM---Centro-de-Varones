const router = require('express').Router();
const controller = require('../controllers/incidencias.controller');

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/estado', controller.changeStatus);

module.exports = router;
