'use strict';

// Pruebas de la API contra un MongoDB real en memoria
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'clave-solo-para-pruebas-automatizadas-0123456789';
process.env.MONGODB_URI = 'mongodb://se-reemplaza-en-before';
process.env.CORS_ORIGENES = 'http://permitido.test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');

const app = require('../src/app');
const Usuario = require('../src/models/Usuario');
const Lote = require('../src/models/Lote');

const PASSWORD = 'contrasena-de-prueba';
const LOTE = {
  codigo: 'MN-2026-100',
  parcela: 'La Neblina',
  variedad: 'Geisha',
  proceso: 'Lavado',
  estado: 'En bodega',
  kilos: 100,
  precioKg: 500,
  puntaje: 88,
  fechaCosecha: '2026-02-01',
  notas: 'Prueba',
};

let mongo;
let tokenOperador;
let tokenAdmin;

const entrar = async (correo) => {
  const res = await request(app).post('/api/auth/login').send({ correo, password: PASSWORD });
  return res.body.token;
};
const conToken = (peticion, token) => peticion.set('Authorization', `Bearer ${token}`);

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Usuario.init(), Lote.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Usuario.deleteMany(), Lote.deleteMany()]);
  await Usuario.create({ nombre: 'Operador', correo: 'op@test.mx', password: PASSWORD });
  await Usuario.create({ nombre: 'Admin', correo: 'admin@test.mx', password: PASSWORD, rol: 'admin' });
  tokenOperador = await entrar('op@test.mx');
  tokenAdmin = await entrar('admin@test.mx');
});

// ---------- Autenticación ----------

test('registro crea un operador aunque el cliente pida rol admin, y no devuelve el hash', async () => {
  const res = await request(app).post('/api/auth/registro')
    .send({ nombre: 'Nueva', correo: 'NUEVA@test.mx', password: PASSWORD, rol: 'admin' });
  assert.equal(res.status, 201);
  assert.equal(res.body.usuario.rol, 'operador');
  assert.equal(res.body.usuario.correo, 'nueva@test.mx');
  assert.equal(res.body.usuario.password, undefined);

  const guardado = await Usuario.findOne({ correo: 'nueva@test.mx' }).select('+password');
  assert.notEqual(guardado.password, PASSWORD);
});

test('registro con correo repetido responde 409', async () => {
  const res = await request(app).post('/api/auth/registro')
    .send({ nombre: 'Otra', correo: 'op@test.mx', password: PASSWORD });
  assert.equal(res.status, 409);
});

test('registro con datos inválidos responde 400 con el detalle por campo', async () => {
  const res = await request(app).post('/api/auth/registro').send({ nombre: 'A', correo: 'no-correo', password: '123' });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.detalles.map((d) => d.campo).sort(), ['correo', 'nombre', 'password']);
});

test('login con contraseña o correo incorrectos responde 401 con el mismo mensaje', async () => {
  const mala = await request(app).post('/api/auth/login').send({ correo: 'op@test.mx', password: 'incorrecta' });
  const nadie = await request(app).post('/api/auth/login').send({ correo: 'nadie@test.mx', password: 'incorrecta' });
  assert.equal(mala.status, 401);
  assert.equal(nadie.status, 401);
  assert.equal(mala.body.error, nadie.body.error);
});

test('login rechaza inyección NoSQL en el correo y la contraseña', async () => {
  const res = await request(app).post('/api/auth/login').send({ correo: { $ne: null }, password: { $ne: null } });
  assert.equal(res.status, 400);
});

test('perfil exige token y lo acepta cuando es válido', async () => {
  assert.equal((await request(app).get('/api/auth/perfil')).status, 401);
  const res = await conToken(request(app).get('/api/auth/perfil'), tokenAdmin);
  assert.equal(res.status, 200);
  assert.equal(res.body.usuario.rol, 'admin');
});

