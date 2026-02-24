const pool = require('../db');

const crearTablasMenuYPedidos = async () => {
  const query = `
    -- Tabla de Categorías del Menú
    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(50) UNIQUE NOT NULL
    );

    -- Tabla de Productos (Platillos/Bebidas)
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      precio DECIMAL(10, 2) NOT NULL,
      disponible BOOLEAN DEFAULT TRUE
    );

    -- Tabla de Cuentas (Una cuenta abierta por mesa/grupo)
    CREATE TABLE IF NOT EXISTS cuentas (
      id SERIAL PRIMARY KEY,
      mesa_id INTEGER REFERENCES mesas(id) ON DELETE CASCADE,
      estado VARCHAR(20) DEFAULT 'abierta', -- 'abierta', 'pagada'
      creada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de Pedidos (Los platillos individuales dentro de una cuenta)
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE CASCADE,
      producto_id INTEGER REFERENCES productos(id) ON DELETE RESTRICT,
      cantidad INTEGER DEFAULT 1,
      -- ¡Clave para dividir cuentas!: Identificador de quién pidió qué
      cliente_nombre VARCHAR(50) DEFAULT 'General', 
      -- Estados del platillo para la cocina y el mesero
      estado VARCHAR(30) DEFAULT 'pendiente', -- 'pendiente', 'preparando', 'listo', 'entregado'
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log('⏳ Creando tablas de menú y pedidos...');
    await pool.query(query);
    console.log('✅ Tablas creadas correctamente.');

    const menuPrueba = `
      INSERT INTO categorias (nombre) VALUES ('Bebidas'), ('Platos Fuertes'), ('Postres') ON CONFLICT DO NOTHING;
      
      INSERT INTO productos (categoria_id, nombre, descripcion, precio) VALUES 
      ((SELECT id FROM categorias WHERE nombre = 'Bebidas'), 'Refresco de Cola', '600ml', 35.00),
      ((SELECT id FROM categorias WHERE nombre = 'Bebidas'), 'Limonada', 'Jarra de 1L', 80.00),
      ((SELECT id FROM categorias WHERE nombre = 'Platos Fuertes'), 'Hamburguesa Clásica', 'Con queso y papas', 150.00),
      ((SELECT id FROM categorias WHERE nombre = 'Platos Fuertes'), 'Tacos al Pastor', 'Orden de 5', 120.00),
      ((SELECT id FROM categorias WHERE nombre = 'Postres'), 'Flan Napolitano', 'Rebanada', 60.00)
      ON CONFLICT DO NOTHING;
    `;
    await pool.query(menuPrueba);
    console.log('✅ Menú de prueba insertado.');

  } catch (error) {
    console.error('❌ Error creando las tablas:', error);
  } finally {
    pool.end();
  }
};

crearTablasMenuYPedidos();