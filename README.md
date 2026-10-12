# EGO Gym

App Android (React Native + Expo) para gestionar un gimnasio desde una tablet en recepción: clientes, membresías, cobros, tienda, reportes y alertas.

## Estado

- **Tienda** (heredada de Bodega Scan): ingreso de productos escaneando el código de barras, búsqueda automática en [Open Food Facts](https://world.openfoodfacts.org), [Open Beauty Facts](https://world.openbeautyfacts.org) y [Open Products Facts](https://world.openproductsfacts.org), almacén con filtros, venta con carrito y boleta para compartir por WhatsApp, alertas de poco stock y vencimiento con notificaciones locales.
- **Navegación**: en tablet, barra lateral con Inicio, Clientes, Tienda y Más, y el botón **Vender** para escanear; en teléfono, la misma navegación como barra inferior. La Tienda tiene sus propias secciones: Resumen, Almacén, Vender y Alertas.
- **Ajustes**: datos del gimnasio (salen en la boleta), alertas del almacén, notificaciones y bases públicas de productos. El botón **Sincronizar base de datos** está visible pero deshabilitado ("Próximamente").
- **Usuarios y permisos**: al abrir la app se elige el usuario y se ingresa su PIN de 4 dígitos. El primer arranque crea al administrador. La recepción no accede a Ajustes ni a Usuarios ni puede eliminar registros. La tablet se bloquea sola tras los minutos sin uso configurados, y cada venta guarda quién la hizo.
- **Clientes y prospectos**: registro con foto, DNI, celular, fecha de nacimiento, contacto de emergencia, notas, estado y origen. Lista con búsqueda y filtros por estado, y ficha con botones para WhatsApp y llamar. En tablet, la lista y la ficha se ven lado a lado.
- **Planes, membresías y coaches**: el administrador configura los planes (vienen Mensual, Interdiario, Pase diario y Promo dúo) y los coaches. Desde la ficha se inscribe o renueva al cliente, con personalizado opcional. La membresía se ve como vigente, por vencer o vencida, con filtros en Clientes y un resumen en el Inicio.
- **Próximamente**: cobros, deudas y boletas de membresía, reportes programados e integraciones (Telegram y WhatsApp).
- **Todo es local**: SQLite en el dispositivo, sin servidor.

## Estructura

```
src/
  app/                 Pantallas (Expo Router)
    (tabs)/            Inicio, Clientes, Más y la pestaña Tienda
      store/           Resumen, Almacén, Vender y Alertas de la tienda
    scan.tsx           Cámara (modo ingreso / modo venta)
    product/           Alta, detalle, edición y ajuste de stock
    receipt/[id].tsx   Boleta compartible
    settings.tsx       Ajustes
    users/             Gestión de usuarios (solo admin)
    member/            Ficha, formulario e inscripción de clientes
    plans/             Planes (solo admin)
    coaches/           Coaches (solo admin)
  features/
    auth/              Usuarios, PIN, sesión y permisos
    members/           Clientes y prospectos: base de datos, contacto y componentes
    memberships/       Planes, coaches, membresías y su estado
    store/             Base de datos, lógica y componentes de la tienda
  db/                  Esquema SQLite y ajustes
  lib/                 Formatos, consultas al enfocar y diseño responsive
  components/          UI reutilizable
  theme.ts             Colores, tipografía y espaciados
```

## Desarrollo

Para probar rápido sirve Expo Go. Las notificaciones quedan desactivadas ahí (Expo Go no permite `expo-notifications` en Android); todo lo demás funciona:

```bash
npm install
npm start                 # escanea el QR con Expo Go (Android)
```

Para un *development build* propio (ícono, nombre y permisos reales de la app):

```bash
npx expo run:android      # compila e instala en un emulador, tablet o teléfono conectado por USB
```

Para generar un APK instalable sin Android Studio: `npx eas-cli@latest build -p android --profile preview`.

Antes de entregar cambios: `npx tsc --noEmit` y `npx expo lint`.

## Documentación

- [`docs/PLAN.md`](docs/PLAN.md): plan de implementación por fases y estado de cada tarea.
- [`docs/NOTAS.md`](docs/NOTAS.md): hallazgos y decisiones técnicas.
- [`CHANGELOG.md`](CHANGELOG.md): cambios de cada etapa cerrada.
