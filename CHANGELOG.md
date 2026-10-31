# Changelog

Cambios visibles de la app por etapa. Durante una fase, los cambios se acumulan en "Sin publicar" y pasan a la sección de la fase cuando esta se cierra.

## [Sin publicar]

### Agregado

- Recuperación de PIN: en el bloqueo, "¿Olvidaste tu PIN?" permite crear un PIN nuevo con el código de recuperación (se muestra una sola vez al crear el administrador y se regenera en Ajustes → Seguridad) o con un código enviado al Telegram del administrador.
- Actualizaciones: en Ajustes se apunta al repositorio de GitHub para ver el último release con APK, descargarlo e instalarlo sin perder los datos.
- Cobros con confirmación: Registrar pago e Inscribir/Renovar muestran el monto, el método y la deuda restante para confirmar antes de guardar.
- Reporte general con gráficos: el PDF del resumen incluye variación vs el periodo anterior, ingreso diario en barras, tendencia acumulada, histograma de montos y cobros por método.
- El repositorio de actualizaciones se configura en un diálogo aparte con solo Editar y Buscar actualización.
- Productos sin código de barras: en Ingresar productos, "Producto sin código de barras" le asigna un código que empieza con EGO. Al guardarlo, o desde la ficha del producto con "Imprimir etiqueta", se imprime su etiqueta de 5 × 3 cm con borde redondeado para recortar: una sola o una hoja A4 de 24, en PDF o como imagen.
- El código se puede escribir a mano con letras, para ingresar los códigos EGO.

### Corregido

- Instalar el APK descargado desde la app ya no falla por el import deprecado de expo-file-system.
- Guía interactiva: la primera vez que cada usuario abre Inicio, Clientes, Cobrar, Tienda y Más, aparecen globos que resaltan cada opción y explican para qué sirve, paso a paso, con botones Atrás, Siguiente y Saltar. Los pasos de configuración solo se muestran al administrador.
- "Ver la guía otra vez" en Más.

## Fase 8 — Pulido y entrega (2026-10-12)

### Agregado

- Ícono y pantalla de inicio (splash) con la marca de EGO.
- Respaldo de la base de datos desde Ajustes: exportar un archivo para guardarlo en Drive, correo o WhatsApp, y restaurarlo en la tablet. Muestra la fecha del último respaldo.
- APK de la app para instalar en la tablet (arm64-v8a).

### Cambiado

- En tablet, la venta de la tienda muestra la búsqueda y el carrito lado a lado, y el almacén se ve en cuadrícula.
- El tema claro u oscuro también se aplica al fondo nativo de Android.

### Corregido

- Guardar Ajustes ya no reemplaza valores que cambiaron en segundo plano (como el último resumen enviado por Telegram).

## Fase 7 — Integraciones (2026-10-12)

### Agregado

- Pantalla Integraciones (solo administrador) en Más.
- Conexión con Telegram en tres pasos: crear el bot con @BotFather, pegar el token y enviarle /start desde el Telegram del administrador. Incluye un mensaje de prueba.
- "Enviar al admin" por Telegram en las boletas de membresía, en las boletas de venta y en los reportes.
- Los reportes programados y un resumen diario de avisos (por vencer, deudas y almacén) llegan solos al Telegram del administrador. Cada envío se puede activar o desactivar.
- Registro de envíos recientes, con reintento de los que fallaron.
- Celular del administrador para enviarle reportes por WhatsApp.
- Los mensajes de WhatsApp para clientes (membresía por vencer, vencida y deuda) se pueden editar, con {nombre}, {fecha}, {monto} y {gimnasio}.

## Fase 6 — Reportes (2026-10-12)

### Agregado

- Pantalla Reportes (solo administrador) en Más.
- Cuatro reportes: resumen general, ventas de la tienda, cobros de membresías y clientes, para hoy, ayer, los últimos 7 días, este mes o el mes anterior.
- Cada reporte muestra sus números principales y tablas (productos más vendidos, cobros por método, clientes nuevos, por vencer y con deuda), y se comparte como PDF o como texto.
- Reportes programados diarios, semanales o mensuales, a la hora elegida, en PDF o en texto. Se generan solos al abrir la app o en segundo plano, y avisan con una notificación.
- Historial de reportes generados.

## Fase 5 — Inicio y avisos (2026-10-12)

### Agregado

- Campana en el Inicio con el número de pendientes, y una pantalla "Requiere atención" con las membresías por vencer, las deudas, las vencidas en los últimos 30 días y las alertas de la tienda.
- Sección "Requiere atención" en el Inicio con los 5 casos más urgentes.
- En cada aviso, un botón de WhatsApp con el recordatorio ya escrito para el cliente (vencimiento, membresía vencida o deuda) y un botón directo para renovar o cobrar.
- El resumen diario (notificación) incluye membresías por vencer y clientes con deuda, además del almacén.
- Recordatorios por notificación cuando una membresía está por vencer y el mismo día que vence.

### Cambiado

