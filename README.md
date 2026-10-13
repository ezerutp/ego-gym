# EGO Gym

App Android (React Native + Expo) para gestionar un gimnasio desde una tablet en recepción: clientes, membresías, cobros, tienda, reportes y alertas.

## Estado

- **Tienda** (heredada de Bodega Scan): ingreso de productos escaneando el código de barras, búsqueda automática en [Open Food Facts](https://world.openfoodfacts.org), [Open Beauty Facts](https://world.openbeautyfacts.org) y [Open Products Facts](https://world.openproductsfacts.org), almacén con filtros, venta con carrito y boleta para compartir por WhatsApp, alertas de poco stock y vencimiento con notificaciones locales.
- **Navegación**: en tablet, barra lateral con Inicio, Clientes, Tienda y Más, y el botón **Cobrar**; en teléfono, la misma navegación como barra inferior. La Tienda tiene sus propias secciones: Resumen, Almacén, Vender y Alertas.
- **Ajustes**: datos del gimnasio (salen en la boleta), alertas del almacén, notificaciones y bases públicas de productos. El botón **Sincronizar base de datos** está visible pero deshabilitado ("Próximamente").
- **Usuarios y permisos**: al abrir la app se elige el usuario y se ingresa su PIN de 4 dígitos. El primer arranque crea al administrador y muestra un código de recuperación para restablecer PIN olvidados sin internet. Desde el bloqueo, con "¿Olvidaste tu PIN?" se crea un PIN nuevo con ese código o con un código enviado al Telegram del admin. La recepción no accede a Ajustes ni a Usuarios ni puede eliminar registros. La tablet se bloquea sola tras los minutos sin uso configurados, y cada venta guarda quién la hizo.
- **Clientes y prospectos**: registro con foto, DNI, celular, fecha de nacimiento, contacto de emergencia, notas, estado y origen. Lista con búsqueda y filtros por estado, y ficha con botones para WhatsApp y llamar. En tablet, la lista y la ficha se ven lado a lado.
- **Planes, membresías y coaches**: el administrador configura los planes (vienen Mensual, Interdiario, Pase diario y Promo dúo) y los coaches. Desde la ficha se inscribe o renueva al cliente, con personalizado opcional. La membresía se ve como vigente, por vencer o vencida, con filtros en Clientes y un resumen en el Inicio.
- **Cobros, deudas y boletas**: el botón central **Cobrar** abre una venta de la tienda o el cobro de una membresía. El pago se registra al inscribir o como abono, con pagos parciales y su método. La deuda se calcula sola, y cada pago genera una boleta de membresía para compartir por WhatsApp.
- **Avisos**: campana en el Inicio y pantalla "Requiere atención" con membresías por vencer, vencidas, deudas y alertas de la tienda. Cada aviso trae un recordatorio por WhatsApp ya escrito y un botón para renovar o cobrar. El resumen diario y los recordatorios de vencimiento llegan como notificación (solo en el APK).
- **Reportes**: resumen general, ventas, cobros y clientes por periodo, en PDF o texto para compartir. El PDF del resumen trae KPIs con variación, gráficos de barras, tendencia, histograma y dona por método de pago. El administrador puede programarlos (diario, semanal o mensual): se generan solos al abrir la app o en segundo plano, y avisan con una notificación.
- **Integraciones**: Telegram, conectado con un bot propio, recibe solos los reportes programados y el resumen diario, y se usa en el botón "Enviar al admin" de boletas y reportes. Los mensajes de WhatsApp para clientes son plantillas editables, y los reportes también se pueden mandar al celular del admin por WhatsApp.
- **Respaldo**: exportar y restaurar la base de datos desde Ajustes.
- **Actualizaciones**: en Ajustes se apunta al repositorio de GitHub para buscar el último release con APK, descargarlo e instalarlo sin perder los datos.
- **Guía interactiva**: la primera vez que cada usuario abre las pantallas principales, una guía paso a paso resalta y explica cada opción. Se puede repetir desde Más.
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
    member/            Ficha, formulario, inscripción y abonos de clientes
    payment/[id].tsx   Boleta de membresía compartible
    charge.tsx         Cobrar: venta de tienda o membresía
    notifications.tsx  Requiere atención: avisos del gimnasio y la tienda
    reports/           Reportes: generar, programar, historial (solo admin)
    integrations.tsx   Telegram y WhatsApp (solo admin)
    plans/             Planes (solo admin)
    coaches/           Coaches (solo admin)
  features/
    alerts/            Lo que requiere atención y los mensajes de recordatorio
    auth/              Usuarios, PIN, sesión y permisos
    integrations/      Telegram (Bot API), envíos y reintentos
    members/           Clientes y prospectos: base de datos, contacto y componentes
    memberships/       Planes, coaches, membresías y su estado
    payments/          Pagos, deudas y boletas de membresía
    reports/           Datos, PDF, programación y tarea en segundo plano de los reportes
    store/             Base de datos, lógica y componentes de la tienda
    tour/              Guía interactiva: pasos, resaltado y avance por usuario
  db/                  Esquema SQLite y ajustes
  lib/                 Formatos, consultas al enfocar, diseño responsive y notificaciones
  components/          UI reutilizable (incluye el papel de las boletas)
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

Para generar el APK instalable (arm64-v8a) en esta máquina:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease   # android/app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

En la nube con EAS: `npx eas-cli@latest build -p android --profile preview`.

El ícono y el splash se regeneran con `python3 scripts/make-brand.py assets vista.png`.

Antes de entregar cambios: `npx tsc --noEmit` y `npx expo lint`.

## Documentación

- [`docs/PLAN.md`](docs/PLAN.md): plan de implementación por fases y estado de cada tarea.
- [`docs/NOTAS.md`](docs/NOTAS.md): hallazgos y decisiones técnicas.
- [`CHANGELOG.md`](CHANGELOG.md): cambios de cada etapa cerrada.
