'use strict';

const mongoose = require('mongoose');

const conectarDB = async (uri) => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB conectado: ${mongoose.connection.host}/${mongoose.connection.name}`);
};

const desconectarDB = () => mongoose.disconnect();

module.exports = { conectarDB, desconectarDB };
