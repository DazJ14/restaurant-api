const bcrypt = require('bcrypt');
const { z } = require('zod');
const pool = require('../db');

const usuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rol_id: z.number().int().positive("El ID del rol debe ser un número válido")
});

const crearUsuario = async (req, res) => {
  try {
    const datosValidados = usuarioSchema.parse(req.body);

    const userExists = await pool.query('SELECT id FROM usuarios WHERE username = $1', [datosValidados.username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(datosValidados.password, saltRounds);

    const newUser = await pool.query(
      `INSERT INTO usuarios (nombre, username, password_hash, rol_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, nombre, username, rol_id, activo, creado_en`,
      [datosValidados.nombre, datosValidados.username, passwordHash, datosValidados.rol_id]
    );

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario: newUser.rows[0]
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errores: error.errors.map(e => e.message) });
    }
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  crearUsuario
};