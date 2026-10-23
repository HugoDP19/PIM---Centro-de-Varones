const router = require('express').Router();
const controller = require('../controllers/usuarios.controller');
const { requiereLogin, requiereRol } = require('../middlewares/auth');
router.use(requiereLogin, requiereRol('Administrador'));
router.get('/', controller.list);
router.post('/', controller.guardar);
router.put('/:id', controller.guardar);
module.exports = router;
