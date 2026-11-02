'use strict';

const { matchedData } = require('express-validator');
const Lote = require('../models/Lote');
const { ErrorHttp } = require('../middleware/errores');

const LIMITE_POR_DEFECTO = 12;

// Escapa la búsqueda del usuario para usarla como texto literal dentro de una expresión regular
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/lotes?buscar=&estado=&variedad=&pagina=&limite=
const listar = async (req, res) => {
  const { buscar, estado, variedad, pagina = 1, limite = LIMITE_POR_DEFECTO } = matchedData(req, { locations: ['query'] });

  const filtro = {};
  if (estado) filtro.estado = estado;
  if (variedad) filtro.variedad = variedad;
  if (buscar) {
    const patron = new RegExp(escaparRegex(buscar), 'i');
    filtro.$or = [{ codigo: patron }, { parcela: patron }, { notas: patron }];
  }

  const [lotes, total] = await Promise.all([
    Lote.find(filtro).sort({ fechaCosecha: -1, codigo: -1 }).skip((pagina - 1) * limite).limit(limite),
    Lote.countDocuments(filtro),
  ]);

  res.json({ lotes, total, pagina, paginas: Math.max(Math.ceil(total / limite), 1) });
};

// GET /api/lotes/resumen. Totales del inventario para el tablero.
const resumen = async (_req, res) => {
  const disponibles = { $ne: ['$estado', 'Vendido'] };
  const [totales] = await Lote.aggregate([
    {
      $group: {
        _id: null,
        lotes: { $sum: 1 },
        kilosDisponibles: { $sum: { $cond: [disponibles, '$kilos', 0] } },
        valorDisponible: { $sum: { $cond: [disponibles, { $multiply: ['$kilos', '$precioKg'] }, 0] } },
        puntajePromedio: { $avg: '$puntaje' },
      },
    },
  ]);

  res.json({
    lotes: totales?.lotes ?? 0,
    kilosDisponibles: totales?.kilosDisponibles ?? 0,
    valorDisponible: totales?.valorDisponible ?? 0,
    puntajePromedio: totales?.puntajePromedio ?? null,
  });
};

// Busca el lote por id o responde 404
const buscarLote = async (id) => {
  const lote = await Lote.findById(id);
  if (!lote) throw new ErrorHttp(404, 'No se encontró el lote.');
  return lote;
};

// GET /api/lotes/:id
const obtener = async (req, res) => {
  res.json({ lote: await buscarLote(req.params.id) });
};

// matchedData solo devuelve los campos declarados en las reglas, así el cliente
// no puede escribir otros campos como creadoPor
const datosDelLote = (req) => matchedData(req, { locations: ['body'] });

// POST /api/lotes
const crear = async (req, res) => {
  const lote = await Lote.create({ ...datosDelLote(req), creadoPor: req.usuario.id });
  res.status(201).json({ lote });
};

// PUT /api/lotes/:id
const actualizar = async (req, res) => {
  const lote = await buscarLote(req.params.id);
  const { puntaje, ...datos } = datosDelLote(req);

  lote.set(datos);
  // Sin puntaje en la petición, se borra la catación que tuviera el lote
  lote.puntaje = puntaje || undefined;
  await lote.save();

  res.json({ lote });
};

// DELETE /api/lotes/:id
const eliminar = async (req, res) => {
  const lote = await buscarLote(req.params.id);
  await lote.deleteOne();
  res.status(204).end();
};

module.exports = { listar, resumen, obtener, crear, actualizar, eliminar };
