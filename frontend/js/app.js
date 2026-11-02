'use strict';

/* =========================================================
   Tablero de inventario: lista, filtros y CRUD de lotes.
   Los lotes se dibujan con createElement y textContent, así el
   texto que escribe un usuario nunca se interpreta como HTML.
   ========================================================= */

const LOTES_POR_PAGINA = 12;
const ESPERA_BUSQUEDA_MS = 300;
const DURACION_AVISO_MS = 3500;
const LOTES_DE_CARGA = 6;

const lista = document.querySelector('#lista');
const conteo = document.querySelector('#conteo');
const dialogoLote = document.querySelector('#dialogo-lote');
const formularioLote = document.querySelector('#formulario-lote');
const avisoLote = document.querySelector('#aviso-lote');
const botonGuardar = document.querySelector('#guardar-lote');
const dialogoEliminar = document.querySelector('#dialogo-eliminar');
const botonConfirmarEliminar = document.querySelector('#confirmar-eliminar');

const formatoKilos = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const formatoDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const formatoPuntaje = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });

const filtros = { buscar: '', variedad: '', estado: '', pagina: 1 };
let lotesEnPantalla = [];
let loteEnEdicion = null;
let loteAEliminar = null;
let ultimaConsulta = 0;

const puedeEscribir = () => Boolean(Sesion.usuario);
const puedeEliminar = () => Sesion.usuario?.rol === 'admin';

// ---------- Utilidades de DOM ----------

const crear = (etiqueta, clase, texto) => {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
};

const mostrarAvisoFlotante = (mensaje, esError = false) => {
  const aviso = crear('div', `aviso-flotante${esError ? ' aviso-flotante-error' : ''}`, mensaje);
  document.querySelector('#avisos').append(aviso);
  setTimeout(() => aviso.remove(), DURACION_AVISO_MS);
};

// ---------- Sesión ----------

const cerrarSesion = () => {
  Sesion.cerrar();
  window.location.assign('login.html');
};

const dibujarSesion = () => {
  const contenedor = document.querySelector('#sesion');
  const { usuario } = Sesion;
  const textoRol = document.querySelector('#texto-rol');
  contenedor.replaceChildren();

  if (!usuario) {
    const entrar = crear('a', 'boton boton-primario', 'Iniciar sesión');
    entrar.href = 'login.html';
    contenedor.append(entrar);
    textoRol.textContent = 'Estás viendo el inventario en modo consulta. Inicia sesión para hacer cambios.';
    return;
  }

  const nombre = crear('div', 'sesion-nombre', usuario.nombre);
  nombre.append(crear('span', 'sesion-rol', usuario.rol === 'admin' ? 'Administración' : 'Operación'));
  const salir = crear('button', 'boton boton-secundario', 'Salir');
  salir.type = 'button';
  salir.addEventListener('click', cerrarSesion);
  contenedor.append(nombre, salir);

  textoRol.textContent = puedeEliminar()
    ? 'Puedes registrar, editar y eliminar lotes.'
    : 'Puedes registrar y editar lotes. Solo administración puede eliminarlos.';
  document.querySelector('#nuevo-lote').hidden = false;
};

// Si el servidor rechaza la sesión, se limpia y se pide entrar de nuevo
const manejarSesionVencida = (err) => {
  if (err.status === 401) {
    Sesion.cerrar();
    window.location.assign('login.html?motivo=expirada');
    return true;
  }
  return false;
};

// ---------- Resumen ----------

const cargarResumen = async () => {
  try {
    const { lotes, kilosDisponibles, valorDisponible, puntajePromedio } = await pedir('/lotes/resumen');
    document.querySelector('#r-kilos').textContent = `${formatoKilos.format(kilosDisponibles)} kg`;
    document.querySelector('#r-valor').textContent = formatoDinero.format(valorDisponible);
    document.querySelector('#r-puntaje').textContent = puntajePromedio === null ? '—' : formatoPuntaje.format(puntajePromedio);
    document.querySelector('#r-lotes').textContent = lotes;
  } catch {
    // La lista ya muestra el error de conexión; las tarjetas se quedan en "—"
  }
};

// ---------- Lista de lotes ----------

