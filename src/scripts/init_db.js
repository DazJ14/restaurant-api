// src/scripts/init_db.js
const pool = require('../db');

const inicializarBaseDeDatos = async () => {
  let conectado = false;
  let intentos = 5;

  while (!conectado && intentos > 0) {
    try {
      await pool.query('SELECT 1');
      conectado = true;
      console.log('✅ Conexión establecida. Iniciando creación de tablas...');
    } catch (err) {
      intentos--;
      console.log(`⏳ Esperando a la BD... (Intentos: ${intentos})`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  if (!conectado) {
    console.error('❌ No se pudo conectar a la BD.');
    process.exit(1);
  }

  try {
    const queryTablas = `
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
        activo BOOLEAN DEFAULT TRUE,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS mesas (
        id SERIAL PRIMARY KEY,
        numero INTEGER UNIQUE NOT NULL,
        capacidad INTEGER NOT NULL,
        estado VARCHAR(30) DEFAULT 'disponible', 
        mesa_padre_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10, 2) NOT NULL,
        disponible BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS cuentas (
        id SERIAL PRIMARY KEY,
        mesa_id INTEGER REFERENCES mesas(id) ON DELETE CASCADE,
        estado VARCHAR(20) DEFAULT 'abierta',
        creada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE RESTRICT,
        cantidad INTEGER DEFAULT 1,
        cliente_nombre VARCHAR(50) DEFAULT 'General', 
        estado VARCHAR(30) DEFAULT 'pendiente',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE CASCADE,
        monto DECIMAL(10, 2) NOT NULL,
        metodo_pago VARCHAR(50) NOT NULL,
        cliente_nombre VARCHAR(50) DEFAULT 'General',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(queryTablas);
    console.log('✅ Estructura de tablas verificada/creada exitosamente.');
  } catch (error) {
    console.error('❌ Error creando las tablas:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

inicializarBaseDeDatos();