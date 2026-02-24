const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', verificarToken, verificarRol([1, 2, 3]), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mesas ORDER BY numero ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener mesas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const fusionSchema = z.object({
  mesa_principal_id: z.number().int().positive("ID de mesa principal inválido"),
  mesas_a_fusionar: z.array(z.number().int().positive()).min(1, "Debes incluir al menos una mesa para fusionar")
});

router.post('/fusionar', verificarToken, verificarRol([1, 2]), async (req, res) => {
  try {
    const datosValidados = fusionSchema.parse(req.body);
    const { mesa_principal_id, mesas_a_fusionar } = datosValidados;

    await pool.query('BEGIN');

    await pool.query(
      `UPDATE mesas SET estado = 'ocupada' WHERE id = $1`,
      [mesa_principal_id]
    );

    await pool.query(
      `UPDATE mesas SET estado = 'ocupada', mesa_padre_id = $1 WHERE id = ANY($2::int[])`,
      [mesa_principal_id, mesas_a_fusionar]
    );

    await pool.query('COMMIT');

    const io = req.app.get('io');
    io.emit('mesas_actualizadas', { 
      mensaje: 'El estado de las mesas ha cambiado',
      accion: 'fusion_y_ocupacion'
    });

    res.json({ mensaje: 'Mesas fusionadas y ocupadas exitosamente' });

  } catch (error) {
    await pool.query('ROLLBACK');
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errores: error.errors.map(e => e.message) });
    }
    
    console.error('Error al fusionar mesas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
