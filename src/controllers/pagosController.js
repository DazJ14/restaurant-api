// src/controllers/pagosController.js
const { z } = require('zod');
const pool = require('../db');

/* ======================================================
   OBTENER CUENTA
====================================================== */
const obtenerCuenta = async (req, res) => {
  const { cuenta_id } = req.params;

  try {
    // 1️⃣ Verificar que la cuenta exista
    const cuentaExiste = await pool.query(
      `SELECT id, estado FROM cuentas WHERE id = $1`,
      [cuenta_id]
    );

    if (cuentaExiste.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no existe' });
    }

    // 2️⃣ Obtener pedidos asociados (pueden no existir aún)
    const query = `
      SELECT 
        p.cliente_nombre,
        SUM(prod.precio * p.cantidad) as total_a_pagar,
        json_agg(
          json_build_object(
            'platillo', prod.nombre,
            'cantidad', p.cantidad,
            'precio_unitario', prod.precio
          )
        ) as detalle
      FROM pedidos p
      JOIN productos prod ON p.producto_id = prod.id
      WHERE p.cuenta_id = $1
      GROUP BY p.cliente_nombre;
    `;

    const result = await pool.query(query, [cuenta_id]);

    const cuentasSeparadas = result.rows || [];

    const granTotal = cuentasSeparadas.reduce(
      (acc, curr) => acc + parseFloat(curr.total_a_pagar || 0),
      0
    );

    return res.json({
      cuenta_id: parseInt(cuenta_id),
      estado: cuentaExiste.rows[0].estado,
      gran_total: granTotal,
      cuentas_separadas: cuentasSeparadas
    });

  } catch (error) {
    console.error('Error al obtener cuenta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ======================================================
   SCHEMA VALIDACIÓN PAGO
====================================================== */
const pagoSchema = z.object({
  cuenta_id: z.number().int().positive(),
  pagos: z.array(
    z.object({
      cliente_nombre: z.string().min(1),
      monto: z.number().positive(),
      metodo_pago: z.enum(['efectivo', 'terminal'])
    })
  ).min(1, "Debe registrar al menos un pago")
});

/* ======================================================
   PROCESAR PAGO
====================================================== */
const procesarPago = async (req, res) => {
  try {
    const { cuenta_id, pagos } = pagoSchema.parse(req.body);

    await pool.query('BEGIN');

    // 1️⃣ Verificar que la cuenta exista
    const cuentaRes = await pool.query(
      `SELECT id, mesa_id FROM cuentas WHERE id = $1`,
      [cuenta_id]
    );

    if (cuentaRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta no existe' });
    }

    const mesaPrincipalId = cuentaRes.rows[0].mesa_id;

    // 2️⃣ Insertar pagos
    for (const pago of pagos) {
      await pool.query(
        `INSERT INTO pagos (cuenta_id, monto, metodo_pago, cliente_nombre)
         VALUES ($1, $2, $3, $4)`,
        [cuenta_id, pago.monto, pago.metodo_pago, pago.cliente_nombre]
      );
    }

    // 3️⃣ Marcar cuenta como pagada
    await pool.query(
      `UPDATE cuentas SET estado = 'pagada' WHERE id = $1`,
      [cuenta_id]
    );

    // 4️⃣ Liberar mesa si existe
if (mesaPrincipalId) {
  await pool.query(
    `UPDATE mesas 
     SET estado = 'disponible', mesa_padre_id = NULL 
     WHERE id = $1 OR mesa_padre_id = $1`,
    [mesaPrincipalId]
  );
}

    await pool.query('COMMIT');

    // 5️⃣ Emitir evento por socket si existe
    const io = req.app.get('io');
    if (io && mesaPrincipalId) {
      io.emit('mesas_actualizadas', {
        mensaje: `Mesa ${mesaPrincipalId} liberada`,
        accion: 'liberacion'
      });
    }

    return res.json({
      mensaje: 'Pago procesado y mesa liberada exitosamente'
    });

  } catch (error) {
    await pool.query('ROLLBACK');

    if (error instanceof z.ZodError) {
      return res.status(400).json({ errores: error.errors });
    }

    console.error('Error al procesar pago:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  obtenerCuenta,
  procesarPago
};