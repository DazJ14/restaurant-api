const pool = require('../db');

const crearTablas = async () => {
  const query = `
    -- Tabla de Roles
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(50) UNIQUE NOT NULL
    );

    -- Tabla de Usuarios
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      rol_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
      activo BOOLEAN DEFAULT TRUE, -- Para "borrar" empleados sin perder su historial
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log('⏳ Creando tablas en la base de datos...');
    await pool.query(query);
    console.log('✅ Tablas creadas correctamente.');

    const rolesQuery = `
      INSERT INTO roles (nombre)
      VALUES ('Gerente'), ('Recepcionista'), ('Mesero'), ('Cocinero')
      ON CONFLICT (nombre) DO NOTHING;
    `;
    await pool.query(rolesQuery);
    console.log('✅ Roles por defecto insertados/verificados.');

  } catch (error) {
    console.error('❌ Error creando las tablas:', error);
  } finally {
    pool.end();
  }
};

crearTablas();