const dibujarLote = (lote) => {
  const tarjeta = crear('article', 'lote');

  const encabezado = crear('div', 'lote-encabezado');
  const titulos = crear('div');
  titulos.append(crear('p', 'lote-codigo', lote.codigo), crear('h2', 'lote-titulo', lote.parcela));
  const claseEstado = lote.estado.toLowerCase().replace(' ', '-');
  encabezado.append(titulos, crear('span', `etiqueta etiqueta-${claseEstado}`, lote.estado));

  const detalle = crear(
    'p',
    'lote-detalle',
    `${lote.variedad} · ${lote.proceso} · Cosecha ${formatoFecha.format(new Date(lote.fechaCosecha))}`,
  );

  const datos = crear('dl', 'lote-datos');
  [
    ['Kilos', formatoKilos.format(lote.kilos)],
    ['Precio/kg', formatoDinero.format(lote.precioKg)],
    ['Puntaje', lote.puntaje === undefined ? 'Sin catar' : formatoPuntaje.format(lote.puntaje)],
  ].forEach(([termino, valor]) => {
    const par = crear('div');
    par.append(crear('dt', '', termino), crear('dd', '', valor));
    datos.append(par);
  });

  tarjeta.append(encabezado, detalle, datos, crear('p', 'lote-notas', lote.notas));

  if (puedeEscribir()) {
    const acciones = crear('div', 'lote-acciones');
    const editar = crear('button', 'boton boton-secundario', 'Editar');
    editar.type = 'button';
    editar.dataset.accion = 'editar';
    editar.dataset.id = lote._id;
    editar.setAttribute('aria-label', `Editar lote ${lote.codigo}`);
    acciones.append(editar);

    if (puedeEliminar()) {
      const eliminar = crear('button', 'boton boton-secundario boton-eliminar', 'Eliminar');
      eliminar.type = 'button';
      eliminar.dataset.accion = 'eliminar';
      eliminar.dataset.id = lote._id;
      eliminar.setAttribute('aria-label', `Eliminar lote ${lote.codigo}`);
      acciones.append(eliminar);
    }
    tarjeta.append(acciones);
  }
  return tarjeta;
};

const dibujarEstadoVacio = () => {
  const hayFiltros = filtros.buscar || filtros.variedad || filtros.estado;
  const vacio = crear('div', 'estado-vacio');
  vacio.append(crear('h2', '', hayFiltros ? 'Ningún lote coincide' : 'Aún no hay lotes'));
  vacio.append(crear('p', '', hayFiltros
    ? 'Prueba con otra búsqueda o quita los filtros.'
    : 'Cuando se registre el primer lote aparecerá aquí.'));
  lista.replaceChildren(vacio);
};

const dibujarError = (mensaje) => {
  const vacio = crear('div', 'estado-vacio');
  vacio.append(crear('h2', '', 'No se pudo cargar el inventario'), crear('p', '', mensaje));
  const reintentar = crear('button', 'boton boton-secundario', 'Reintentar');
  reintentar.type = 'button';
  reintentar.addEventListener('click', () => cargarTodo());
  vacio.append(reintentar);
  lista.replaceChildren(vacio);
  conteo.textContent = '';
  document.querySelector('#paginacion').hidden = true;
};

const dibujarCargando = () => {
  lista.setAttribute('aria-busy', 'true');
  lista.replaceChildren(...Array.from({ length: LOTES_DE_CARGA }, () => crear('div', 'lote-cargando')));
};

const dibujarPaginacion = (pagina, paginas) => {
  document.querySelector('#paginacion').hidden = paginas <= 1;
  document.querySelector('#pagina-actual').textContent = `Página ${pagina} de ${paginas}`;
  document.querySelector('#pagina-anterior').disabled = pagina <= 1;
  document.querySelector('#pagina-siguiente').disabled = pagina >= paginas;
};

const cargarLotes = async ({ conEsqueleto = false } = {}) => {
  // Si llegan respuestas en desorden al escribir rápido, solo cuenta la más reciente
  ultimaConsulta += 1;
  const consulta = ultimaConsulta;
  if (conEsqueleto) dibujarCargando();

  const parametros = new URLSearchParams({ pagina: filtros.pagina, limite: LOTES_POR_PAGINA });
  ['buscar', 'variedad', 'estado'].forEach((clave) => {
    if (filtros[clave]) parametros.set(clave, filtros[clave]);
  });

  try {
    const { lotes, total, pagina, paginas } = await pedir(`/lotes?${parametros}`);
    if (consulta !== ultimaConsulta) return;

    // Al borrar el último lote de la última página, se regresa a la anterior
    if (!lotes.length && filtros.pagina > 1) {
      filtros.pagina -= 1;
      await cargarLotes();
      return;
    }

    lotesEnPantalla = lotes;
    if (lotes.length) lista.replaceChildren(...lotes.map(dibujarLote));
    else dibujarEstadoVacio();

    conteo.textContent = total === 1 ? '1 lote' : `${total} lotes`;
    dibujarPaginacion(pagina, paginas);
  } catch (err) {
    if (consulta === ultimaConsulta) dibujarError(err.message);
  } finally {
    if (consulta === ultimaConsulta) lista.setAttribute('aria-busy', 'false');
  }
};

const cargarTodo = () => Promise.all([cargarLotes({ conEsqueleto: true }), cargarResumen()]);

// ---------- Crear y editar ----------

