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

### Fase 2 — Clientes y prospectos (EGO-04)

- [x] Tabla `members` en la migración v3: nombres, apellidos, DNI (único), celular, foto, fecha de nacimiento, contacto de emergencia, notas, estado (`prospect`, `active`, `inactive`), origen y quién lo registró
- [x] Lista con búsqueda (nombre, DNI, celular) y filtros por estado con contadores: Todos, Activos, Prospectos, Inactivos
- [x] Filtros por vencimiento (por vencer, vencidos) y "con deuda", hechos en las fases 3 y 4
- [x] Alta y edición con foto de la cámara o la galería, copiada al almacenamiento de la app
- [x] Ficha del cliente con sus datos, edad y un espacio para la membresía (se completa en las fases 3 y 4)
- [x] Prospectos: origen ("¿Cómo nos conoció?") y botón "Marcar como activo". En la fase 3 pasan a activos al inscribirlos en un plan.
- [x] Botones "WhatsApp" y "Llamar" desde la ficha
- [x] En tablet, dos columnas: la lista y la ficha
- [x] Eliminar clientes solo como administrador

### Fase 3 — Planes, membresías y coaches (EGO-05)

- [x] Tabla `plans` en la migración v4: nombre, tipo (`monthly`, `alternate`, `daily`, `promo`, `other`), precio, duración en días y activo. Vienen precargados Mensual, Interdiario, Pase diario y Promo dúo, con precio 0 para que el admin lo defina.
- [x] Pantalla Planes (solo admin), con aviso de planes sin precio
- [x] Tabla `coaches`: nombre, celular, foto, especialidad y activo
- [x] Pantalla Coaches (solo admin) con sus clientes de personalizado vigente
- [x] Tabla `subscriptions`: cliente, plan (más una copia del nombre), inicio, fin, precio acordado, notas y quién la registró
- [x] Tabla `subscription_addons` para el personalizado: coach, precio y las mismas fechas de la membresía
- [x] Inscribir y renovar desde la ficha: plan, inicio (al renovar, el día siguiente al fin vigente), fin calculado y editable, precio editable y personalizado opcional. Al inscribirse, un prospecto o un cliente inactivo pasa a activo.
- [x] Estados calculados: vigente, por vencer (N días configurables en Ajustes) y vencida, visibles en la ficha, la lista, los filtros y el Inicio
- [x] Historial de membresías en la ficha. El admin puede anular una membresía.

### Fase 4 — Cobros, deudas y boletas (EGO-06)

- [x] Tabla `payments` en la migración v5: membresía, cliente, monto, método (efectivo, Yape/Plin, tarjeta, transferencia), notas, usuario y fecha
- [x] Deuda calculada: precio acordado más el personalizado, menos lo pagado, por membresía y por cliente
- [x] Pago en el mismo paso al inscribir o renovar ("Monto pagado", lleno con el total y editable para pagos parciales)
- [x] Abonos a una deuda desde la ficha ("Registrar pago") y desde Cobrar
- [x] Botón central **Cobrar**: venta de la tienda o membresía. Al elegir un cliente con deuda se registra un abono; si no tiene deuda, se renueva o inscribe.
- [x] Boleta de membresía (`M001-…`) como imagen: cliente, plan, personalizado y coach, vigencia, este pago, lo pagado a la fecha y lo pendiente
- [x] Botones de la boleta: "Compartir por WhatsApp" y "Enviar al admin" (visible, se activa en la fase 7)
- [x] Ficha con la deuda, la lista de pagos y sus boletas. El admin puede anular un pago.
- [x] Inicio con los ingresos del día (membresías + tienda) y las deudas

### Fase 5 — Inicio y avisos (EGO-07)

- [x] Inicio: accesos rápidos, números del día (ingresos de membresías y tienda, activos, por vencer, deuda total) y lista "Requiere atención" con los 5 casos más urgentes
- [x] Campana con contador y pantalla "Requiere atención" con todo lo pendiente
- [x] Reglas: membresías por vencer, vencidas (últimos 30 días), deudas, poco stock y productos por vencer
- [x] Alertas de la tienda y del gimnasio unidas en la misma pantalla
- [x] Resumen diario como notificación local a la hora configurada (membresías, deudas y almacén), con recordatorios por cada membresía que vence
- [x] Recordatorio por WhatsApp al cliente desde cada aviso, con el mensaje ya escrito (vencimiento, vencida o deuda), y botón directo para renovar o cobrar
- [ ] ~~Tabla `notifications` con historial~~: descartado. Los avisos se calculan en el momento, así nunca quedan desactualizados (ver `docs/NOTAS.md`).

### Fase 6 — Reportes (EGO-08)

