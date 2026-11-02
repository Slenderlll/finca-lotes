'use strict';

const { Router } = require('express');
const { autenticar, permitirRoles } = require('../middleware/auth');
const { reglasId, reglasLote, reglasListado } = require('../middleware/validaciones');
const { listar, resumen, obtener, crear, actualizar, eliminar } = require('../controllers/lotes.controller');

const router = Router();

// Reglas de negocio:
// - Consultar el inventario es público.
// - Crear y editar requiere una sesión (operador o admin).
// - Eliminar queda reservado al admin, porque borra un registro de forma definitiva.
router.get('/', reglasListado, listar);
router.get('/resumen', resumen); // antes de /:id para que "resumen" no se tome como un id
router.get('/:id', reglasId, obtener);

router.post('/', autenticar, reglasLote, crear);
router.put('/:id', autenticar, reglasId, reglasLote, actualizar);
router.delete('/:id', autenticar, permitirRoles('admin'), reglasId, eliminar);

module.exports = router;
