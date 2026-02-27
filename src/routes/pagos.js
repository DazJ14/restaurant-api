const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { obtenerCuenta, procesarPago } = require('../controllers/pagosController');

const router = express.Router();

router.get('/cuenta/:cuenta_id', verificarToken, verificarRol([1, 2, 3]), obtenerCuenta);
router.post('/pagar', verificarToken, verificarRol([1, 2, 3]), procesarPago);

module.exports = router;
