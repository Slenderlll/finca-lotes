'use strict';

// Error con código HTTP, para responder a errores esperados desde cualquier capa
class ErrorHttp extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.status = status;
    this.detalles = detalles;
  }
}

// Convierte los errores conocidos de Mongoose, Mongo y Express en respuestas claras
const normalizarError = (err) => {
  if (err instanceof ErrorHttp) return err;

  if (err.code === 11000) {
    const campo = Object.keys(err.keyPattern || {})[0] || 'valor';
    return new ErrorHttp(409, `Ya existe un registro con ese ${campo}.`);
  }
  if (err.name === 'ValidationError') {
    const detalles = Object.values(err.errors).map(({ path, message }) => ({ campo: path, mensaje: message }));
    return new ErrorHttp(400, 'Los datos enviados no son válidos.', detalles);
  }
  if (err.name === 'CastError') {
    return new ErrorHttp(400, `Valor no válido para ${err.path}.`);
  }
  if (err.type === 'entity.parse.failed') {
    return new ErrorHttp(400, 'El cuerpo de la petición no es JSON válido.');
  }
  if (err.type === 'entity.too.large') {
    return new ErrorHttp(413, 'El cuerpo de la petición es demasiado grande.');
  }
  if (err.message === 'Origen no permitido por CORS') {
    return new ErrorHttp(403, err.message);
  }
  return null;
};

// Rutas de la API que no existen
const rutaNoEncontrada = (req, _res, next) => {
  next(new ErrorHttp(404, `No existe la ruta ${req.method} ${req.originalUrl}`));
};

// Debe registrarse al final de la pila; Express lo reconoce por sus cuatro parámetros
// eslint-disable-next-line no-unused-vars
const manejadorErrores = (err, _req, res, next) => {
  // Si la respuesta ya empezó a enviarse, se delega al manejador por defecto de Express
  if (res.headersSent) return next(err);

  const conocido = normalizarError(err);
  if (!conocido) {
    // Error inesperado: se registra completo, pero al cliente no se le filtran detalles internos
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }

  const cuerpo = { error: conocido.message };
  if (conocido.detalles) cuerpo.detalles = conocido.detalles;
  return res.status(conocido.status).json(cuerpo);
};

module.exports = { ErrorHttp, rutaNoEncontrada, manejadorErrores };
