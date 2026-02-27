// src/controllers/cocinaController.js
const { z } = require('zod');
const pool = require('../db');

const obtenerPendientes = async (req, res) => {
  try {
    const query = `
      SELECT p.id as pedido_id, p.cantidad, p.cliente_nombre, p.estado, p.creado_en,
             prod.nombre as platillo, m.numero as mesa_numero
      FROM pedidos p
      JOIN productos prod ON p.producto_id = prod.id
      JOIN cuentas c ON p.cuenta_id = c.id
      JOIN mesas m ON c.mesa_id = m.id
      WHERE p.estado IN ('pendiente', 'preparando')
      ORDER BY p.creado_en ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const estadoSchema = z.object({
  nuevo_estado: z.enum(['preparando', 'listo', 'entregado'], {
    errorMap: () => ({ message: "El estado debe ser 'preparando', 'listo' o 'entregado'" })
  })
});

const cambiarEstadoPedido = async (req, res) => {
  const pedidoId = req.params.id;
  try {
    const { nuevo_estado } = estadoSchema.parse(req.body);
    const result = await pool.query(`
      UPDATE pedidos SET estado = $1 WHERE id = $2 
      RETURNING id, cuenta_id, producto_id, cantidad, cliente_nombre, estado
    `, [nuevo_estado, pedidoId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedidoActualizado = result.rows[0];

    // Emitir socket si está listo
    if (nuevo_estado === 'listo') {
      const io = req.app.get('io');
      const mesaQuery = await pool.query(`
        SELECT m.numero FROM cuentas c JOIN mesas m ON c.mesa_id = m.id WHERE c.id = $1
      `, [pedidoActualizado.cuenta_id]);
      
      io.emit('pedido_listo_para_entregar', {
        mensaje: `¡Platillo listo para la Mesa ${mesaQuery.rows[0].numero}!`,
        mesa: mesaQuery.rows[0].numero,
        cliente: pedidoActualizado.cliente_nombre,
        pedido_id: pedidoActualizado.id
      });
    }

    res.json({ mensaje: `Estado actualizado a '${nuevo_estado}'`, pedido: pedidoActualizado });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ errores: error.errors });
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { obtenerPendientes, cambiarEstadoPedido };