- Las notificaciones ya no son solo del almacén: el canal se llama "Alertas de EGO Gym" y la sección de Ajustes, "Alertas y notificaciones".

## Fase 4 — Cobros, deudas y boletas (2026-10-12)

### Agregado

- Al inscribir o renovar se registra el pago en el mismo paso, con método (efectivo, Yape/Plin, tarjeta o transferencia). Si se paga menos del total, lo que falta queda como deuda.
- Abonos a la deuda desde la ficha del cliente con "Registrar pago".
- Boleta de membresía para compartir por WhatsApp, con el plan, el personalizado, la vigencia, lo pagado y lo pendiente. El botón "Enviar al admin" ya aparece y se activará con Telegram.
- La ficha muestra la deuda, el historial con lo que se debe de cada membresía y la lista de pagos con sus boletas. El administrador puede anular un pago.
- Filtro "Con deuda" en Clientes, y la deuda visible en cada fila.
- El Inicio muestra los ingresos del día (membresías y tienda) y el total de deudas.

### Cambiado

- El botón central ahora es **Cobrar**: permite elegir entre una venta de la tienda o cobrar la membresía de un cliente. Los clientes con deuda aparecen primero.
- El acceso rápido "Cobrar membresía" del Inicio ya funciona.

## Fase 3 — Planes, membresías y coaches (2026-10-12)

### Agregado

- Planes configurables por el administrador (nombre, tipo, precio y duración). Vienen precargados Mensual, Interdiario, Pase diario y Promo dúo, listos para ponerles precio.
- Coaches con foto, celular y especialidad, y la lista de sus clientes con personalizado.
- Inscripción y renovación desde la ficha del cliente: se elige el plan, las fechas y el precio, y opcionalmente un personalizado con coach. Al inscribirse, un prospecto pasa a cliente activo.
- La ficha muestra la membresía actual (vigente, por vencer o vencida) y su historial. El administrador puede anular una membresía.
- Filtros "Por vencer" y "Vencidos" en Clientes, y el estado de la membresía en cada fila.
- El Inicio muestra cuántas membresías están por vencer y cuántas vencieron.
- Ajuste de los días de aviso antes del vencimiento (5 por defecto).

## Fase 2 — Clientes y prospectos (2026-10-12)

### Agregado

- Pestaña Clientes con búsqueda por nombre, DNI o celular, y filtros Todos, Activos, Prospectos e Inactivos con sus totales.
- Registro y edición de clientes con foto (cámara o galería), DNI, celular, fecha de nacimiento, contacto de emergencia, notas, estado y "¿Cómo nos conoció?".
- Ficha del cliente con su edad, sus datos y botones para escribirle por WhatsApp, llamarlo o editarlo. Los prospectos tienen un botón "Marcar como activo".
- En tablet, la lista y la ficha se ven lado a lado.
- El Inicio muestra los clientes activos y los prospectos, y el acceso "Nuevo cliente" ya funciona.
- Solo el administrador puede eliminar clientes.

## Fase 1 — Usuarios y permisos (2026-10-12)

### Agregado

- Pantalla de bloqueo: se elige el usuario y se entra con un PIN de 4 dígitos. Tras 5 intentos fallidos hay que esperar 30 segundos.
- En el primer arranque se crea el usuario administrador.
- Roles de administrador y recepción. Recepción no puede entrar a Ajustes ni a Usuarios, ni eliminar productos, y las opciones exclusivas del administrador aparecen como "Solo admin".
- Pantalla Usuarios para crear, editar, desactivar y cambiar el PIN de cada persona.
- Bloqueo automático tras los minutos sin uso configurados en Ajustes (5 por defecto, 0 para nunca).
- Botón "Bloquear" en la barra lateral y "Cambiar usuario" en Más.
- Cada venta registra quién la hizo, y la boleta lo muestra en "Atendió".
- Plan de implementación del proyecto (`docs/PLAN.md`) y notas de decisiones técnicas (`docs/NOTAS.md`).

## Fase 0 — Base con la tienda (2026-10-12)

### Agregado

- App EGO Gym para tablet, que también funciona en teléfono y en orientación horizontal o vertical.
- Navegación con barra lateral en tablet (barra inferior en teléfono): Inicio, Clientes, Tienda y Más, con el botón **Vender** siempre visible.
- Tienda completa heredada de Bodega Scan: ingreso de productos por escáner con búsqueda en bases públicas, almacén con filtros, venta con carrito, boleta para compartir por WhatsApp y alertas de poco stock y vencimiento.
- Secciones de la Tienda: Resumen, Almacén, Vender (con el contador del carrito) y Alertas.
- Inicio con saludo, accesos rápidos y las ventas de hoy de la tienda.
- Pantalla Más con Planes, Coaches, Reportes, Integraciones y Usuarios (próximamente) y Ajustes.

### Cambiado

- Los ajustes muestran los datos del gimnasio. El botón **Sincronizar base de datos** sigue deshabilitado ("Próximamente").