const abrirDialogoLote = (lote = null) => {
  loteEnEdicion = lote;
  formularioLote.reset();
  limpiarErroresDeCampos(formularioLote);
  avisoLote.hidden = true;
  document.querySelector('#titulo-lote').textContent = lote ? `Editar lote ${lote.codigo}` : 'Nuevo lote';

  if (lote) {
    const { elements: campos } = formularioLote;
    ['codigo', 'parcela', 'variedad', 'proceso', 'estado', 'kilos', 'precioKg', 'notas'].forEach((nombre) => {
      campos[nombre].value = lote[nombre] ?? '';
    });
    campos.puntaje.value = lote.puntaje ?? '';
    campos.fechaCosecha.value = lote.fechaCosecha.slice(0, 10);
  }

  dialogoLote.showModal();
};

const leerFormularioLote = () => {
  const { puntaje, ...datos } = Object.fromEntries(new FormData(formularioLote));
  return puntaje === '' ? datos : { ...datos, puntaje };
};

formularioLote.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limpiarErroresDeCampos(formularioLote);
  avisoLote.hidden = true;
  botonGuardar.disabled = true;

  const editando = Boolean(loteEnEdicion);
  try {
    await pedir(editando ? `/lotes/${loteEnEdicion._id}` : '/lotes', {
      metodo: editando ? 'PUT' : 'POST',
      cuerpo: leerFormularioLote(),
    });
    dialogoLote.close();
    mostrarAvisoFlotante(editando ? 'Lote actualizado.' : 'Lote registrado.');
    await Promise.all([cargarLotes(), cargarResumen()]);
  } catch (err) {
    if (manejarSesionVencida(err)) return;
    if (err.detalles?.length) {
      mostrarErroresDeCampos(formularioLote, err.detalles);
    } else {
      avisoLote.textContent = err.message;
      avisoLote.hidden = false;
    }
  } finally {
    botonGuardar.disabled = false;
  }
});

// ---------- Eliminar ----------

const abrirDialogoEliminar = (lote) => {
  loteAEliminar = lote;
  document.querySelector('#texto-eliminar').textContent =
    `El lote ${lote.codigo} de la parcela ${lote.parcela} se borrará de forma definitiva.`;
  dialogoEliminar.showModal();
};

botonConfirmarEliminar.addEventListener('click', async () => {
  botonConfirmarEliminar.disabled = true;
  try {
    await pedir(`/lotes/${loteAEliminar._id}`, { metodo: 'DELETE' });
    dialogoEliminar.close();
    mostrarAvisoFlotante(`Lote ${loteAEliminar.codigo} eliminado.`);
    await Promise.all([cargarLotes(), cargarResumen()]);
  } catch (err) {
    if (manejarSesionVencida(err)) return;
    dialogoEliminar.close();
    mostrarAvisoFlotante(err.message, true);
  } finally {
    botonConfirmarEliminar.disabled = false;
  }
});

// ---------- Eventos ----------

document.querySelector('#nuevo-lote').addEventListener('click', () => abrirDialogoLote());

// Un solo listener para todas las tarjetas, aunque la lista se vuelva a dibujar
lista.addEventListener('click', ({ target }) => {
  const boton = target.closest('[data-accion]');
  if (!boton) return;
  const lote = lotesEnPantalla.find(({ _id }) => _id === boton.dataset.id);
  if (!lote) return;
  if (boton.dataset.accion === 'editar') abrirDialogoLote(lote);
  else abrirDialogoEliminar(lote);
});

document.querySelectorAll('[data-cerrar]').forEach((boton) => {
  boton.addEventListener('click', () => boton.closest('dialog').close());
});

document.querySelector('#filtros').addEventListener('submit', (evento) => evento.preventDefault());

let temporizadorBusqueda;
document.querySelector('#buscar').addEventListener('input', ({ target }) => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(() => {
    filtros.buscar = target.value.trim();
    filtros.pagina = 1;
    cargarLotes();
  }, ESPERA_BUSQUEDA_MS);
});

document.querySelector('#filtro-variedad').addEventListener('change', ({ target }) => {
  filtros.variedad = target.value;
  filtros.pagina = 1;
  cargarLotes();
});

document.querySelector('#filtro-estado').addEventListener('click', ({ target }) => {
  const chip = target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#filtro-estado .chip').forEach((otro) => {
    otro.setAttribute('aria-pressed', String(otro === chip));
  });
  filtros.estado = chip.dataset.estado;
  filtros.pagina = 1;
  cargarLotes();
});

document.querySelector('#pagina-anterior').addEventListener('click', () => {
  filtros.pagina -= 1;
  cargarLotes();
});

document.querySelector('#pagina-siguiente').addEventListener('click', () => {
  filtros.pagina += 1;
  cargarLotes();
});

// ---------- Inicio ----------

// Una sesión guardada puede haber expirado desde la última visita; se confirma con el
// servidor y de paso se actualiza el rol por si cambió
const confirmarSesion = async () => {
  if (!Sesion.token) return;
  try {
    const { usuario } = await pedir('/auth/perfil');
    Sesion.guardar({ token: Sesion.token, usuario });
  } catch (err) {
    manejarSesionVencida(err);
  }
};

const iniciar = async () => {
  await confirmarSesion();
  dibujarSesion();
  await cargarTodo();
};

iniciar();
