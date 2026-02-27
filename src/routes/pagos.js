const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { obtenerCuenta, procesarPago } = require('../controllers/pagosController');

const router = express.Router();

router.get('/cuenta/:cuenta_id', verificarToken, verificarRol([1, 2, 3]), obtenerCuenta);
router.post('/pagar', async (req, res) => {
    const client = await pool.connect();

    try {
        let { cuenta_id, metodo_pago, referencia } = req.body;

        // ---------------------------
        // 🔎 Validaciones básicas
        // ---------------------------
        if (!cuenta_id || !metodo_pago) {
            return res.status(400).json({
                error: 'Datos incompletos'
            });
        }

        cuenta_id = Number(cuenta_id);
        metodo_pago = metodo_pago.toString().substring(0, 200);
        referencia = referencia
            ? referencia.toString().substring(0, 200)
            : null;

        console.log("📤 Intentando procesar pago:", {
            cuenta_id,
            metodo_pago,
            referencia
        });

        await client.query('BEGIN');

        // ---------------------------
        // 🔎 Verificar que exista la cuenta
        // ---------------------------
        const cuenta = await client.query(
            'SELECT * FROM cuentas WHERE id = $1',
            [cuenta_id]
        );

        if (cuenta.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                error: 'Cuenta no encontrada'
            });
        }

        // ---------------------------
        // 🚫 Evitar doble pago
        // ---------------------------
        if (cuenta.rows[0].estado === 'pagada') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'La cuenta ya está pagada'
            });
        }

        // ---------------------------
        // 💰 Insertar pago
        // ---------------------------
        await client.query(
            `INSERT INTO pagos 
             (cuenta_id, metodo_pago, referencia, fecha_pago)
             VALUES ($1, $2, $3, NOW())`,
            [cuenta_id, metodo_pago, referencia]
        );

        // ---------------------------
        // 🧾 Actualizar cuenta
        // ---------------------------
        await client.query(
            `UPDATE cuentas
             SET estado = 'pagada'
             WHERE id = $1`,
            [cuenta_id]
        );

        await client.query('COMMIT');

        console.log("✅ Pago procesado correctamente");

        res.json({
            success: true,
            mensaje: 'Pago procesado correctamente'
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error("❌ ERROR EN /pagar:", error.message);
        console.error(error.stack);

        res.status(500).json({
            error: 'Error interno del servidor',
            detalle: error.message
        });

    } finally {
        client.release();
    }
});


module.exports = router;
