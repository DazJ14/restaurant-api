const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { obtenerPendientes, cambiarEstadoPedido } = require('../controllers/cocinaController');

const router = express.Router();

router.get('/pendientes', verificarToken, verificarRol([1, 4]), obtenerPendientes);
router.patch('/pedidos/:id/estado', verificarToken, verificarRol([1, 4]), cambiarEstadoPedido);

module.exports = router;
