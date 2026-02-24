# 📖 Documentación de la API - Sistema de Restaurante

**URL Base:** `http://localhost:3000/api`

**Autenticación:** La mayoría de las rutas requieren un token JWT en los *Headers* de la petición.
* **Key:** `Authorization`
* **Value:** `Bearer <TU_TOKEN>`

**Diccionario de Roles (rol_id):**
* `1`: Gerente (Acceso total)
* `2`: Recepcionista (Mesas y Pagos)
* `3`: Mesero (Mesas, Pedidos y Pagos)
* `4`: Cocinero (Solo Cocina)

---

## 1. Autenticación y Usuarios

| Método | Endpoint | Roles Permitidos | Body Requerido (JSON) | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/auth/login` | Público | `username`, `password` | Inicia sesión y devuelve el Token JWT y datos del usuario. |
| **POST** | `/usuarios` | `1` | `nombre`, `username`, `password`, `rol_id` | Registra un nuevo empleado en el sistema. |

---

## 2. Gestión de Mesas (Recepción)

| Método | Endpoint | Roles Permitidos | Body / Params | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/mesas` | `1`, `2`, `3` | Ninguno | Devuelve la lista completa de mesas y su estado actual. |
| **POST**| `/mesas/fusionar` | `1`, `2` | `mesa_principal_id` (int), `mesas_a_fusionar` (array de ints) | Ocupa la mesa principal y vincula las secundarias a esta. |

---

## 3. Toma de Pedidos (Meseros)

| Método | Endpoint | Roles Permitidos | Body / Params | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/pedidos/menu` | `1`, `2`, `3` | Ninguno | Devuelve el catálogo de productos disponibles agrupados. |
| **POST**| `/pedidos/abrir-cuenta` | `1`, `3` | `mesa_id` (int) | Abre una nueva cuenta (ticket) vinculada a una mesa. Devuelve el `cuenta_id`. |
| **POST**| `/pedidos/ordenar` | `1`, `3` | `cuenta_id`, `platillos`: `[{producto_id, cantidad, cliente_nombre}]` | Envía platillos a la cuenta, etiquetados por persona. Dispara socket a cocina. |

---

## 4. Pantalla de Cocina

| Método | Endpoint | Roles Permitidos | Body / Params | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/cocina/pendientes` | `1`, `4` | Ninguno | Lista todos los platillos en estado 'pendiente' o 'preparando'. |
| **PATCH**| `/cocina/pedidos/:id/estado` | `1`, `4` | URL Param: `id` (del pedido). Body: `nuevo_estado` ('preparando', 'listo', 'entregado') | Actualiza el estado de un platillo. Si es 'listo', avisa al mesero por socket. |

---

## 5. Pagos y Liberación

| Método | Endpoint | Roles Permitidos | Body / Params | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/pagos/cuenta/:cuenta_id` | `1`, `2`, `3` | URL Param: `cuenta_id` | Devuelve el total y el detalle dividido por `cliente_nombre`. |
| **POST**| `/pagos/pagar` | `1`, `2`, `3` | `cuenta_id`, `pagos`: `[{cliente_nombre, monto, metodo_pago}]` | Registra pago, cierra la cuenta, libera la mesa y desvincula mesas fusionadas. |

---

## 🔌 Eventos de WebSockets (Socket.io)

El frontend debe conectarse a `http://localhost:3000` usando el cliente de `socket.io-client`. El servidor emitirá los siguientes eventos que el frontend debe escuchar (`socket.on(...)`):

### 1. `mesas_actualizadas`
* **Cuándo ocurre:** Al fusionar mesas en recepción o al realizar un pago exitoso.
* **Qué hacer en el Front:** Volver a hacer un `GET /mesas` para repintar el mapa del restaurante.

### 2. `nueva_orden_cocina`
* **Cuándo ocurre:** Cuando el mesero envía una orden.
* **Payload que recibe:** `{ mensaje, mesa, detalles }`
* **Qué hacer en el Front:** Mostrar una alerta en la tablet de los cocineros y actualizar la lista de pendientes.

### 3. `pedido_listo_para_entregar`
* **Cuándo ocurre:** Cuando el cocinero marca un platillo como 'listo'.
* **Payload que recibe:** `{ mensaje, mesa, cliente, pedido_id }`
* **Qué hacer en el Front:** Lanzar una notificación push o visual en la tablet del mesero indicando a qué mesa debe llevar la comida.