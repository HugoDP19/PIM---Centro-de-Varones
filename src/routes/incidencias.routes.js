const router = require('express').Router();
const controller = require('../controllers/incidencias.controller');
const { requiereLogin, requiereRol } = require('../middlewares/auth');
const { OPERADORES, SUPERVISORES } = require('../config/roles');

router.use(requiereLogin, requiereRol(...OPERADORES));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/estado', requiereRol(...SUPERVISORES), controller.changeStatus);
router.patch('/:id/anular', requiereRol(...SUPERVISORES), controller.annul);

module.exports = router;
