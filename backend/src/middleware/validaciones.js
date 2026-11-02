'use strict';

const { body, param, query, validationResult } = require('express-validator');
const { VARIEDADES, PROCESOS, ESTADOS } = require('../models/Lote');
const { ErrorHttp } = require('./errores');

const LONGITUD_MINIMA_PASSWORD = 8;

// Revisa el resultado de las reglas anteriores y responde 400 con el detalle por campo
const validar = (req, _res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    const detalles = errores.array({ onlyFirstError: true }).map(({ path, msg }) => ({ campo: path, mensaje: msg }));
    throw new ErrorHttp(400, 'Los datos enviados no son válidos.', detalles);
  }
  next();
};

// isString() en cada campo de texto impide que lleguen objetos como { "$ne": null } a las consultas
const correo = body('correo')
  .isString().withMessage('El correo es obligatorio.')
  .bail()
  .trim()
  .isEmail().withMessage('Escribe un correo válido.')
  .bail()
  .toLowerCase();

const reglasRegistro = [
  body('nombre')
    .isString().withMessage('El nombre es obligatorio.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('El nombre debe tener entre 2 y 80 caracteres.'),
  correo,
  body('password')
    .isString().withMessage('La contraseña es obligatoria.')
    .bail()
    .isLength({ min: LONGITUD_MINIMA_PASSWORD, max: 72 })
    .withMessage(`La contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y 72 caracteres.`),
  validar,
];

const reglasLogin = [
  correo,
  body('password')
    .isString().withMessage('La contraseña es obligatoria.')
    .bail()
    .notEmpty().withMessage('La contraseña es obligatoria.'),
  validar,
];

const reglasId = [param('id').isMongoId().withMessage('El identificador no es válido.'), validar];

const opcionesDe = (lista) => `Debe ser uno de: ${lista.join(', ')}.`;

const reglasLote = [
  body('codigo')
    .isString().withMessage('El código es obligatorio.')
    .bail()
    .trim()
    .toUpperCase()
    .matches(/^MN-\d{4}-\d{3}$/).withMessage('Usa el formato MN-2026-001.'),
  body('parcela')
    .isString().withMessage('La parcela es obligatoria.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('La parcela debe tener entre 2 y 60 caracteres.'),
  body('variedad').isIn(VARIEDADES).withMessage(opcionesDe(VARIEDADES)),
  body('proceso').isIn(PROCESOS).withMessage(opcionesDe(PROCESOS)),
  body('estado').optional().isIn(ESTADOS).withMessage(opcionesDe(ESTADOS)),
  body('kilos')
    .isFloat({ min: 0, max: 1000000 }).withMessage('Los kilos deben ser un número mayor o igual a 0.')
    .toFloat(),
  body('precioKg')
    .isFloat({ min: 0, max: 100000 }).withMessage('El precio debe ser un número mayor o igual a 0.')
    .toFloat(),
  // null o vacío significa que el lote todavía no tiene catación
  body('puntaje')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 100 }).withMessage('El puntaje debe estar entre 0 y 100.')
    .toFloat(),
  body('fechaCosecha')
    .isISO8601().withMessage('Escribe una fecha válida.')
    .bail()
    .custom((valor) => new Date(valor) <= new Date()).withMessage('La fecha de cosecha no puede estar en el futuro.')
    .toDate(),
  body('notas')
    .optional({ values: 'null' })
    .isString().withMessage('Las notas deben ser texto.')
    .bail()
    .trim()
    .isLength({ max: 300 }).withMessage('Las notas admiten hasta 300 caracteres.'),
  validar,
];

const reglasListado = [
  query('buscar').optional().isString().withMessage('La búsqueda debe ser texto.').trim(),
  query('estado').optional().isIn(ESTADOS).withMessage(opcionesDe(ESTADOS)),
  query('variedad').optional().isIn(VARIEDADES).withMessage(opcionesDe(VARIEDADES)),
  query('pagina').optional().isInt({ min: 1 }).withMessage('La página debe ser un entero positivo.').toInt(),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100.').toInt(),
  validar,
];

module.exports = { reglasRegistro, reglasLogin, reglasId, reglasLote, reglasListado };
