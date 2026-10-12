# Notas y decisiones

Hallazgos técnicos y decisiones tomadas durante el desarrollo, con fecha. Lo más reciente va arriba.

## 2026-10-12 — Fase 0

- **Una sola app en vez de dos.** Se copió el código de Bodega Scan (no el repo ni como submódulo). Así se evita duplicar rutas y dependencias, y los reportes pueden juntar las ventas de la tienda con los cobros de membresías. Desde ahora Bodega Scan y EGO Gym evolucionan por separado.
- **Sin servidor.** La app corre en una sola tablet compartida, así que SQLite alcanza. La columna `synced` de `products` y `sales` y el botón "Sincronizar" quedan para una futura sincronización.
- **WhatsApp no permite enviar mensajes automáticamente desde una app.** Hace falta la API de WhatsApp Cloud con un servidor. Por ahora la app arma el mensaje o el PDF y abre WhatsApp (`wa.me` o compartir), y el usuario toca enviar.
- **Telegram sí permite el envío automático sin servidor.** La app llama directamente a la Bot API (`sendMessage`, `sendDocument`) con el token del bot guardado en el dispositivo. El `chat_id` del admin se obtiene con `getUpdates` después de que el admin le escribe `/start` al bot.
- **Android no garantiza una hora exacta para las tareas en segundo plano.** Los reportes programados se generan "alrededor" de la hora configurada con `expo-background-task` y, como respaldo, se revisan los pendientes cada vez que se abre la app.
- **Navegación en tablet.** El `Tabs` de `expo-router/js-tabs` acepta `tabBarPosition: 'left' | 'top'`. Se usa `'left'` para la barra lateral cuando el ancho es de 768 o más (`useIsWide` en `src/lib/layout.ts`) y `'top'` para las secciones de la Tienda.
- **Rutas tipadas.** `.expo/types/router.d.ts` se genera al correr `npx expo start`. Si `tsc` falla después de agregar o mover pantallas, hay que levantar Expo una vez para regenerarlo.
- **Lint `react/display-name`.** Una función que devuelve JSX fuera de un componente (por ejemplo, un `renderTab` creado dentro de un hook) dispara el error. La solución es convertirla en un componente.
- **Pendiente de la fase 0.** El ícono y el splash siguen siendo los de Bodega Scan. Las pantallas heredadas de la tienda están diseñadas para teléfono: en tablet se estiran, aunque funcionan. Ambos puntos quedaron en la fase 8.
