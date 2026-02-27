const pool = require('../db');
const bcrypt = require('bcrypt');

const setupDatabase = async () => {
  let conectado = false;
  let intentos = 5;

  while (!conectado && intentos > 0) {
    try {
      await pool.query('SELECT 1');
      conectado = true;
      console.log('✅ Conexión establecida con PostgreSQL.');
    } catch (err) {
      intentos--;
      console.log(`⏳ Esperando a la base de datos... (Intentos restantes: ${intentos})`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  if (!conectado) {
    console.error('❌ No se pudo conectar a la base de datos.');
    process.exit(1);
  }

  try {
    console.log('🚀 Creando estructura de tablas...');

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
        nombre VARCHAR(100) NOT NULL,
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
    console.log('✅ Tablas creadas.');

    await pool.query(`
      INSERT INTO roles (id, nombre) VALUES 
      (1, 'Gerente'), (2, 'Recepcionista'), (3, 'Mesero'), (4, 'Cocinero')
      ON CONFLICT (id) DO NOTHING;
    `);

    const adminUser = 'admin';
    const adminPass = 'admin123';
    const saltRounds = 10;
    const hash = await bcrypt.hash(adminPass, saltRounds);

    await pool.query(`
      INSERT INTO usuarios (nombre, username, password_hash, rol_id)
      VALUES ('Admin', $1, $2, 1)
      ON CONFLICT (username) DO NOTHING;
    `, [adminUser, hash]);

    console.log(`✅ Roles insertados y usuario '${adminUser}' creado con éxito.`);

  } catch (error) {
    console.error('❌ Error en el setup:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

setupDatabase();