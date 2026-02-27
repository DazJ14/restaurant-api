# 📖 Documentación de la API - Sistema de Restaurante

Bienvenido a la documentación oficial del backend del Sistema de Restaurante. Esta API está construida con Node.js, Express y PostgreSQL, e implementa WebSockets (Socket.io) para comunicación en tiempo real.

## 🚀 Configuración Base

* **URL Base (Desarrollo):** `http://localhost:3000/api`
* **URL Base (Producción):** `[Tu-Dominio]/api`
* **WebSockets URL:** `http://localhost:3000` (o tu dominio)
* **Formato de Intercambio:** `application/json`

### 🔐 Autenticación y Autorización
La API utiliza JSON Web Tokens (JWT). Todas las rutas (excepto el login) requieren que envíes el token en los **Headers** de tu petición HTTP:

\`\`\`http
Authorization: Bearer <TU_TOKEN_AQUI>
\`\`\`

**Diccionario de Roles (`rol_id`):**
El sistema restringe el acceso a ciertos endpoints dependiendo del rol del usuario autenticado:
* `1`: Gerente (Acceso total a todas las rutas)
* `2`: Recepcionista (Gestión de mesas y cobros)
* `3`: Mesero (Gestión de mesas, toma de pedidos y cobros)
* `4`: Cocinero (Acceso exclusivo a rutas de cocina)

---

## 🗂️ 1. Módulo de Autenticación y Usuarios

### Iniciar Sesión
Inicia la sesión de un usuario y devuelve el token de acceso.
* **Endpoint:** `POST /auth/login`
* **Autenticación:** ❌ No requerida
* **Body (JSON):**
\`\`\`json
{
  "username": "admin",
  "password": "password123"
}
\`\`\`

### Crear Nuevo Usuario
Registra a un nuevo empleado en el sistema.
* **Endpoint:** `POST /usuarios`
* **Autenticación:** ✅ Requerida (Solo Rol `1` - Gerente)
* **Body (JSON):**
\`\`\`json
{
  "nombre": "Juan Pérez",
  "username": "juan_perez",
  "password": "secreta123",
  "rol_id": 3
}
\`\`\`

---

## 🪑 2. Módulo de Mesas (Recepción)

### Obtener Todas las Mesas
Devuelve la lista completa del layout de mesas y su estado actual.
* **Endpoint:** `GET /mesas`
* **Autenticación:** ✅ Requerida (Roles: `1`, `2`, `3`)

### Fusionar y Ocupar Mesas
Agrupa varias mesas físicas bajo una sola cuenta principal cuando llega un grupo grande.
* **Endpoint:** `POST /mesas/fusionar`
* **Autenticación:** ✅ Requerida (Roles: `1`, `2`)
* **Body (JSON):**
\`\`\`json
{
  "mesa_principal_id": 1,
  "mesas_a_fusionar": [2, 3]
}
\`\`\`

---

## 📋 3. Módulo de Pedidos (Meseros)

### Ver Menú Activo
Devuelve el catálogo de productos disponibles, agrupados por categoría.
* **Endpoint:** `GET /pedidos/menu`
* **Autenticación:** ✅ Requerida (Roles: `1`, `2`, `3`)

### Abrir Cuenta
Inicia un ticket/cuenta vinculada a una mesa ocupada antes de poder tomar pedidos.
* **Endpoint:** `POST /pedidos/abrir-cuenta`
* **Autenticación:** ✅ Requerida (Roles: `1`, `3`)
* **Body (JSON):**
\`\`\`json
{
  "mesa_id": 1
}
\`\`\`
* **Nota Frontend:** Guarda el `cuenta_id` que te devuelve esta petición, lo necesitarás para enviar órdenes.

### Tomar Orden (Enviar a Cocina)
Agrega platillos a una cuenta abierta.
* **Endpoint:** `POST /pedidos/ordenar`
* **Autenticación:** ✅ Requerida (Roles: `1`, `3`)
* **Body (JSON):**
\`\`\`json
{
  "cuenta_id": 1,
  "platillos": [
    {
      "producto_id": 4,
      "cantidad": 2,
      "cliente_nombre": "Carlos"
    }
  ]
}
\`\`\`
* **Efecto Secundario:** Dispara automáticamente el evento de WebSockets `nueva_orden_cocina`.

---

## 🍳 4. Módulo de Cocina

### Obtener Órdenes Pendientes
Lista todos los platillos que no han sido entregados, ideal para pintar el panel (KDS) de la cocina.
* **Endpoint:** `GET /cocina/pendientes`
* **Autenticación:** ✅ Requerida (Roles: `1`, `4`)

### Cambiar Estado de un Platillo
Actualiza el progreso de preparación de un pedido individual.
* **Endpoint:** `PATCH /cocina/pedidos/:id/estado`
* **URL Params:** `id` = El ID del pedido individual (no confundir con cuenta_id).
* **Autenticación:** ✅ Requerida (Roles: `1`, `4`)
* **Body (JSON):**
\`\`\`json
{
  "nuevo_estado": "listo" 
}
\`\`\`
*(Valores permitidos: "preparando", "listo", "entregado")*
* **Efecto Secundario:** Si el estado cambia a `"listo"`, dispara el evento WebSocket `pedido_listo_para_entregar` a los meseros.

---

## 💳 5. Módulo de Pagos y Liberación

### Obtener Resumen de Cuenta (Dividida)
Calcula el total a pagar y separa los subtotales automáticamente por cliente/etiqueta.
* **Endpoint:** `GET /pagos/cuenta/:cuenta_id`
* **URL Params:** `cuenta_id` = El ID de la cuenta activa.
* **Autenticación:** ✅ Requerida (Roles: `1`, `2`, `3`)

### Procesar Pago y Cerrar Mesa
Registra los pagos, cierra la cuenta y automáticamente libera (y desvincula) las mesas asociadas en la base de datos.
* **Endpoint:** `POST /pagos/pagar`
* **Autenticación:** ✅ Requerida (Roles: `1`, `2`, `3`)
* **Body (JSON):**
\`\`\`json
{
  "cuenta_id": 1,
  "pagos": [
    {
      "cliente_nombre": "Carlos",
      "monto": 240.00,
      "metodo_pago": "efectivo"
    },
    {
      "cliente_nombre": "Ana",
      "monto": 150.00,
      "metodo_pago": "terminal"
    }
  ]
}
\`\`\`
* **Efecto Secundario:** Dispara el evento WebSocket `mesas_actualizadas`.

---

## 🔌 6. Eventos en Tiempo Real (WebSockets / Socket.io)

El frontend debe conectarse al servidor utilizando la librería `socket.io-client`. El cliente debe estar a la escucha (`socket.on`) de los siguientes eventos:

### `mesas_actualizadas`
* **Descripción:** Se emite cuando ocurre una fusión de mesas o cuando una cuenta es pagada y las mesas se liberan.
* **Payload recibido:** `{ "mensaje": string, "accion": string }`
* **Acción Frontend Recomendada:** Disparar de nuevo la petición `GET /mesas` para repintar el mapa del restaurante.

### `nueva_orden_cocina`
* **Descripción:** Se emite hacia las tablets de los cocineros justo después de que un mesero levanta un pedido.
* **Payload recibido:**
\`\`\`json
{
  "mensaje": "¡Nueva orden recibida!",
  "mesa": 1,
  "detalles": [
    { "pedido_id": 15, "platillo": "Tacos", "cantidad": 2, "estado": "pendiente", "mesa_numero": 1 }
  ]
}
\`\`\`
* **Acción Frontend Recomendada:** Reproducir un sonido de alerta e insertar los nuevos items en la lista de pendientes.

### `pedido_listo_para_entregar`
* **Descripción:** Se emite hacia las tablets de los meseros cuando la cocina marca un platillo como "listo".
* **Payload recibido:**
\`\`\`json
{
  "mensaje": "¡Platillo listo para la Mesa 1!",
  "mesa": 1,
  "cliente": "Carlos",
  "pedido_id": 15
}
\`\`\`
* **Acción Frontend Recomendada:** Mostrar una notificación push emergente en la pantalla del mesero.

---

## 🛑 Manejo de Errores Estandarizado

Si una petición falla, la API responderá con los códigos HTTP correspondientes y un JSON descriptivo:
* `400 Bad Request`: Errores de validación (ej. campos faltantes). Incluirá un arreglo `errores`.
* `401 Unauthorized`: Token faltante, expirado o inválido. 
* `403 Forbidden`: El usuario no tiene permiso (`rol_id`) para ejecutar esa acción.
* `404 Not Found`: El recurso solicitado no existe.
* `500 Internal Server Error`: Falla crítica del servidor o de la base de datos.