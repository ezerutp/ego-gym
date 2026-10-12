# Plan de implementación

App Android para la tablet de recepción de un gimnasio. La usan el administrador y el recepcionista en el mismo dispositivo. Todo se guarda localmente (SQLite) y no hay servidor.

Cada fase se entrega en uno o más PRs `EGO-XX` hacia `staging`. Al cerrar una fase se actualiza `CHANGELOG.md`.

## Alcance acordado

- **Una sola app**: el gimnasio y la tienda juntos. La tienda se copió de Bodega Scan y ya no se sincroniza con ese repo.
- **Clientes y prospectos**: registro con foto, datos de contacto y estado.
- **Planes configurables**: nombre, precio, duración y tipo. "Interdiario" es solo un nombre de plan. La promo dúo es un tipo de plan y no obliga a registrar a la otra persona.
- **Personalizado con coach**: un servicio adicional sobre la membresía, con coach asignado y precio propio, que suma a la boleta.
- **Cobros por adelantado**: pagos, deudas, vencimientos y boleta compartible con dos botones, "Enviar al admin" (Telegram) y "Compartir por WhatsApp".
- **Usuarios con PIN**: roles `admin` y `recepcionista`.
- **Reportes programados**: diarios, semanales o mensuales; de ventas, clientes y cobros; en PDF.
- **Notificaciones en la app**: membresías por vencer, deudas atrasadas, poco stock y productos por vencer.
- **Integraciones**: Telegram automático con un bot y WhatsApp manual.
- **Fuera de alcance por ahora**: control de asistencia, servidor y sincronización (el botón queda deshabilitado), y la API de WhatsApp.

## Permisos

| Acción | Admin | Recepcionista |
|---|:-:|:-:|
| Registrar y editar clientes, cobrar, vender | ✅ | ✅ |
| Ver deudas y vencimientos | ✅ | ✅ |
| Almacén: ingresar productos y ajustar stock | ✅ | ✅ |
| Borrar clientes, productos, pagos o ventas | ✅ | ❌ |
| Planes, precios y coaches | ✅ | ❌ |
| Reportes, integraciones, usuarios y ajustes | ✅ | ❌ |

## Fases

### Fase 0 — Base con la tienda ✅ (EGO-01)

- [x] Copiar el código de Bodega Scan y renombrar la app a EGO Gym (`pe.egogym.app`, `ego-gym.db`)
- [x] Mover la tienda a `src/features/store`
- [x] Pestaña Tienda con las secciones Resumen, Almacén, Vender y Alertas
- [x] Navegación con barra lateral en tablet y barra inferior en teléfono (Inicio, Clientes, Tienda, Más)
- [x] Ajustes en una pantalla aparte, con el botón Sincronizar deshabilitado
- [x] Skills `ego-dev` y `ego-pr`, plan, notas y changelog (EGO-02)

### Fase 1 — Usuarios y permisos (EGO-03)

- [x] Tabla `users` (nombre, rol, PIN con hash y sal, activo) en la migración v2
- [x] Primer arranque: crear el usuario admin con su PIN
- [x] Pantalla de bloqueo con selección de usuario y teclado de PIN, pensada para tablet (espera de 30 s tras 5 intentos fallidos)
- [x] Sesión activa en memoria, botón "Cambiar usuario" (en Más) o "Bloquear" (en la barra lateral) y bloqueo automático tras X minutos sin uso (configurable en Ajustes)
- [x] Hook `useCan(permiso)`, bloqueo como capa sobre la app y `AdminOnly` en las pantallas de admin
- [x] Pantalla Usuarios (solo admin): crear, editar, desactivar y cambiar PIN, siempre con al menos un admin activo
- [x] Registrar quién hizo cada venta (`user_id` en `sales`, "Atendió" en la boleta). Los pagos lo harán en la fase 4.

### Fase 2 — Clientes y prospectos

- [ ] Tabla `members`: nombres, DNI, teléfono, foto, fecha de nacimiento, contacto de emergencia, notas, estado (`prospecto`, `activo`, `inactivo`), origen del prospecto
- [ ] Lista con búsqueda (nombre, DNI, teléfono) y filtros por estado: activos, por vencer, vencidos, con deuda, prospectos
- [ ] Alta y edición con foto (cámara o galería, reutiliza `PhotoPicker`)
- [ ] Ficha del cliente: datos, membresía actual, historial de pagos y deuda
- [ ] Convertir un prospecto en cliente al inscribirlo en un plan
- [ ] Botón "Escribir por WhatsApp" desde la ficha
- [ ] Diseño en dos columnas en tablet (lista y ficha)

