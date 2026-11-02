'use strict';

// Pruebas de la función de Vercel (api/index.js): conexión a la base de datos y frontend
const net = require('node:net');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');

let mongo;
let puerto;
let funcion;

const puertoLibre = () => new Promise((resolver, rechazar) => {
  const servidor = net.createServer();
  servidor.once('error', rechazar);
  servidor.listen(0, '127.0.0.1', () => {
    const { port } = servidor.address();
    servidor.close(() => resolver(port));
  });
});

before(async () => {
  puerto = await puertoLibre();
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'clave-solo-para-pruebas-automatizadas-0123456789';
  process.env.MONGODB_URI = `mongodb://127.0.0.1:${puerto}/finca_vercel`;
  funcion = require('../../api/index');
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

// Las pruebas corren en orden: la primera todavía no tiene base de datos
test('sin base de datos responde 503 en JSON y no se queda colgada', { timeout: 20000 }, async () => {
  const res = await request(funcion).get('/api/lotes');
  assert.equal(res.status, 503);
  assert.match(res.body.error, /Base de datos/);
});

test('se recupera sola cuando la base de datos vuelve', async () => {
  mongo = await MongoMemoryServer.create({ instance: { port: puerto } });
  const res = await request(funcion).get('/api/salud');
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'ok');
});

test('sirve el frontend con sus cabeceras de seguridad', async () => {
  const inicio = await request(funcion).get('/');
  assert.equal(inicio.status, 200);
  assert.match(inicio.headers['content-type'], /html/);
  assert.ok(inicio.headers['content-security-policy']);

  assert.equal((await request(funcion).get('/login.html')).status, 200);
  assert.equal((await request(funcion).get('/css/base.css')).status, 200);
  assert.equal((await request(funcion).get('/no-existe')).status, 404);
});

test('la API funciona a través de la función', async () => {
  const lotes = await request(funcion).get('/api/lotes');
  assert.equal(lotes.status, 200);

  const login = await request(funcion)
    .post('/api/auth/login')
    .send({ correo: 'nadie@test.mx', password: 'contrasena-de-prueba' });
  assert.equal(login.status, 401);
});
