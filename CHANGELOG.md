# Changelog

Cambios visibles de la app por etapa. Durante una fase, los cambios se acumulan en "Sin publicar" y pasan a la sección de la fase cuando esta se cierra.

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
