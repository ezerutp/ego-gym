# Changelog

Cambios visibles de la app por etapa. Durante una fase, los cambios se acumulan en "Sin publicar" y pasan a la sección de la fase cuando esta se cierra.

## [Sin publicar]

### Agregado

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
