'use strict';

// Punto de entrada en Vercel. Aquí no hay un servidor encendido como en server.js:
// Vercel llama a esta función por cada petición, y entre llamadas puede reutilizarla.
const { mongoUri } = require('../backend/src/config/env');
const { conectarUnaVez } = require('../backend/src/config/db');
const app = require('../backend/src/app');

module.exports = async (req, res) => {
  try {
    await conectarUnaVez(mongoUri);
  } catch (err) {
    console.error('No se pudo conectar a MongoDB:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Base de datos no disponible. Intenta de nuevo.' }));
  }
  return app(req, res);
};
