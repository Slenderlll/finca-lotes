'use strict';

// Crea el usuario administrador y lotes de ejemplo. Se puede correr varias veces:
// no duplica ni borra nada, solo agrega lo que falta.
const { mongoUri } = require('../src/config/env');
const { conectarDB, desconectarDB } = require('../src/config/db');
const Usuario = require('../src/models/Usuario');
const Lote = require('../src/models/Lote');

const LOTES = [
  { codigo: 'MN-2026-001', parcela: 'La Neblina', variedad: 'Geisha', proceso: 'Lavado', estado: 'En bodega', kilos: 320, precioKg: 780, puntaje: 89.5, fechaCosecha: '2026-02-12', notas: 'Jazmín, bergamota y durazno blanco.' },
  { codigo: 'MN-2026-002', parcela: 'El Mirador', variedad: 'Bourbon', proceso: 'Honey', estado: 'En bodega', kilos: 1150, precioKg: 340, puntaje: 86.25, fechaCosecha: '2026-02-20', notas: 'Panela, ciruela y cuerpo sedoso.' },
  { codigo: 'MN-2026-003', parcela: 'Los Encinos', variedad: 'Typica', proceso: 'Lavado', estado: 'En bodega', kilos: 2400, precioKg: 245, puntaje: 84.5, fechaCosecha: '2026-01-28', notas: 'Chocolate con leche y naranja dulce.' },
  { codigo: 'MN-2026-004', parcela: 'Agua Clara', variedad: 'Marsellesa', proceso: 'Natural', estado: 'Vendido', kilos: 900, precioKg: 310, puntaje: 85, fechaCosecha: '2026-01-15', notas: 'Vendido a tostador de Monterrey.' },
  { codigo: 'MN-2026-005', parcela: 'La Neblina', variedad: 'Typica', proceso: 'Natural', estado: 'En secado', kilos: 640, precioKg: 290, fechaCosecha: '2026-03-08', notas: 'En camas africanas; falta catación.' },
  { codigo: 'MN-2026-006', parcela: 'El Mirador', variedad: 'Caturra', proceso: 'Lavado', estado: 'En bodega', kilos: 1780, precioKg: 225, puntaje: 83, fechaCosecha: '2026-02-03', notas: 'Caramelo y manzana roja.' },
  { codigo: 'MN-2026-007', parcela: 'Los Encinos', variedad: 'Bourbon', proceso: 'Lavado', estado: 'Vendido', kilos: 1320, precioKg: 275, puntaje: 85.5, fechaCosecha: '2026-01-22', notas: 'Exportado a Japón.' },
  { codigo: 'MN-2026-008', parcela: 'Agua Clara', variedad: 'Geisha', proceso: 'Honey', estado: 'En secado', kilos: 210, precioKg: 860, fechaCosecha: '2026-03-14', notas: 'Microlote experimental.' },
];

const sembrar = async () => {
  const { ADMIN_CORREO: correo, ADMIN_PASSWORD: password } = process.env;
  if (!correo || !password) {
    throw new Error('Define ADMIN_CORREO y ADMIN_PASSWORD en tu archivo .env.');
  }

  await conectarDB(mongoUri);

  let admin = await Usuario.findOne({ correo: correo.toLowerCase() });
  if (!admin) {
    admin = await Usuario.create({ nombre: 'Gerencia de la finca', correo, password, rol: 'admin' });
    console.log(`Administrador creado: ${correo}`);
  }

  const operaciones = LOTES.map((lote) => ({
    updateOne: {
      filter: { codigo: lote.codigo },
      update: { $setOnInsert: { ...lote, creadoPor: admin._id } },
      upsert: true,
    },
  }));
  const { upsertedCount } = await Lote.bulkWrite(operaciones);
  console.log(`Lotes agregados: ${upsertedCount}`);
};

sembrar()
  .catch((err) => {
    console.error('No se pudo sembrar la base de datos:', err.message);
    process.exitCode = 1;
  })
  .finally(desconectarDB);
