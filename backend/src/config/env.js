'use strict';

// Carga las variables de .env y las valida en un solo lugar.
// Si falta algo indispensable, la aplicación se detiene al arrancar con un mensaje
// claro, en lugar de fallar después en medio de una petición.
require('dotenv').config({ quiet: true });

const LONGITUD_MINIMA_SECRETO = 32;

const requerida = (nombre) => {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env (ver .env.example).`);
  }
  return valor;
};

const jwtSecret = requerida('JWT_SECRET');
if (jwtSecret.length < LONGITUD_MINIMA_SECRETO) {
  throw new Error(`JWT_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres.`);
}

module.exports = {
  entorno: process.env.NODE_ENV || 'development',
  puerto: Number(process.env.PORT) || 3000,
  mongoUri: requerida('MONGODB_URI'),
  jwtSecret,
  jwtExpira: process.env.JWT_EXPIRA || '2h',
  corsOrigenes: (process.env.CORS_ORIGENES || '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
};
