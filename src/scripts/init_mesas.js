const pool = require('../db');

const crearTablaMesas = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS mesas (
      id SERIAL PRIMARY KEY,
      numero INTEGER UNIQUE NOT NULL,
      capacidad INTEGER NOT NULL,
      -- Estados: 'disponible', 'ocupada', 'ordenando', 'esperando_comida', 'comiendo', 'pagando'
      estado VARCHAR(30) DEFAULT 'disponible', 
      -- Para la fusión de mesas (Relación autorreferencial)
      mesa_padre_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL
    );
  `;

  try {
    console.log('⏳ Creando tabla de mesas...');
    await pool.query(query);
    console.log('✅ Tabla de mesas creada correctamente.');

    const mesasPrueba = `
      INSERT INTO mesas (numero, capacidad)
      VALUES 
        (1, 2),
        (2, 2),
        (3, 4),
        (4, 4),
        (5, 6)
      ON CONFLICT (numero) DO NOTHING;
    `;
    await pool.query(mesasPrueba);
    console.log('✅ Mesas de prueba insertadas.');

  } catch (error) {
    console.error('❌ Error creando la tabla de mesas:', error);
  } finally {
    pool.end();
  }
};

crearTablaMesas();