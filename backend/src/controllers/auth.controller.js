'use strict';

const jwt = require('jsonwebtoken');
const { matchedData } = require('express-validator');
const { jwtSecret, jwtExpira } = require('../config/env');
const Usuario = require('../models/Usuario');
const { ErrorHttp } = require('../middleware/errores');

const firmarToken = (usuario) =>
  jwt.sign({ rol: usuario.rol }, jwtSecret, {
    subject: usuario.id,
    expiresIn: jwtExpira,
    algorithm: 'HS256',
  });

// POST /api/auth/registro. El rol no se recibe del cliente: toda cuenta nueva es "operador".
const registrar = async (req, res) => {
  const { nombre, correo, password } = matchedData(req);
  const usuario = await Usuario.create({ nombre, correo, password });
  res.status(201).json({ token: firmarToken(usuario), usuario: usuario.aPublico() });
};

// POST /api/auth/login. El mismo mensaje para correo o contraseña incorrectos
// evita revelar qué correos están registrados.
const iniciarSesion = async (req, res) => {
  const { correo, password } = matchedData(req);
  const usuario = await Usuario.findOne({ correo }).select('+password');

  if (!usuario || !(await usuario.compararPassword(password))) {
    throw new ErrorHttp(401, 'Correo o contraseña incorrectos.');
  }
  res.json({ token: firmarToken(usuario), usuario: usuario.aPublico() });
};

// GET /api/auth/perfil
const obtenerPerfil = (req, res) => {
  res.json({ usuario: req.usuario.aPublico() });
};

module.exports = { registrar, iniciarSesion, obtenerPerfil };
