# Finca Monte Nublado · Inventario de lotes de café

Aplicación full stack para registrar los lotes de café de una finca: de qué parcela vienen, cuántos kilos hay, a qué precio, con qué puntaje de catación y en qué estado están.

Avance del reto · Desarrollo Full Stack · Universidad Tecmilenio

**Tecnologías:** Node.js, Express, MongoDB (Mongoose), JWT, bcryptjs, express-validator, HTML, CSS y JavaScript.

## Reglas de negocio

| Acción | Sin sesión | Operador | Admin |
|---|---|---|---|
| Consultar lotes y resumen | ✅ | ✅ | ✅ |
| Crear y editar lotes | ❌ 401 | ✅ | ✅ |
| Eliminar lotes | ❌ 401 | ❌ 403 | ✅ |

Toda cuenta nueva es `operador`. El rol `admin` solo lo crea `npm run seed`.

## Estructura

```
finca-lotes/
├── api/index.js            # Punto de entrada en Vercel
├── backend/
│   ├── src/
│   │   ├── config/         # Variables de entorno (env.js) y conexión a MongoDB (db.js)
│   │   ├── models/         # Esquemas de Mongoose: Usuario, Lote
│   │   ├── controllers/    # Lógica de cada endpoint
│   │   ├── routes/         # URLs de la API y sus middleware
│   │   ├── middleware/     # auth (JWT y roles), validaciones, errores
│   │   ├── app.js          # Configuración de Express
│   │   └── server.js       # Punto de entrada: conecta la BD y abre el puerto
│   ├── scripts/            # seed.js (datos iniciales), db-local.js (MongoDB sin instalar)
│   └── tests/              # Pruebas de la API
├── frontend/
│   ├── index.html          # Página principal: inventario
│   ├── login.html          # Inicio de sesión y registro
│   ├── css/                # base.css, login.css, app.css
│   ├── js/                 # api.js (fetch y sesión), login.js, app.js
│   └── img/
├── docs/
│   ├── API.md              # Referencia de endpoints
│   ├── finca-lotes.postman_collection.json
│   └── capturas/
├── .env.example            # Plantilla de variables de entorno
├── vercel.json             # Despliegue en Vercel
└── render.yaml             # Alternativa: despliegue en Render
```

Una petición recorre: `routes` → `middleware` (autenticación y validación) → `controllers` → `models` → MongoDB. Cualquier error llega a `middleware/errores.js`, que responde siempre con JSON. Express también sirve la carpeta `frontend/`, así que todo corre en un solo servidor.

## Cómo ejecutarlo en local

Requiere Node.js 22.

```bash
npm install
cp .env.example .env     # Llena JWT_SECRET y ADMIN_PASSWORD
```

Genera el valor de `JWT_SECRET` con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Necesitas un MongoDB al que apunte `MONGODB_URI`. Puede ser tu instalación local, MongoDB Atlas o, sin instalar nada, este comando en una terminal aparte (la primera vez descarga unos 780 MB):

```bash
npm run db:local
```

Después:

```bash
npm run seed    # Crea el admin y 8 lotes de ejemplo; no borra nada si ya existen
npm run dev     # http://localhost:3000
npm test        # Pruebas de la API (usan una base de datos temporal, no la tuya)
```

## Despliegue en la nube (Vercel + MongoDB Atlas)

1. **Atlas:** crea un clúster gratuito M0 y un usuario de base de datos. En *Network Access* permite `0.0.0.0/0`, porque las IP de salida de Vercel cambian. Copia la cadena de conexión y agrega el nombre de la base: `mongodb+srv://USUARIO:CLAVE@cluster.mongodb.net/finca_lotes`.
2. **Vercel:** *Add New → Project*, importa este repositorio y, antes de desplegar, agrega las variables `MONGODB_URI` (la cadena de Atlas) y `JWT_SECRET` (genérala con el comando de arriba). `vercel.json` y `api/index.js` hacen el resto.
3. **Datos iniciales:** en tu computadora, apunta `MONGODB_URI` de tu `.env` a Atlas y corre `npm run seed`. Elige para `ADMIN_PASSWORD` una contraseña larga, porque esa cuenta quedará en internet.

En Vercel la app corre como función bajo demanda: `api/index.js` reemplaza a `server.js`. El límite de intentos de inicio de sesión se cuenta por instancia, así que allí es menos estricto que en un servidor único.

`render.yaml` queda como alternativa para desplegar en Render (*New → Blueprint*).

## Documentación de la API

Consulta [docs/API.md](docs/API.md). Para probarla con Postman, importa [la colección](docs/finca-lotes.postman_collection.json): al iniciar sesión guarda el token automáticamente.