test('rechaza tokens expirados, alterados y firmados con otra clave o alg none', async () => {
  const { id } = (await Usuario.findOne({ correo: 'admin@test.mx' }));
  const expirado = jwt.sign({}, process.env.JWT_SECRET, { subject: id, expiresIn: -10 });
  const otraClave = jwt.sign({}, 'otra-clave-que-no-es-la-del-servidor-000000', { subject: id });
  const sinFirma = jwt.sign({}, '', { subject: id, algorithm: 'none' });

  const resExpirado = await conToken(request(app).get('/api/auth/perfil'), expirado);
  assert.equal(resExpirado.status, 401);
  assert.match(resExpirado.body.error, /expiró/);

  for (const token of [otraClave, sinFirma, `${tokenAdmin}x`]) {
    assert.equal((await conToken(request(app).get('/api/auth/perfil'), token)).status, 401);
  }
});

test('un token deja de servir si la cuenta se elimina', async () => {
  await Usuario.deleteOne({ correo: 'op@test.mx' });
  assert.equal((await conToken(request(app).get('/api/auth/perfil'), tokenOperador)).status, 401);
});

// ---------- CRUD ----------

test('flujo CRUD completo: crear, leer, actualizar y eliminar', async () => {
  const creado = await conToken(request(app).post('/api/lotes'), tokenOperador).send(LOTE);
  assert.equal(creado.status, 201);
  const { _id: id } = creado.body.lote;

  const leido = await request(app).get(`/api/lotes/${id}`);
  assert.equal(leido.status, 200);
  assert.equal(leido.body.lote.codigo, LOTE.codigo);

  const actualizado = await conToken(request(app).put(`/api/lotes/${id}`), tokenOperador)
    .send({ ...LOTE, kilos: 80, estado: 'Vendido' });
  assert.equal(actualizado.status, 200);
  assert.equal(actualizado.body.lote.kilos, 80);
  assert.equal((await Lote.findById(id)).estado, 'Vendido');

  const eliminado = await conToken(request(app).delete(`/api/lotes/${id}`), tokenAdmin);
  assert.equal(eliminado.status, 204);
  assert.equal((await request(app).get(`/api/lotes/${id}`)).status, 404);
});

test('actualizar sin puntaje borra la catación anterior', async () => {
  const { body } = await conToken(request(app).post('/api/lotes'), tokenOperador).send(LOTE);
  const { puntaje, ...sinPuntaje } = LOTE;
  const res = await conToken(request(app).put(`/api/lotes/${body.lote._id}`), tokenOperador).send(sinPuntaje);
  assert.equal(res.status, 200);
  assert.equal(res.body.lote.puntaje, undefined);
});

test('permisos: leer es público, escribir pide sesión y eliminar pide rol admin', async () => {
  const lote = await Lote.create(LOTE);

  assert.equal((await request(app).get('/api/lotes')).status, 200);
  assert.equal((await request(app).post('/api/lotes').send(LOTE)).status, 401);
  assert.equal((await request(app).put(`/api/lotes/${lote.id}`).send(LOTE)).status, 401);
  assert.equal((await request(app).delete(`/api/lotes/${lote.id}`)).status, 401);
  assert.equal((await conToken(request(app).delete(`/api/lotes/${lote.id}`), tokenOperador)).status, 403);
  assert.ok(await Lote.findById(lote.id), 'el operador no debe poder eliminar');
});

test('crear valida cada campo y no acepta campos ajenos', async () => {
  const invalido = await conToken(request(app).post('/api/lotes'), tokenOperador)
    .send({ ...LOTE, codigo: 'X1', kilos: -5, puntaje: 101, variedad: 'Robusta', fechaCosecha: '2999-01-01' });
  assert.equal(invalido.status, 400);
  assert.deepEqual(
    invalido.body.detalles.map((d) => d.campo).sort(),
    ['codigo', 'fechaCosecha', 'kilos', 'puntaje', 'variedad'],
  );

  const ajeno = await conToken(request(app).post('/api/lotes'), tokenOperador)
    .send({ ...LOTE, creadoPor: '507f1f77bcf86cd799439011' });
  assert.notEqual(ajeno.body.lote.creadoPor, '507f1f77bcf86cd799439011');
});

