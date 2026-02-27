// src/controllers/pedidosController.js
const { z } = require('zod');
const pool = require('../db');

/* ======================================================
   OBTENER MENÚ
====================================================== */
const obtenerMenu = async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.nombre,
        p.descripcion,
        p.precio,
        c.nombre as categoria
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      WHERE p.disponible = true
      ORDER BY c.nombre, p.nombre;
    `;

    const result = await pool.query(query);
    return res.json(result.rows);

  } catch (error) {
    console.error('Error al obtener menú:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ======================================================
   ABRIR CUENTA
====================================================== */
const cuentaSchema = z.object({
  mesa_id: z.number().int().positive()
});

const abrirCuenta = async (req, res) => {
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

    await pool.query('BEGIN');

    const nuevaCuenta = await pool.query(
      `INSERT INTO cuentas (mesa_id, estado)
       VALUES ($1, 'abierta')
       RETURNING id, creada_en`,
      [mesa_id]
    );

    await pool.query(
      `UPDATE mesas SET estado = 'ocupada' WHERE id = $1`,
      [mesa_id]
    );

    await pool.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit('mesas_actualizadas', {
        mensaje: `La Mesa ${mesa_id} ha sido ocupada`,
        accion: 'ocupacion_individual'
      });
    }

    return res.status(201).json({
      mensaje: 'Cuenta abierta exitosamente',
      cuenta: nuevaCuenta.rows[0]
    });

  } catch (error) {
    await pool.query('ROLLBACK');

    if (error instanceof z.ZodError) {
      return res.status(400).json({ errores: error.errors });
    }

    console.error('Error al abrir cuenta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ======================================================
   TOMAR ORDEN
====================================================== */
const ordenSchema = z.object({
  cuenta_id: z.number().int().positive(),
  platillos: z.array(
    z.object({
      producto_id: z.number().int().positive(),
      cantidad: z.number().int().positive(),
      cliente_nombre: z.string().min(1)
    })
  ).min(1, "Debe agregar al menos un platillo")
});

const tomarOrden = async (req, res) => {
  try {
    const { cuenta_id, platillos } = ordenSchema.parse(req.body);

    await pool.query('BEGIN');

    /* 1️⃣ Verificar cuenta abierta */
    const cuentaRes = await pool.query(
      `SELECT id, mesa_id
       FROM cuentas
       WHERE id = $1 AND estado = 'abierta'`,
      [cuenta_id]
    );

    if (cuentaRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Cuenta no válida o cerrada' });
    }

    const pedidosInsertados = [];

    /* 2️⃣ Insertar cada platillo */
    for (const item of platillos) {

      // Verificar producto válido
      const productoRes = await pool.query(
        `SELECT id FROM productos WHERE id = $1 AND disponible = true`,
        [item.producto_id]
      );

      if (productoRes.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({
          error: `Producto con ID ${item.producto_id} no válido o no disponible`
        });
      }

      const insertRes = await pool.query(
        `INSERT INTO pedidos
         (cuenta_id, producto_id, cantidad, cliente_nombre, estado, creado_en)
         VALUES ($1, $2, $3, $4, 'pendiente', NOW())
         RETURNING id, cuenta_id, producto_id, cantidad, cliente_nombre, estado, creado_en`,
        [cuenta_id, item.producto_id, item.cantidad, item.cliente_nombre]
      );

      pedidosInsertados.push(insertRes.rows[0]);
    }

    /* 3️⃣ Obtener datos para cocina */
    const detallesCocina = await pool.query(
      `SELECT 
          p.id as pedido_id,
          prod.nombre as platillo,
          p.cantidad,
          p.estado,
          m.numero as mesa_numero
       FROM pedidos p
       JOIN productos prod ON p.producto_id = prod.id
       JOIN cuentas c ON p.cuenta_id = c.id
       JOIN mesas m ON c.mesa_id = m.id
       WHERE p.id = ANY($1::int[])`,
      [pedidosInsertados.map(p => p.id)]
    );

    await pool.query('COMMIT');

    /* 4️⃣ Emitir evento socket */
    const io = req.app.get('io');
    if (io && detallesCocina.rows.length > 0) {
      io.emit('nueva_orden_cocina', {
        mensaje: '¡Nueva orden recibida!',
        mesa: detallesCocina.rows[0].mesa_numero,
        detalles: detallesCocina.rows
      });
    }

    return res.status(201).json({
      mensaje: 'Orden enviada a cocina exitosamente',
      pedidos: pedidosInsertados
    });

  } catch (error) {
    await pool.query('ROLLBACK');

    if (error instanceof z.ZodError) {
      return res.status(400).json({ errores: error.errors });
    }

    console.error('Error al tomar orden:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  obtenerMenu,
  abrirCuenta,
  tomarOrden
};