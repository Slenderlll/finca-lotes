'use strict';

const { puerto, mongoUri, entorno } = require('./config/env');
const { conectarDB, desconectarDB } = require('./config/db');
const app = require('./app');

const iniciar = async () => {
  await conectarDB(mongoUri);

  const servidor = app.listen(puerto, () => {
    console.log(`Servidor (${entorno}) en http://localhost:${puerto}`);
  });

  // Cierre ordenado: termina las peticiones en curso antes de soltar la base de datos
  const cerrar = () => {
    servidor.close(async () => {
      await desconectarDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
};

iniciar().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
