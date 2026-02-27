// src/scripts/seed_db.js
const pool = require('../db');
const bcrypt = require('bcrypt');

const sembrarBaseDeDatos = async () => {
  try {
    console.log('🌱 Iniciando la siembra de datos (Seeding)...');

    // 1. Roles
    await pool.query(`
      INSERT INTO roles (id, nombre) VALUES 
      (1, 'Gerente'), (2, 'Recepcionista'), (3, 'Mesero'), (4, 'Cocinero')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Usuarios
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

    // 3. Mesas
    await pool.query(`
      INSERT INTO mesas (numero, capacidad, estado) VALUES 
      (1, 2, 'ocupada'), (2, 2, 'disponible'), (3, 4, 'disponible'), 
      (4, 4, 'disponible'), (5, 6, 'disponible')
      ON CONFLICT (numero) DO NOTHING;
    `);

    // 4. Categorías
    await pool.query(`
      INSERT INTO categorias (nombre) VALUES 
      ('Bebidas'), ('Entradas'), ('Platos Fuertes'), ('Postres')
      ON CONFLICT (nombre) DO NOTHING;
    `);

    // 5. Productos
    await pool.query(`
      INSERT INTO productos (categoria_id, nombre, descripcion, precio) VALUES 
      ((SELECT id FROM categorias WHERE nombre = 'Bebidas'), 'Agua Mineral', '600ml', 35.00),
      ((SELECT id FROM categorias WHERE nombre = 'Entradas'), 'Alitas Crujientes', 'Cero aceite', 120.00),
      ((SELECT id FROM categorias WHERE nombre = 'Platos Fuertes'), 'Pasta a la Carbonara', 'Tradicional', 180.00),
      ((SELECT id FROM categorias WHERE nombre = 'Platos Fuertes'), 'Pechuga a la Plancha', 'Baja en calorías', 140.00),
      ((SELECT id FROM categorias WHERE nombre = 'Postres'), 'Tiramisú', 'Con espresso', 85.00)
      ON CONFLICT (nombre) DO NOTHING;
    `);

    // 6. Cuentas y Pedidos (Si la Mesa 1 no tiene cuenta activa)
    const cuentasCheck = await pool.query("SELECT id FROM cuentas WHERE mesa_id = (SELECT id FROM mesas WHERE numero = 1) AND estado = 'abierta'");
    
    if (cuentasCheck.rows.length === 0) {
      const cuentaRes = await pool.query(`INSERT INTO cuentas (mesa_id) VALUES ((SELECT id FROM mesas WHERE numero = 1)) RETURNING id`);
      const cuentaId = cuentaRes.rows[0].id;

      await pool.query(`
        INSERT INTO pedidos (cuenta_id, producto_id, cantidad, cliente_nombre) VALUES 
        ($1, (SELECT id FROM productos WHERE nombre = 'Pasta a la Carbonara'), 1, 'Persona 1'),
        ($1, (SELECT id FROM productos WHERE nombre = 'Pechuga a la Plancha'), 1, 'Persona 2')
      `, [cuentaId]);
    }

    console.log('✅ ¡Siembra de datos completada exitosamente!');
  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

sembrarBaseDeDatos();