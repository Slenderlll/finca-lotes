'use strict';

const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { entorno } = require('../config/env');
const { autenticar } = require('../middleware/auth');
const { reglasRegistro, reglasLogin } = require('../middleware/validaciones');
const { registrar, iniciarSesion, obtenerPerfil } = require('../controllers/auth.controller');

const router = Router();

// Frena los intentos repetidos de adivinar contraseñas
const limitarIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => entorno === 'test',
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

router.post('/registro', limitarIntentos, reglasRegistro, registrar);
router.post('/login', limitarIntentos, reglasLogin, iniciarSesion);
router.get('/perfil', autenticar, obtenerPerfil);

module.exports = router;
