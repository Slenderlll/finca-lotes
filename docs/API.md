# Referencia de la API

URL base: `http://localhost:3000/api` en local. Todas las respuestas son JSON.

Las rutas protegidas piden el encabezado `Authorization: Bearer <token>`. El token se obtiene al iniciar sesión o registrarse y dura 2 horas (`JWT_EXPIRA`).

## Resumen

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/salud` | Público | Estado del servidor y de la base de datos |
| POST | `/auth/registro` | Público | Crea una cuenta con rol `operador` |
| POST | `/auth/login` | Público | Inicia sesión |
| GET | `/auth/perfil` | Con sesión | Datos del usuario actual |
| GET | `/lotes` | Público | Lista lotes con filtros y paginación |
| GET | `/lotes/resumen` | Público | Totales del inventario |
| GET | `/lotes/:id` | Público | Un lote |
| POST | `/lotes` | Con sesión | Crea un lote |
| PUT | `/lotes/:id` | Con sesión | Reemplaza los datos de un lote |
| DELETE | `/lotes/:id` | Rol `admin` | Elimina un lote |

## Autenticación

### POST /auth/registro

```json
{ "nombre": "Ana López", "correo": "ana@montenublado.mx", "password": "cafe-de-altura-2026" }
```

La contraseña lleva de 8 a 72 caracteres. Responde `201`:

```json
{
  "token": "eyJhbGciOi...",
  "usuario": { "id": "66f...", "nombre": "Ana López", "correo": "ana@montenublado.mx", "rol": "operador" }
}
```

Si el correo ya existe, responde `409`.

### POST /auth/login

```json
{ "correo": "ana@montenublado.mx", "password": "cafe-de-altura-2026" }
```

Responde `200` con la misma forma que el registro, o `401` si las credenciales son incorrectas. Permite 30 intentos cada 15 minutos por IP (compartidos con el registro); después responde `429`.

### GET /auth/perfil

Responde `200` con `{ "usuario": { ... } }`.

## Lotes

### Campos

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `codigo` | texto | Sí | Formato `MN-2026-001`; único |
| `parcela` | texto | Sí | De 2 a 60 caracteres |
| `variedad` | texto | Sí | `Typica`, `Bourbon`, `Geisha`, `Caturra` o `Marsellesa` |
| `proceso` | texto | Sí | `Lavado`, `Honey` o `Natural` |
| `estado` | texto | No | `En secado` (por defecto), `En bodega` o `Vendido` |
| `kilos` | número | Sí | Mayor o igual a 0 |
| `precioKg` | número | Sí | Mayor o igual a 0, en MXN |
| `puntaje` | número | No | De 0 a 100; sin él, el lote aún no tiene catación |
| `fechaCosecha` | fecha ISO | Sí | No puede estar en el futuro |
| `notas` | texto | No | Hasta 300 caracteres |

### GET /lotes

Parámetros opcionales:

| Parámetro | Descripción |
|---|---|
| `buscar` | Texto en código, parcela o notas, sin distinguir mayúsculas |
| `estado` | Filtra por estado |
| `variedad` | Filtra por variedad |
| `pagina` | Página, desde 1 |
| `limite` | Resultados por página, de 1 a 100; por defecto 12 |

Ejemplo: `GET /lotes?estado=En%20bodega&variedad=Geisha&pagina=1`

```json
{
  "lotes": [
    {
      "_id": "66f...",
      "codigo": "MN-2026-001",
      "parcela": "La Neblina",
      "variedad": "Geisha",
      "proceso": "Lavado",
      "estado": "En bodega",
      "kilos": 320,
      "precioKg": 780,
      "puntaje": 89.5,
      "fechaCosecha": "2026-02-12T00:00:00.000Z",
      "notas": "Jazmín, bergamota y durazno blanco."
    }
  ],
  "total": 1,
  "pagina": 1,
  "paginas": 1
}
```

### GET /lotes/resumen

`kilosDisponibles` y `valorDisponible` no cuentan los lotes vendidos.

```json
{ "lotes": 8, "kilosDisponibles": 6500, "valorDisponible": 1995300, "puntajePromedio": 85.63 }
```

### GET /lotes/:id

Responde `200` con `{ "lote": { ... } }`, `404` si no existe o `400` si el id está mal formado.

### POST /lotes

Requiere sesión. Responde `201` con `{ "lote": { ... } }`, o `409` si el código ya existe.

```json
{
  "codigo": "MN-2026-009",
  "parcela": "La Neblina",
  "variedad": "Geisha",
  "proceso": "Natural",
  "estado": "En bodega",
  "kilos": 500,
  "precioKg": 600,
  "puntaje": 88.5,
  "fechaCosecha": "2026-03-20",
  "notas": "Fresa y vino tinto."
}
```

### PUT /lotes/:id

Requiere sesión. Recibe el mismo cuerpo que `POST` y reemplaza los datos: si se omite `puntaje`, se borra la catación que tuviera el lote. Responde `200` con `{ "lote": { ... } }`.

### DELETE /lotes/:id

Requiere rol `admin`. Responde `204` sin cuerpo.

## Errores

Todos los errores tienen la misma forma. Los de validación incluyen además `detalles`, con un mensaje por campo:

```json
{
  "error": "Los datos enviados no son válidos.",
  "detalles": [
    { "campo": "codigo", "mensaje": "Usa el formato MN-2026-001." },
    { "campo": "kilos", "mensaje": "Los kilos deben ser un número mayor o igual a 0." }
  ]
}
```

| Código | Significado |
|---|---|
| 400 | Datos no válidos o JSON mal formado |
| 401 | Falta el token, no es válido o expiró; o credenciales incorrectas |
| 403 | Sesión válida sin permiso suficiente, u origen bloqueado por CORS |
| 404 | La ruta o el lote no existen |
| 409 | Código de lote o correo repetido |
| 413 | Cuerpo de la petición demasiado grande |
| 429 | Demasiados intentos de inicio de sesión o registro |
| 500 | Error interno; el detalle solo queda en el registro del servidor |
