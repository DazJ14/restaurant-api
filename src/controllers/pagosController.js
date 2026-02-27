// src/controllers/pagosController.js
const { z } = require('zod');
const pool = require('../db');

const obtenerCuenta = async (req, res) => {
  const { cuenta_id } = req.params;
  try {
    const query = `
      SELECT p.cliente_nombre, SUM(prod.precio * p.cantidad) as total_a_pagar,
             json_agg(json_build_object('platillo', prod.nombre, 'cantidad', p.cantidad, 'precio_unitario', prod.precio)) as detalle
      FROM pedidos p JOIN productos prod ON p.producto_id = prod.id
      WHERE p.cuenta_id = $1 GROUP BY p.cliente_nombre;
    `;
    const result = await pool.query(query, [cuenta_id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cuenta no encontrada' });
    const granTotal = result.rows.reduce((acc, curr) => acc + parseFloat(curr.total_a_pagar), 0);

    res.json({ cuenta_id: parseInt(cuenta_id), gran_total: granTotal, cuentas_separadas: result.rows });
  } catch (error) {
    console.error('Error al obtener cuenta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const pagoSchema = z.object({
  cuenta_id: z.number().int().positive(),
  pagos: z.array(z.object({
    cliente_nombre: z.string().min(1), monto: z.number().positive(), metodo_pago: z.enum(['efectivo', 'terminal'])
  })).min(1, "Debe registrar al menos un pago")
});

const procesarPago = async (req, res) => {
  try {
    const { cuenta_id, pagos } = pagoSchema.parse(req.body);
    await pool.query('BEGIN');

    for (const pago of pagos) {
      await pool.query(`INSERT INTO pagos (cuenta_id, monto, metodo_pago, cliente_nombre) VALUES ($1, $2, $3, $4)`, 
        [cuenta_id, pago.monto, pago.metodo_pago, pago.cliente_nombre]);
    }

    await pool.query(`UPDATE cuentas SET estado = 'pagada' WHERE id = $1`, [cuenta_id]);
    
    const mesaRes = await pool.query(`SELECT mesa_id FROM cuentas WHERE id = $1`, [cuenta_id]);
    const mesaPrincipalId = mesaRes.rows[0].mesa_id;

    await pool.query(`UPDATE mesas SET estado = 'disponible', mesa_padre_id = NULL WHERE id = $1 OR mesa_padre_id = $1`, [mesaPrincipalId]);
    await pool.query('COMMIT');

    const io = req.app.get('io');
    io.emit('mesas_actualizadas', { mensaje: `Mesa ${mesaPrincipalId} liberada`, accion: 'liberacion' });

    res.json({ mensaje: 'Pago procesado y mesa liberada exitosamente' });
  } catch (error) {
    await pool.query('ROLLBACK');
    if (error instanceof z.ZodError) return res.status(400).json({ errores: error.errors });
    console.error('Error al procesar pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { obtenerCuenta, procesarPago };