### Fase 3 — Planes, membresías y coaches

- [ ] Tabla `plans`: nombre, tipo (`mensual`, `interdiario`, `diario`, `promocion`, `otro`), precio, duración en días, activo
- [ ] Pantalla Planes (solo admin) con los planes iniciales sugeridos
- [ ] Tabla `coaches`: nombre, teléfono, foto, especialidad, activo
- [ ] Pantalla Coaches con sus clientes asignados
- [ ] Tabla `subscriptions`: cliente, plan, inicio, vencimiento, precio acordado y estado
- [ ] Tabla `subscription_addons` para el personalizado: coach, precio, inicio y vencimiento
- [ ] Inscribir y renovar: elegir plan, fecha de inicio, precio editable y personalizado opcional
- [ ] Estados calculados: vigente, por vencer (N días configurables), vencida

### Fase 4 — Cobros, deudas y boletas

- [ ] Tabla `payments`: membresía, monto, método (efectivo, Yape/Plin, tarjeta, transferencia), usuario y fecha
- [ ] Deuda calculada: precio acordado más adicionales, menos lo pagado
- [ ] Botón central **Cobrar**: elegir entre membresía y venta de tienda
- [ ] Pagos parciales y abonos a una deuda
- [ ] Boleta de membresía (cliente, plan, personalizado y coach, vigencia, pagado y pendiente) como imagen, reutilizando la boleta de la tienda
- [ ] Botones de la boleta: "Compartir por WhatsApp" (ahora) y "Enviar al admin" (se activa en la fase 7)
- [ ] Numeración de boletas propia para membresías

### Fase 5 — Inicio y notificaciones

- [ ] Inicio: accesos rápidos, números del día (ingresos de membresías y tienda, activos, por vencer, deuda total) y lista "Requiere atención"
- [ ] Tabla `notifications` (historial en la app) y campana con contador
- [ ] Reglas: membresías por vencer o vencidas, deudas atrasadas, poco stock, productos por vencer
- [ ] Unir las alertas de la tienda con las del gimnasio
- [ ] Resumen diario como notificación local a la hora configurada
- [ ] Recordatorio por WhatsApp al cliente desde la alerta ("tu membresía vence mañana")

### Fase 6 — Reportes

- [ ] Tipos de reporte: ventas de la tienda, cobros de membresías, clientes (nuevos, por vencer, vencidos, con deuda) y resumen general
- [ ] Generar el PDF con `expo-print` y compartirlo
- [ ] Tabla `report_schedules`: tipo, frecuencia (diaria, semanal, mensual), día y hora, formato (texto o PDF) y destino
- [ ] Ejecutar los reportes pendientes al abrir la app y en segundo plano con `expo-background-task`
- [ ] Historial de reportes generados

### Fase 7 — Integraciones

- [ ] Pantalla Integraciones (solo admin)
- [ ] Telegram: pegar el token del bot, detectar el `chat_id` con `/start` y enviar una prueba
- [ ] Envío automático por Telegram de alertas cortas, reportes en PDF y boletas ("Enviar al admin")
- [ ] WhatsApp: número del admin y plantillas de mensaje editables (recordatorio de pago, vencimiento)
- [ ] Registro de envíos y reintento si no hubo internet

### Fase 8 — Pulido y entrega

- [ ] Ícono, splash y colores de marca de EGO
- [ ] Adaptar a tablet las pantallas heredadas de la tienda (almacén y venta en dos columnas)
- [ ] Respaldo y restauración manual de la base de datos (exportar e importar un archivo)
- [ ] Perfil `preview` de EAS y APK firmado
- [ ] Actualizar los paquetes de Expo con versiones de parche pendientes (`npx expo install --check`)
- [ ] Pruebas completas en la tablet, en horizontal, vertical, tema claro y oscuro

### Futuro

- Servidor y sincronización (Supabase): varios dispositivos y respaldo en la nube
- API oficial de WhatsApp Cloud para envíos automáticos a clientes
- Control de asistencia por QR, si se pide
