'use strict';

const mongoose = require('mongoose');

const conectarDB = async (uri) => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB conectado: ${mongoose.connection.host}/${mongoose.connection.name}`);
};

const desconectarDB = () => mongoose.disconnect();

// Para entornos sin servidor: las peticiones comparten una sola conexión, y si el
// intento falla la siguiente petición vuelve a probar
let conexion;
const conectarUnaVez = (uri) => {
  conexion ??= conectarDB(uri).catch((err) => {
    conexion = undefined;
    throw err;
  });
  return conexion;
};

module.exports = { conectarDB, conectarUnaVez, desconectarDB };
