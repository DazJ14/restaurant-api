// src/controllers/mesasController.js
const { z } = require('zod');
const pool = require('../db');

const obtenerMesas = async (req, res) => {
  try {
    // Hacemos un LEFT JOIN para traer la mesa y, SI TIENE una cuenta abierta, traer su ID
    const query = `
      SELECT 
        m.id, 
        m.numero, 
        m.capacidad, 
        m.estado, 
        m.mesa_padre_id,
        c.id AS cuenta_activa_id
      FROM mesas m
      LEFT JOIN cuentas c ON m.id = c.mesa_id AND c.estado = 'abierta'
      ORDER BY m.numero ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener mesas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const fusionSchema = z.object({
  mesa_principal_id: z.number().int().positive("ID de mesa principal inválido"),
  mesas_a_fusionar: z.array(z.number().int().positive()).min(1, "Debes incluir al menos una mesa para fusionar")
});

const fusionarMesas = async (req, res) => {
  try {
    const { mesa_principal_id, mesas_a_fusionar } = fusionSchema.parse(req.body);

    await pool.query('BEGIN');
    await pool.query(`UPDATE mesas SET estado = 'ocupada' WHERE id = $1`, [mesa_principal_id]);
    await pool.query(
      `UPDATE mesas SET estado = 'ocupada', mesa_padre_id = $1 WHERE id = ANY($2::int[])`,
      [mesa_principal_id, mesas_a_fusionar]
    );
    await pool.query('COMMIT');

    const io = req.app.get('io');
    io.emit('mesas_actualizadas', { mensaje: 'El estado de las mesas ha cambiado', accion: 'fusion_y_ocupacion' });

    res.json({ mensaje: 'Mesas fusionadas y ocupadas exitosamente' });
  } catch (error) {
    await pool.query('ROLLBACK');
    if (error instanceof z.ZodError) return res.status(400).json({ errores: error.errors.map(e => e.message) });
    console.error('Error al fusionar mesas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { obtenerMesas, fusionarMesas };