test('código repetido responde 409, también al editar', async () => {
  await conToken(request(app).post('/api/lotes'), tokenOperador).send(LOTE);
  const repetido = await conToken(request(app).post('/api/lotes'), tokenOperador).send(LOTE);
  assert.equal(repetido.status, 409);

  const otro = await conToken(request(app).post('/api/lotes'), tokenOperador).send({ ...LOTE, codigo: 'MN-2026-101' });
  const edicion = await conToken(request(app).put(`/api/lotes/${otro.body.lote._id}`), tokenOperador).send(LOTE);
  assert.equal(edicion.status, 409);
});

test('id mal formado responde 400 e id inexistente responde 404', async () => {
  assert.equal((await request(app).get('/api/lotes/no-es-un-id')).status, 400);
  assert.equal((await request(app).get('/api/lotes/507f1f77bcf86cd799439011')).status, 404);
});

test('listado filtra, busca y pagina', async () => {
  await Lote.create([
    LOTE,
    { ...LOTE, codigo: 'MN-2026-101', variedad: 'Bourbon', estado: 'Vendido', parcela: 'El Mirador' },
    { ...LOTE, codigo: 'MN-2026-102', variedad: 'Typica', parcela: 'Los (Encinos)' },
  ]);

  assert.equal((await request(app).get('/api/lotes?estado=Vendido')).body.total, 1);
  assert.equal((await request(app).get('/api/lotes?variedad=Typica')).body.total, 1);
  assert.equal((await request(app).get('/api/lotes?buscar=mirador')).body.total, 1);
  // Los caracteres especiales se buscan como texto, no como expresión regular
  assert.equal((await request(app).get('/api/lotes?buscar=(Encinos')).body.total, 1);
  assert.equal((await request(app).get('/api/lotes?buscar=.*')).body.total, 0);
  assert.equal((await request(app).get('/api/lotes?estado=Inventado')).status, 400);

  const pagina = await request(app).get('/api/lotes?limite=2&pagina=2');
  assert.equal(pagina.body.lotes.length, 1);
  assert.equal(pagina.body.paginas, 2);
});

test('resumen excluye lo vendido de los kilos y del valor', async () => {
  await Lote.create([LOTE, { ...LOTE, codigo: 'MN-2026-101', estado: 'Vendido', puntaje: 84 }]);
  const { body } = await request(app).get('/api/lotes/resumen');
  assert.deepEqual(body, { lotes: 2, kilosDisponibles: 100, valorDisponible: 50000, puntajePromedio: 86 });
});

test('resumen con el inventario vacío responde en ceros', async () => {
  const { body } = await request(app).get('/api/lotes/resumen');
  assert.deepEqual(body, { lotes: 0, kilosDisponibles: 0, valorDisponible: 0, puntajePromedio: null });
});

// ---------- Middleware general ----------

test('errores: ruta inexistente responde 404 JSON y JSON roto responde 400', async () => {
  const noExiste = await request(app).get('/api/inexistente');
  assert.equal(noExiste.status, 404);
  assert.ok(noExiste.body.error);

  const roto = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"correo":');
  assert.equal(roto.status, 400);
});

test('CORS permite los orígenes configurados, incluido el preflight, y bloquea los demás', async () => {
  const preflight = await request(app).options('/api/lotes')
    .set('Origin', 'http://permitido.test').set('Access-Control-Request-Method', 'POST');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://permitido.test');

  const bloqueado = await request(app).get('/api/lotes').set('Origin', 'http://ajeno.test');
  assert.equal(bloqueado.status, 403);
});

test('CORS permite el mismo origen aunque no esté en la lista, como el POST del frontend desplegado', async () => {
  const servidor = app.listen(0);
  try {
    const { port } = servidor.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({ correo: 'op@test.mx', password: PASSWORD }),
    });
    assert.equal(res.status, 200);
  } finally {
    servidor.close();
  }
});

test('salud informa el estado de la base de datos', async () => {
  const { status, body } = await request(app).get('/api/salud');
  assert.equal(status, 200);
  assert.equal(body.estado, 'ok');
});
