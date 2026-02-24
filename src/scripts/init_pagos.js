// src/scripts/init_pagos.js
const pool = require('../db');

const crearTablaPagos = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE CASCADE,
      monto DECIMAL(10, 2) NOT NULL,
      metodo_pago VARCHAR(50) NOT NULL, -- 'efectivo', 'terminal'
      cliente_nombre VARCHAR(50) DEFAULT 'General',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log('⏳ Creando tabla de pagos...');
    await pool.query(query);
    console.log('✅ Tabla de pagos creada correctamente.');
  } catch (error) {
    console.error('❌ Error creando la tabla de pagos:', error);
  } finally {
    pool.end();
  }
};

crearTablaPagos();