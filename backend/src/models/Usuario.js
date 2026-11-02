'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RONDAS_BCRYPT = 10;
const ROLES = ['admin', 'operador'];

const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false evita que el hash salga en las consultas por accidente
    password: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, default: 'operador' },
  },
  { timestamps: true },
);

// Guarda siempre el hash, nunca la contraseña en texto plano
usuarioSchema.pre('save', async function cifrarPassword() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, RONDAS_BCRYPT);
  }
});

usuarioSchema.methods.compararPassword = function compararPassword(candidata) {
  return bcrypt.compare(candidata, this.password);
};

// Forma pública del usuario: lo único que la API devuelve
usuarioSchema.methods.aPublico = function aPublico() {
  return { id: this.id, nombre: this.nombre, correo: this.correo, rol: this.rol };
};

module.exports = mongoose.model('Usuario', usuarioSchema);
module.exports.ROLES = ROLES;
