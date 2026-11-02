'use strict';

/* =========================================================
   Inicio de sesión y registro en un mismo formulario
   ========================================================= */

const formulario = document.querySelector('#formulario');
const aviso = document.querySelector('#aviso');
const botonEnviar = document.querySelector('#enviar');
const entradaPassword = document.querySelector('#password');
const botonVer = document.querySelector('#ver-password');

const MODOS = {
  login: {
    titulo: 'Inicia sesión',
    subtitulo: 'Entra para registrar y editar los lotes de café.',
    boton: 'Iniciar sesión',
    cambioTexto: '¿Aún no tienes cuenta?',
    cambioBoton: 'Crear una cuenta',
    autocompletar: 'current-password',
  },
  registro: {
    titulo: 'Crea tu cuenta',
    subtitulo: 'Las cuentas nuevas pueden registrar y editar lotes.',
    boton: 'Crear cuenta',
    cambioTexto: '¿Ya tienes cuenta?',
    cambioBoton: 'Iniciar sesión',
    autocompletar: 'new-password',
  },
};

let modo = 'login';

const irAlInventario = () => window.location.replace('./');

const mostrarAviso = (mensaje) => {
  aviso.textContent = mensaje;
  aviso.hidden = false;
};

const cambiarModo = () => {
  modo = modo === 'login' ? 'registro' : 'login';
  const textos = MODOS[modo];
  const esRegistro = modo === 'registro';

  document.querySelector('#titulo').textContent = textos.titulo;
  document.querySelector('#subtitulo').textContent = textos.subtitulo;
  document.querySelector('#cambio-texto').textContent = textos.cambioTexto;
  document.querySelector('#cambiar-modo').textContent = textos.cambioBoton;
  document.querySelector('#campo-nombre').hidden = !esRegistro;
  document.querySelector('#ayuda-password').hidden = !esRegistro;
  botonEnviar.textContent = textos.boton;
  entradaPassword.autocomplete = textos.autocompletar;

  aviso.hidden = true;
  limpiarErroresDeCampos(formulario);
  (esRegistro ? formulario.elements.nombre : formulario.elements.correo).focus();
};

// Validación inmediata; la definitiva siempre la hace el servidor
const validarEnNavegador = ({ nombre, correo, password }) => {
  const errores = [];
  if (modo === 'registro' && nombre.trim().length < 2) {
    errores.push({ campo: 'nombre', mensaje: 'Escribe tu nombre.' });
  }
  if (!correo.trim()) errores.push({ campo: 'correo', mensaje: 'Escribe tu correo.' });
  else if (!formulario.elements.correo.validity.valid) errores.push({ campo: 'correo', mensaje: 'Escribe un correo válido.' });

  if (!password) errores.push({ campo: 'password', mensaje: 'Escribe tu contraseña.' });
  else if (modo === 'registro' && password.length < 8) {
    errores.push({ campo: 'password', mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  return errores;
};

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  aviso.hidden = true;
  limpiarErroresDeCampos(formulario);

  const { nombre, correo, password } = Object.fromEntries(new FormData(formulario));
  const errores = validarEnNavegador({ nombre, correo, password });
  if (errores.length) {
    mostrarErroresDeCampos(formulario, errores);
    return;
  }

  const textoOriginal = botonEnviar.textContent;
  botonEnviar.disabled = true;
  botonEnviar.textContent = 'Un momento…';

  try {
    const cuerpo = modo === 'registro' ? { nombre, correo, password } : { correo, password };
    const sesion = await pedir(`/auth/${modo}`, { metodo: 'POST', cuerpo });
    Sesion.guardar(sesion);
    irAlInventario();
  } catch (err) {
    if (err.detalles?.length) mostrarErroresDeCampos(formulario, err.detalles);
    else mostrarAviso(err.message);
    botonEnviar.disabled = false;
    botonEnviar.textContent = textoOriginal;
  }
});

document.querySelector('#cambiar-modo').addEventListener('click', cambiarModo);

botonVer.addEventListener('click', () => {
  const visible = entradaPassword.type === 'text';
  entradaPassword.type = visible ? 'password' : 'text';
  botonVer.textContent = visible ? 'Mostrar' : 'Ocultar';
  botonVer.setAttribute('aria-pressed', String(!visible));
});

// Quien vuelve con una sesión expirada ve por qué se le pide entrar otra vez
if (new URLSearchParams(window.location.search).get('motivo') === 'expirada') {
  mostrarAviso('Tu sesión expiró. Inicia sesión de nuevo.');
}

if (Sesion.token) irAlInventario();
