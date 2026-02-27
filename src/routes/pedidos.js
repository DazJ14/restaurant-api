const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { obtenerMenu, abrirCuenta, tomarOrden } = require('../controllers/pedidosController');

const router = express.Router();

router.get('/menu', verificarToken, verificarRol([1, 2, 3]), obtenerMenu);

const cuentaSchema = z.object({
  mesa_id: z.number().int().positive("ID de mesa inválido")
});

router.post('/abrir-cuenta', verificarToken, verificarRol([1, 3]), abrirCuenta);

const ordenSchema = z.object({
  cuenta_id: z.number().int().positive(),
  platillos: z.array(z.object({
    producto_id: z.number().int().positive(),
    cantidad: z.number().int().positive(),
    cliente_nombre: z.string().min(1, "Debes identificar quién pidió esto")
  })).min(1, "La orden no puede estar vacía")
});

router.post('/ordenar', verificarToken, verificarRol([1, 3]), tomarOrden);

module.exports = router;