- [x] Tipos de reporte: resumen general, ventas de la tienda, cobros de membresías y clientes (registrados, por vencer, vencidos y con deuda)
- [x] Generar a mano con periodos rápidos (hoy, ayer, últimos 7 días, este mes, mes anterior)
- [x] PDF con `expo-print`, guardado en el almacenamiento de la app y compartible. También se puede compartir el resumen en texto.
- [x] Tablas `report_schedules` y `reports` en la migración v6: tipo, frecuencia (diaria, semanal, mensual), día, hora, formato (PDF o texto) y activo
- [x] Ejecutar los reportes pendientes al abrir o volver a la app, y en segundo plano con `expo-background-task` (mínimo cada 15 minutos, cuando Android lo permita)
- [x] Notificación "Reporte listo" al generarse un reporte programado
- [x] Historial de reportes generados (solo admin)

### Fase 7 — Integraciones (EGO-09)

- [x] Pantalla Integraciones (solo admin)
- [x] Telegram: pegar el token del bot (se valida con `getMe`), detectar el chat del admin con `/start` (`getUpdates`) y enviar una prueba
- [x] "Enviar al admin" por Telegram en las boletas de membresía y de venta (como imagen) y en los reportes (en PDF)
- [x] Envío automático de los reportes programados (PDF o texto) y del resumen diario de avisos a la hora del resumen, cada uno se puede activar o desactivar
- [x] Registro de envíos (`deliveries`, migración v7) con estado y error; los reportes y resúmenes fallidos se reintentan al abrir la app y en segundo plano (hasta 4 intentos en 3 días)
- [x] WhatsApp: celular del admin ("WhatsApp al admin" en reportes) y plantillas editables de los mensajes para clientes con `{nombre}`, `{fecha}`, `{monto}` y `{gimnasio}`

### Fase 8 — Pulido y entrega (EGO-10)

- [x] Ícono, splash y marca de EGO (pesa + "EGO" en el verde de la app), aprobados antes de aplicarlos; se generan con `scripts/make-brand.py`
- [x] Pantallas heredadas de la tienda adaptadas a tablet: venta en dos columnas (búsqueda y carrito) y almacén en cuadrícula
- [x] Respaldo y restauración manual de la base de datos (exportar e importar un archivo `.db`) desde Ajustes
- [x] Paquetes de Expo actualizados a las versiones de parche esperadas (`expo-doctor` pasa los 21 chequeos) y `expo-system-ui` para el tema claro/oscuro nativo
- [x] Perfiles `preview` (APK) y `production` (AAB) de EAS, y APK de release compilado localmente para arm64-v8a
- [ ] Pruebas completas del APK en la tablet: vertical, horizontal, claro, oscuro, notificaciones, segundo plano y Telegram
- [ ] Firma propia para publicar (hoy el APK de release se firma con la clave de depuración)

### Después de la 1.0

- [x] Guía interactiva para usuarios nuevos (EGO-11): tooltips paso a paso que resaltan cada opción la primera vez que cada usuario abre Inicio, Clientes, Cobrar, Tienda y Más, y que se pueden repetir desde Más
- [x] Recuperación de PIN (EGO-12): "¿Olvidaste tu PIN?" en el bloqueo con código de recuperación offline (se muestra una sola vez al crear el admin, se regenera en Ajustes) y código de un solo uso al Telegram del admin (6 dígitos, vence en 10 minutos)
- [x] Actualizaciones desde GitHub (EGO-13): en Ajustes se apunta al repositorio, se consulta el último release con APK, y se descarga e instala desde la app conservando los datos
- [x] Cobros con confirmación y rol protegido (EGO-14): Registrar pago e Inscribir/Renovar piden confirmar el monto antes de guardar; al editar al único administrador, el rol Recepción y la desactivación aparecen bloqueados
- [x] Reporte general profesional (EGO-15): el PDF del resumen trae KPIs con variación vs el periodo anterior, barras apiladas de ingreso diario, tendencia acumulada, histograma de montos y dona por método de pago
- [x] Ajustes y actualizaciones (EGO-16): repositorio de GitHub en un diálogo con solo Editar y Buscar actualización, y corrección del instalador del APK
- [x] Productos sin código de barras (EGO-18): el escáner genera un código `EGO` + 10 dígitos (Code128) y la etiqueta de 5 × 3 cm se imprime o se comparte en PDF (una o una hoja A4 de 24) o como imagen
- [ ] Probar la impresión y lectura de etiquetas EGO en la tablet
- [ ] Probar la guía en la tablet en horizontal y vertical
- [ ] Probar la actualización desde GitHub en la tablet (permiso de apps desconocidas, descarga e instalación)

### Futuro

- Servidor y sincronización (Supabase): varios dispositivos y respaldo en la nube
- API oficial de WhatsApp Cloud para envíos automáticos a clientes
- Control de asistencia por QR, si se pide
