const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { obtenerMenu, abrirCuenta, tomarOrden } = require('../controllers/pedidosController');

const router = express.Router();

router.get('/menu', verificarToken, verificarRol([1, 2, 3]), obtenerMenu);

const cuentaSchema = z.object({
  mesa_id: z.number().int().positive("ID de mesa inválido")
});

router.post('/abrir-cuenta', verificarToken, verificarRol([1, 3]), abrirCuenta);

const ordenSchema = z.object({
  cuenta_id: z.number().int().positive(),
  platillos: z.array(z.object({
    producto_id: z.number().int().positive(),
    cantidad: z.number().int().positive(),
    cliente_nombre: z.string().min(1, "Debes identificar quién pidió esto")
  })).min(1, "La orden no puede estar vacía")
});

// router.post('/ordenar', verificarToken, verificarRol([1, 3]), tomarOrden);

router.post('/ordenar', async (req, res) => {
  const { cuenta_id, platillos } = req.body;

  if (!cuenta_id || !Array.isArray(platillos) || platillos.length === 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔎 Verificar cuenta
    const cuenta = await client.query(
      'SELECT * FROM cuentas WHERE id = $1 AND estado = $2',
      [cuenta_id, 'abierta']
    );

    if (cuenta.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cuenta no válida o cerrada' });
    }

    for (const item of platillos) {
      let { producto_id, cantidad, cliente_nombre } = item;

      if (!producto_id || !cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Platillo inválido' });
      }

      // 🔎 Verificar producto
      const producto = await client.query(
        'SELECT id FROM productos WHERE id = $1',
        [producto_id]
      );

      if (producto.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Producto ${producto_id} no existe` });
      }

      // 🔐 Sanitizar texto (evita errores por longitud)
      cliente_nombre = cliente_nombre
        ? cliente_nombre.toString().substring(0, 200)
        : null;

      const estado = 'pendiente';

      console.log("Insertando pedido:", {
        cuenta_id,
        producto_id,
        cantidad,
        cliente_nombre
      });

      await client.query(
        `INSERT INTO pedidos 
         (cuenta_id, producto_id, cantidad, cliente_nombre, estado, creado_en)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          cuenta_id,
          producto_id,
          cantidad,
          cliente_nombre,
          estado
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ mensaje: 'Orden creada correctamente' });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error("❌ ERROR DETALLADO:", error.message);
    console.error(error.stack);

    res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;
