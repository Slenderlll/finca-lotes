'use strict';

/* =========================================================
   Comunicación con la API y manejo de la sesión.
   Lo usan las dos páginas: login.html e index.html.
   ========================================================= */

const CLAVE_TOKEN = 'finca.token';
const CLAVE_USUARIO = 'finca.usuario';

// El frontend lo sirve el mismo Express, así que la API está en el mismo origen
const URL_API = '/api';

const Sesion = {
  guardar({ token, usuario }) {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  },
  cerrar() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
  },
  get token() {
    return localStorage.getItem(CLAVE_TOKEN);
  },
  get usuario() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_USUARIO));
    } catch {
      return null;
    }
  },
};

// Error de la API con su código HTTP y, si los hay, los errores por campo
class ErrorApi extends Error {
  constructor(status, mensaje, detalles = []) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.detalles = detalles;
  }
}

const pedir = async (ruta, { metodo = 'GET', cuerpo } = {}) => {
  const encabezados = {};
  if (cuerpo) encabezados['Content-Type'] = 'application/json';
  if (Sesion.token) encabezados.Authorization = `Bearer ${Sesion.token}`;

  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: encabezados,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  }

  if (respuesta.status === 204) return null;

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos.error || 'Ocurrió un error inesperado.', datos.detalles);
  }
  return datos;
};

// Muestra bajo cada campo los errores que devolvió la API (o la validación local)
const mostrarErroresDeCampos = (formulario, detalles) => {
  let primero = null;
  detalles.forEach(({ campo, mensaje }) => {
    const parrafo = formulario.querySelector(`[data-error="${campo}"]`);
    const entrada = formulario.elements[campo];
    if (parrafo) parrafo.textContent = mensaje;
    if (entrada) {
      entrada.setAttribute('aria-invalid', 'true');
      primero ??= entrada;
    }
  });
  primero?.focus();
};

const limpiarErroresDeCampos = (formulario) => {
  formulario.querySelectorAll('[data-error]').forEach((parrafo) => {
    parrafo.textContent = '';
  });
  formulario.querySelectorAll('[aria-invalid]').forEach((entrada) => {
    entrada.removeAttribute('aria-invalid');
  });
};
