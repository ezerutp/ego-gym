# Bodega Scan

App Android (React Native + Expo) para gestionar el almacén de una bodega escaneando códigos de barras.

## Funciones

- **Ingreso al almacén por cámara**: escaneas el código y la app busca el producto:
  1. Si ya está en tu almacén, solo pregunta cuántas unidades ingresan (y permite actualizar precio y vencimiento).
  2. Si no, lo busca a la vez en tres bases públicas y gratuitas: [Open Food Facts](https://world.openfoodfacts.org) (alimentos y bebidas), [Open Beauty Facts](https://world.openbeautyfacts.org) (cuidado personal) y [Open Products Facts](https://world.openproductsfacts.org) (limpieza y otros). Muestra *"Encontré esta información, ¿es correcto?"* con nombre, marca, imagen y la base de donde salió. Puedes aceptarlo o editarlo.
  3. Si no existe en ningún lado, lo registras a mano con nombre, marca y una foto tomada con la cámara.
- **Datos del producto**: cantidad, precio (opcional), fecha de vencimiento (opcional) y stock mínimo propio (opcional).
- **Alertas**: poco stock, agotado, por vencer y vencido. Hay notificaciones locales con un resumen diario a la hora que elijas, un aviso X días antes del vencimiento, otro el mismo día y un aviso al instante cuando una venta deja un producto bajo el mínimo.
- **Ventas**: escaneo continuo (escanea uno tras otro sin cerrar la cámara) o búsqueda por nombre, carrito con cantidades y precios editables, y boleta generada como imagen para compartir por WhatsApp.
- **Ajustes**: datos de la bodega (salen en la boleta), stock mínimo por defecto, días de aviso de vencimiento, hora del resumen, notificaciones y qué bases públicas consultar al escanear un código nuevo (cada una se activa o desactiva por separado). El botón **Sincronizar base de datos** está visible pero deshabilitado ("Próximamente").
- **Todo es local**: SQLite en el dispositivo; las imágenes de productos se descargan y guardan localmente para que funcione sin internet.

## Estructura

```
src/
  app/                 Pantallas (Expo Router)
    (tabs)/            Inicio, Almacén, Vender, Ajustes + botón central de escaneo
    scan.tsx           Cámara (modo ingreso / modo venta)
    product/new.tsx    Alta de producto o ingreso de stock tras escanear
    product/[id].tsx   Detalle, edición, ajuste de stock e historial
    receipt/[id].tsx   Boleta compartible
    alerts.tsx         Listado de alertas
  db/                  Esquema SQLite y consultas (productos, ventas, ajustes)
  lib/                 Búsqueda de productos, notificaciones, alertas, carrito, formatos
  components/          UI reutilizable
  theme.ts             Colores, tipografía y espaciados
```

Las tablas `products` y `sales` tienen la columna `synced` para cuando se implemente la sincronización.

## Desarrollo

Para probar rápido sirve Expo Go. Las notificaciones quedan desactivadas ahí (desde SDK 53 Expo Go no permite `expo-notifications` en Android); todo lo demás funciona:

```bash
npm install
npm start                 # escanea el QR con Expo Go (Android)
```

Para un *development build* propio (ícono, nombre y permisos reales de la app):

```bash
npx expo run:android      # compila e instala en un emulador o teléfono conectado por USB
```

Para generar un APK instalable sin Android Studio: `npx eas-cli@latest build -p android --profile preview`.

Antes de entregar cambios: `npx tsc --noEmit` y `npx expo lint`.
