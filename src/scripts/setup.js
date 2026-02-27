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
        nombre VARCHAR(100) UNIQUE NOT NULL, -- Agregado UNIQUE para evitar duplicados en el seed
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
    console.log('✅ Tablas creadas/verificadas.');

    // --- SEED DE ROLES ---
    await pool.query(`
      INSERT INTO roles (id, nombre) VALUES 
      (1, 'Gerente'), (2, 'Recepcionista'), (3, 'Mesero'), (4, 'Cocinero')
      ON CONFLICT (id) DO NOTHING;
    `);

    // --- SEED DE USUARIOS ---
    console.log('⏳ Insertando usuarios de prueba...');
    const usuariosPrueba = [
      { nombre: 'Jagua', username: 'jagua', pass: 'admin123', rol: 1 },
      { nombre: 'Ana', username: 'ana_recepcion', pass: 'ana123', rol: 2 },
      { nombre: 'Carlos', username: 'carlos_mesero', pass: 'carlos123', rol: 3 },
      { nombre: 'Roberto', username: 'roberto_chef', pass: 'roberto123', rol: 4 }
    ];

    for (const u of usuariosPrueba) {
      const hash = await bcrypt.hash(u.pass, 10);
      await pool.query(`
        INSERT INTO usuarios (nombre, username, password_hash, rol_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING;
      `, [u.nombre, u.username, hash, u.rol]);
    }

    // --- SEED DE MESAS ---
    console.log('⏳ Configurando el salón...');
    await pool.query(`
      INSERT INTO mesas (numero, capacidad, estado) VALUES 
      (1, 2, 'ocupada'),  -- La dejaremos ocupada para pruebas
      (2, 2, 'disponible'), 
      (3, 4, 'disponible'), 
      (4, 4, 'disponible'), 
      (5, 6, 'disponible')
      ON CONFLICT (numero) DO NOTHING;
    `);

    // --- SEED DE MENÚ ---
    console.log('⏳ Cocinando el menú...');
    await pool.query(`
      INSERT INTO categorias (nombre) VALUES 
      ('Bebidas'), ('Entradas'), ('Platos Fuertes'), ('Postres')
      ON CONFLICT (nombre) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO productos (categoria_id, nombre, descripcion, precio) VALUES 
      ((SELECT id FROM categorias WHERE nombre = 'Bebidas'), 'Agua Mineral', '600ml bien fría', 35.00),
      ((SELECT id FROM categorias WHERE nombre = 'Entradas'), 'Alitas Crujientes', 'Preparadas en air fryer, cero aceite', 120.00),
      ((SELECT id FROM categorias WHERE nombre = 'Platos Fuertes'), 'Pasta a la Carbonara', 'Receta tradicional italiana', 180.00),
      ((SELECT id FROM categorias WHERE nombre = 'Platos Fuertes'), 'Pechuga a la Plancha', 'Ideal para cuidar las calorías', 140.00),
      ((SELECT id FROM categorias WHERE nombre = 'Postres'), 'Tiramisú', 'Con un toque de espresso', 85.00)
      ON CONFLICT (nombre) DO NOTHING;
    `);

    // --- SEED DE PEDIDOS (Simular que la Mesa 1 ya está comiendo) ---
    console.log('⏳ Simulando operación en curso...');
    
    // Verificamos si ya hay cuentas para no duplicar datos de prueba infinitamente
    const cuentasCheck = await pool.query('SELECT id FROM cuentas LIMIT 1');
    
    if (cuentasCheck.rows.length === 0) {
      // Abrimos cuenta en la Mesa 1
      const cuentaRes = await pool.query(`
        INSERT INTO cuentas (mesa_id) VALUES ((SELECT id FROM mesas WHERE numero = 1)) RETURNING id
      `);
      const cuentaId = cuentaRes.rows[0].id;

      // Metemos un par de pedidos a la cocina
      await pool.query(`
        INSERT INTO pedidos (cuenta_id, producto_id, cantidad, cliente_nombre) VALUES 
        ($1, (SELECT id FROM productos WHERE nombre = 'Pasta a la Carbonara'), 1, 'Persona 1'),
        ($1, (SELECT id FROM productos WHERE nombre = 'Pechuga a la Plancha'), 1, 'Persona 2')
      `, [cuentaId]);
    }

    console.log('✅ ¡Setup completado! Base de datos lista para pruebas.');

  } catch (error) {
    console.error('❌ Error en el setup:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

setupDatabase();