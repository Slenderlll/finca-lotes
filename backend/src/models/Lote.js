'use strict';

const mongoose = require('mongoose');

const VARIEDADES = ['Typica', 'Bourbon', 'Geisha', 'Caturra', 'Marsellesa'];
const PROCESOS = ['Lavado', 'Honey', 'Natural'];
const ESTADOS = ['En secado', 'En bodega', 'Vendido'];

// Un lote es una cantidad de café de una misma parcela, variedad y cosecha
const loteSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    parcela: { type: String, required: true, trim: true, maxlength: 60 },
    variedad: { type: String, required: true, enum: VARIEDADES },
    proceso: { type: String, required: true, enum: PROCESOS },
    estado: { type: String, enum: ESTADOS, default: 'En secado' },
    kilos: { type: Number, required: true, min: 0 },
    precioKg: { type: Number, required: true, min: 0 },
    puntaje: { type: Number, min: 0, max: 100 },
    fechaCosecha: { type: Date, required: true },
    notas: { type: String, trim: true, maxlength: 300, default: '' },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { timestamps: true },
);

loteSchema.index({ estado: 1, fechaCosecha: -1 });

module.exports = mongoose.model('Lote', loteSchema);
Object.assign(module.exports, { VARIEDADES, PROCESOS, ESTADOS });
