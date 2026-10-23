const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { requiereLogin } = require('../middlewares/auth');
router.post('/login', controller.login);
router.get('/me', requiereLogin, controller.me);
router.post('/logout', requiereLogin, controller.logout);
module.exports = router;
