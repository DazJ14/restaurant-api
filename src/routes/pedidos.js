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

  if (!cuenta_id || !platillos || !Array.isArray(platillos) || platillos.length === 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar que la cuenta exista y esté abierta
    const cuentaResult = await client.query(
      'SELECT * FROM cuentas WHERE id = $1 AND estado = $2',
      [cuenta_id, 'abierta']
    );

    if (cuentaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cuenta no válida o cerrada' });
    }

    // Insertar cada platillo
    for (const item of platillos) {
      const { producto_id, cantidad, cliente_nombre } = item;

      if (!producto_id || !cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Platillo inválido' });
      }

      // Verificar que el producto exista
      const productoResult = await client.query(
        'SELECT * FROM productos WHERE id = $1',
        [producto_id]
      );

      if (productoResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Producto ${producto_id} no existe` });
      }

      // Insertar pedido (incluyendo creado_en por seguridad)
      await client.query(
        `INSERT INTO pedidos 
        (cuenta_id, producto_id, cantidad, cliente_nombre, estado, creado_en)
        VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          cuenta_id,
          producto_id,
          cantidad,
          cliente_nombre || null,
          'pendiente'
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ mensaje: 'Orden creada correctamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en /ordenar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

module.exports = router;
