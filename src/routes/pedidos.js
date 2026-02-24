const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/menu', verificarToken, verificarRol([1, 2, 3]), async (_, res) => {
  try {
    const query = `
      SELECT p.id, p.nombre, p.descripcion, p.precio, c.nombre as categoria 
      FROM productos p 
      JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.disponible = true
      ORDER BY c.nombre, p.nombre;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener el menú:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const cuentaSchema = z.object({
  mesa_id: z.number().int().positive("ID de mesa inválido")
});

router.post('/abrir-cuenta', verificarToken, verificarRol([1, 3]), async (req, res) => {
  try {
    const { mesa_id } = cuentaSchema.parse(req.body);

    const cuentaExistente = await pool.query(
      `SELECT id FROM cuentas WHERE mesa_id = $1 AND estado = 'abierta'`,
      [mesa_id]
    );

    if (cuentaExistente.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Esta mesa ya tiene una cuenta abierta', 
        cuenta_id: cuentaExistente.rows[0].id 
      });
    }

    const nuevaCuenta = await pool.query(
      `INSERT INTO cuentas (mesa_id) VALUES ($1) RETURNING id, creada_en`,
      [mesa_id]
    );

    res.status(201).json({ 
      mensaje: 'Cuenta abierta exitosamente', 
      cuenta: nuevaCuenta.rows[0] 
    });

  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ errores: error.errors });
    console.error('Error al abrir cuenta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const ordenSchema = z.object({
  cuenta_id: z.number().int().positive(),
  platillos: z.array(z.object({
    producto_id: z.number().int().positive(),
    cantidad: z.number().int().positive(),
    cliente_nombre: z.string().min(1, "Debes identificar quién pidió esto")
  })).min(1, "La orden no puede estar vacía")
});

router.post('/ordenar', verificarToken, verificarRol([1, 3]), async (req, res) => {
  try {
    const datosValidados = ordenSchema.parse(req.body);
    const { cuenta_id, platillos } = datosValidados;

    await pool.query('BEGIN');

    const pedidosInsertados = [];

    for (const item of platillos) {
      const result = await pool.query(
        `INSERT INTO pedidos (cuenta_id, producto_id, cantidad, cliente_nombre) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [cuenta_id, item.producto_id, item.cantidad, item.cliente_nombre]
      );
      pedidosInsertados.push(result.rows[0]);
    }

    const detallesCocina = await pool.query(`
      SELECT p.id as pedido_id, prod.nombre as platillo, p.cantidad, p.estado, m.numero as mesa_numero
      FROM pedidos p
      JOIN productos prod ON p.producto_id = prod.id
      JOIN cuentas c ON p.cuenta_id = c.id
      JOIN mesas m ON c.mesa_id = m.id
      WHERE p.id = ANY($1::int[])
    `, [pedidosInsertados.map(p => p.id)]);

    await pool.query('COMMIT');

    const io = req.app.get('io');
    io.emit('nueva_orden_cocina', {
      mensaje: '¡Nueva orden recibida!',
      mesa: detallesCocina.rows[0].mesa_numero,
      detalles: detallesCocina.rows
    });

    res.status(201).json({ 
      mensaje: 'Orden enviada a cocina exitosamente', 
      pedidos: pedidosInsertados 
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    if (error instanceof z.ZodError) return res.status(400).json({ errores: error.errors });
    console.error('Error al enviar orden:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
