const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { crearUsuario } = require('../controllers/usuariosController');

const router = express.Router();

const usuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rol_id: z.number().int().positive("El ID del rol debe ser un número válido")
});

router.post('/', verificarToken, verificarRol([1]), crearUsuario);

module.exports = router;
