'use strict';

const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { corsOrigenes } = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const lotesRoutes = require('./routes/lotes.routes');
const { rutaNoEncontrada, manejadorErrores } = require('./middleware/errores');

const CARPETA_FRONTEND = path.join(__dirname, '..', '..', 'frontend');
const ESTADO_CONECTADO = 1;

const app = express();

// Render y otros servicios atienden detrás de un proxy; sin esto el límite de
// intentos vería a todos los clientes con la misma IP
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      // Sin esto Helmet fuerza HTTPS, y el despliegue local corre en http://localhost
      upgradeInsecureRequests: null,
    },
  },
}));

// El navegador también manda Origin en los POST de nuestro propio frontend, así que el
// mismo origen se permite siempre. Sin Origin (Postman, curl) tampoco aplica CORS.
const esMismoOrigen = (origen, host) => {
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
};

app.use(cors((req, responder) => {
  const { origin: origen, host } = req.headers;
  if (!origen || esMismoOrigen(origen, host) || corsOrigenes.includes(origen)) {
    return responder(null, { origin: true });
  }
  return responder(new Error('Origen no permitido por CORS'));
}));

app.use(express.json({ limit: '20kb' }));

// API
app.get('/api/salud', (_req, res) => {
  const conectada = mongoose.connection.readyState === ESTADO_CONECTADO;
  res.status(conectada ? 200 : 503).json({ estado: conectada ? 'ok' : 'sin base de datos' });
});
app.use('/api/auth', authRoutes);
app.use('/api/lotes', lotesRoutes);
app.use('/api', rutaNoEncontrada);

// Frontend
app.use(express.static(CARPETA_FRONTEND, { extensions: ['html'] }));
app.use(rutaNoEncontrada);

// Siempre al final de la pila
app.use(manejadorErrores);

module.exports = app;
