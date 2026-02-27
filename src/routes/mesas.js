const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { fusionarMesas, obtenerMesas } = require('../controllers/mesasController');

const router = express.Router();

router.get('/', verificarToken, verificarRol([1, 2, 3]), obtenerMesas);
router.post('/fusionar', verificarToken, verificarRol([1, 2]), fusionarMesas);

module.exports = router;
