'use strict';

const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const Usuario = require('../models/Usuario');
const { ErrorHttp } = require('./errores');

// Exige un token válido en "Authorization: Bearer <token>" y deja al usuario en req.usuario.
// El usuario se busca en cada petición para que un rol cambiado o una cuenta borrada
// tengan efecto de inmediato, sin esperar a que el token expire.
const autenticar = async (req, _res, next) => {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    throw new ErrorHttp(401, 'Debes iniciar sesión para realizar esta acción.');
  }

  let datos;
  try {
    datos = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    const mensaje = err.name === 'TokenExpiredError'
      ? 'Tu sesión expiró. Inicia sesión de nuevo.'
      : 'El token no es válido.';
    throw new ErrorHttp(401, mensaje);
  }

  const usuario = await Usuario.findById(datos.sub);
  if (!usuario) throw new ErrorHttp(401, 'El token no es válido.');

  req.usuario = usuario;
  next();
};

// Autoriza según el rol; se usa siempre después de autenticar
const permitirRoles = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.usuario.rol)) {
    throw new ErrorHttp(403, 'No tienes permiso para realizar esta acción.');
  }
  next();
};

module.exports = { autenticar, permitirRoles };
