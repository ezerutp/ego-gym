# Notas y decisiones

Hallazgos técnicos y decisiones tomadas durante el desarrollo, con fecha. Lo más reciente va arriba.

## 2026-10-31 — EGO-18 Etiquetas para productos sin código

- **Formato `EGO` + 10 dígitos en Code128.** Los códigos reales de tienda (EAN/UPC) son solo números, así que el prefijo con letras nunca choca con un producto escaneado y se distingue a simple vista. El escáner ya leía Code128, por lo que no hace falta otra librería. Se revisa en la base que el código generado no exista.
- **Codificador propio.** `code128.ts` (sin dependencias) usa el set B para el texto y el set C para los 10 dígitos finales (dos por barra), lo que deja la etiqueta en 154 módulos (~0,3 mm por módulo en 5 cm). Se probó decodificando con zxing códigos EGO, EAN-13 y alfanuméricos, y la hoja A4 generada a 300 dpi.
- **PDF con `expo-print` e imagen con `react-native-view-shot`.** El PDF dibuja las barras en SVG; la imagen captura la vista previa (`BarcodeLabel`, barras como `View`), que siempre es blanca como la boleta. Etiqueta de 50 × 30 mm, 3 × 8 por hoja A4.
- **Dígito verificador propio en los códigos EGO.** Son `EGO` + 9 dígitos al azar + 1 verificador (módulo 10 como en EAN). Detecta cualquier dígito cambiado y la mayoría de dígitos vecinos intercambiados (probado con 2000 códigos), sobre todo al escribir el código a mano.
- **Lecturas falsas de etiquetas EGO.** En las pruebas la cámara a veces devolvía otro código. Code128 ya trae su control (módulo 103) y el lector lo verifica, pero el escáner también tiene activados Codabar, Code39 e ITF, que no exigen control: una etiqueta borrosa o torcida podía salir como dígitos al azar en esos formatos. Ahora una lectura con "EGO" solo se acepta si es Code128 y su verificador cuadra, y Codabar, Code39 e ITF necesitan 3 lecturas iguales seguidas (la cámara lee varias por segundo, así que un código real no se nota más lento).
- **La entrada manual del escáner acepta letras** (en mayúsculas) para poder escribir un código EGO cuando la cámara no lo lee.

## 2026-10-13 — Ajustes y actualizaciones

- **El import root de `getContentUriAsync` ya no solo avisa: lanza error.** El mensaje pide migrar al API nuevo o importar de `expo-file-system/legacy`; como `File` no expone esa función, se importa del legacy y el instalador vuelve a abrir.
- **El repositorio sale del formulario largo.** Dueño y repo viven en un diálogo propio que guarda directo en ajustes; al guardar se recarga el formulario para no pisar valores con datos viejos.

## 2026-10-13 — Reporte general con gráficos

- **Gráficos en SVG puro, sin dependencias.** El PDF se genera con `expo-print` (un WebView), así que el SVG inline funciona sin librerías ni internet: barras apiladas día a día, línea de acumulado, histograma en 5 rangos fijos y dona por método.
- **Comparar exige el periodo anterior.** El resumen consulta los mismos totales en el periodo previo de igual longitud para el % de cada KPI; sin datos previos no se muestra insignia.
- **Solo el resumen lleva gráficos.** Los reportes de ventas, cobros y clientes mantienen su formato de tablas.

## 2026-10-13 — Confirmación de cobros y último admin

- **El guard del último admin ya existía y se probó.** `wouldRemoveLastAdmin` bloquea degradar o desactivar al único administrador (verificado contra SQLite en 5 casos). Lo nuevo es que el formulario lo muestra de frente: la opción Recepción y el interruptor Activo se deshabilitan con su motivo, en vez de fallar recién al guardar.
- **Confirmar solo cuando se mueve dinero.** Registrar pago e Inscribir/Renovar muestran un diálogo con cliente, monto, método y deuda restante; inscribir sin cobrar guarda directo porque no hay pago.

## 2026-10-13 — Actualizaciones desde GitHub

- **Sin Play Store ni EAS Update.** El APK se publica como asset de un release de GitHub y la app lo instala con el instalador del sistema (`expo-intent-launcher`, acción VIEW sobre el `content://` de `getContentUriAsync`). EAS Update no sirve: necesita su servidor y solo actualiza JS, no cambios nativos.
- **La BD sobrevive a la actualización.** Android conserva el almacenamiento privado al actualizar (mismo paquete y misma firma), y `migrateDb` sube el esquema sin borrar datos. Condiciones: firmar siempre con la misma clave (la actual es la de depuración) y subir el `versionCode` en cada release; desinstalar sí borra todo, por eso la pantalla recomienda el respaldo.
- **El permiso se concede una sola vez.** `REQUEST_INSTALL_PACKAGES` va en el manifiesto y Android pide permitir "instalar apps desconocidas" para EGO Gym; la pantalla abre ese ajuste directo (`MANAGE_UNKNOWN_APP_SOURCES` del propio paquete).
- **La API pública de GitHub alcanza.** `releases/latest` sin login permite 60 consultas por hora, suficiente para revisar al abrir Ajustes. Se elige el primer asset `.apk` del release y se compara el tag con `expoConfig.version`.

## 2026-10-13 — Recuperación de PIN

- **Dos vías, una siempre offline.** El código de recuperación (8 caracteres, formato XXXX-XXXX) vive como hash + sal en `settings`, así que no requiere migración y funciona sin internet. El código de Telegram (6 dígitos, tabla `pin_resets` en la migración v8) es de un solo uso, vence en 10 minutos y se agota en 3 intentos fallidos.
- **Telegram solo envía.** La tablet genera el código localmente y lo manda con el `sendText` existente al chat del admin; no se necesita leer mensajes del bot (`getUpdates`), lo que evita polling y webhooks. Si Telegram no está configurado, el error lo dice y ofrece la vía offline.
- **El código de recuperación se muestra una sola vez.** Al crear el admin inicial, la sesión se abre recién después de anotarlo; si la app se cierra antes, el admin ya existe y el código quedó guardado. Solo se guarda el hash: en Ajustes no se puede ver, solo generar uno nuevo (el anterior deja de funcionar).
- **Correo y WhatsApp descartados.** Sin backend no hay envío automático de correos, y WhatsApp exige que el usuario toque enviar (`wa.me`/compartir), así que no sirve para un desbloqueo.

## 2026-10-12 — Guía interactiva

- **Sin librerías.** La guía es propia (`src/features/tour/`), para no sumar dependencias nativas. Los elementos se marcan con `<TourTarget id="…">`, que registra una vista (con `collapsable={false}` para que exista en Android y se pueda medir). La capa `TourOverlay` está en el layout raíz, entre el `Stack` y el bloqueo, y mide el elemento con `measureInWindow`.
- **Resaltado con esquinas redondeadas y sin SVG.** La primera versión armaba el hueco con cuatro rectángulos y se veía tosca: esquinas rectas, borde blanco invisible sobre fondos claros, saltos secos entre pasos. Ahora la sombra es una sola vista con un borde enorme (3000 px) del color de la capa oscura; el borde interior de esa vista es el hueco, y su `borderRadius` (radio + 3000) lo redondea. Los botones redondos (como Cobrar) reciben un hueco circular. La misma vista bloquea los toques, para que la guía no quede a medias.
- **Animaciones suaves.** La capa entra y sale con fundido; entre pasos, el hueco se desliza y cambia de tamaño (320 ms, `Easing.out(cubic)`, con el driver de JS porque se animan posición y tamaño). El globo aparece con fundido y un pequeño desplazamiento (driver nativo), tiene una flecha que apunta al elemento y puntos de progreso. El borde del hueco es verde (`primary`), para que se vea sobre fondos claros.
- **Pasos que no aplican se saltan solos.** Si un elemento no está en pantalla (el botón "Bloquear" solo existe en la barra lateral de tablet) o el paso es de admin y entra recepción, se pasa al siguiente. Los pasos se definen en `tours.ts`, con `role` opcional.
- **Medir respecto de la capa, no de la ventana.** En el teléfono, todos los resaltados quedaban unos 35 dp más arriba: `measureInWindow` no tomaba el mismo origen que la capa de la guía (por la barra de estado en modo edge-to-edge). La capa tiene ahora un "ancla" invisible que la cubre; se miden el elemento y el ancla con `measureInWindow` y se restan, así cualquier desfase se cancela. El tamaño disponible también sale del ancla (`onLayout`) y no de `useWindowDimensions`.
- **Elementos más altos que la pantalla.** Si el globo no cabe ni arriba ni abajo, se resalta solo la parte de arriba del elemento y el globo va justo debajo. El scroll además considera un margen de 90 dp en los bordes, para que lo que queda bajo la barra de pestañas cuente como fuera de la vista.
- **Una vez por usuario.** La tablet es compartida, así que lo visto se guarda en `settings.toursSeen` por id de usuario. "Ver la guía otra vez" en Más limpia esa lista y vuelve a Inicio, donde la guía arranca sola.
- **Scroll hasta el elemento.** Las pantallas con scroll usan `TourScrollView`, que le pasa a la guía (por contexto) una forma de desplazarse. Antes de cada paso, si el elemento está fuera de la pantalla, o si no queda espacio para el globo ni arriba ni abajo, la guía hace scroll para dejarlo al 20 % de la altura, espera 400 ms a que termine la animación y vuelve a medir. Sin esto, en pantallas largas el resaltado y el globo quedaban fuera de la vista.
- **Espera antes de medir.** `useAutoTour` espera 700 ms después de que la pantalla toma el foco, para que el diseño y la navegación terminen de acomodarse antes de medir. Si ya hay una guía activa, no se inicia otra. Al girar la tablet, se vuelve a medir.

## 2026-10-12 — Fase 8

- **Marca.** El ícono adaptable usa un degradado verde de fondo y una pesa con "EGO" en blanco dentro de la zona segura (66 % central). El monocromo sirve para los íconos temáticos de Android 13+. El splash agrega "GYM" sobre el verde `#0B7A5C`. Todo se genera con `python3 scripts/make-brand.py assets vista.png` (Pillow y la fuente Montserrat); el segundo argumento crea una hoja de vista previa para aprobar los cambios antes de reemplazar los recursos.
- **Respaldo con la API de SQLite.** `backupDatabaseAsync` de `expo-sqlite` copia la base abierta a otra de forma consistente, aunque la app la esté usando. Exportar crea `documents/backups/ego-gym-respaldo-AAAAMMDD-HHMM.db` y abre el menú de compartir. Restaurar valida la cabecera `SQLite format 3` y que existan las tablas de la app, aplica las migraciones al respaldo (puede ser de una versión anterior), lo copia sobre la base actual y cierra la sesión. Las fotos no se incluyen.
- **El archivo elegido se lee como bytes.** `File.pickFileAsync` devuelve un archivo del selector de Android. Se lee con `bytes()` y se escribe en la carpeta de la app antes de abrirlo con SQLite, para no depender de permisos sobre el archivo original (como pasó con el PDF y las capturas).
- **Ajustes guarda solo lo que cambió.** Antes se escribía toda la configuración cargada al abrir la pantalla, lo que podía pisar valores que cambiaron en segundo plano (`telegramLastSummary`, `lastBackupAt`).
- **APK local.** `npx expo prebuild --platform android --clean` y luego `cd android && ./gradlew assembleRelease`. El plugin `withArm64Only` deja `reactNativeArchitectures=arm64-v8a`. El release se firma con la clave de depuración que genera Expo: sirve para instalarlo en la tablet, pero no para publicarlo en Play Store (hace falta un keystore propio o EAS).

## 2026-10-12 — Fase 7

- **Telegram sin servidor.** La app llama directo a la Bot API con `fetch` (`src/features/integrations/lib/telegram.ts`): `getMe` para validar el token, `getUpdates` para encontrar el chat que envió `/start`, `sendMessage`, `sendDocument` (PDF) y `sendPhoto` (boletas). Los archivos se suben con `FormData` adjuntando un `File` de `expo-file-system`. Hay un tiempo de espera de 20 s y los errores comunes se traducen al español (token inválido, chat no encontrado, bot bloqueado, sin internet).
- **`fetch` en SDK 57 es `expo/fetch`.** Expo reemplaza el `fetch` global por su versión WinterCG (salvo con `EXPO_PUBLIC_USE_RN_FETCH=1`), y esa versión **no acepta** las partes `{ uri, name, type }` de React Native en `FormData`: el texto llegaba a Telegram y el PDF fallaba. Ahora se adjunta `new File(uri)` de `expo-file-system`, que `expo/fetch` lee con `bytes()`.
- **Capturas de boletas para subir.** La captura de `react-native-view-shot` (`tmpfile`) queda en un caché que, en Expo Go, `expo-file-system` no puede leer (el mismo problema de permisos que tuvo el PDF). Para Telegram se captura en base64 y se escribe en `Paths.cache` de la app (`captureViewToAppFile`). Para compartir por WhatsApp sigue sirviendo el `tmpfile`.
- **El token vive en la tablet.** Se guarda en la tabla `settings`, como el resto de la configuración. Lo ve solo el admin (Integraciones está protegida) y no sale del dispositivo, salvo hacia Telegram. Si se comparte el archivo de la base, el token va dentro; en ese caso hay que revocarlo en @BotFather (`/revoke`).
- **`getUpdates` y los webhooks.** La detección del chat solo funciona si el bot no tiene un webhook configurado (un bot recién creado no lo tiene) y si el `/start` se envió en las últimas 24 horas.
- **Registro y reintentos.** Cada envío queda en `deliveries`. Los reportes y el resumen se pueden volver a armar, así que se reintentan solos al abrir la app y en la tarea de segundo plano (hasta 4 intentos, solo los de los últimos 3 días). Las boletas son una captura de pantalla que no se guarda: si fallan, se reenvían desde la boleta.
- **Resumen diario una vez al día.** `telegramLastSummary` guarda el día del último envío. Se envía en la primera revisión después de la hora del resumen (la misma de las notificaciones), ya sea al abrir la app o en segundo plano.
- **Plantillas de WhatsApp.** Las `{variables}` desconocidas se dejan tal cual, para que un error al escribir se note en el mensaje y no desaparezca en silencio.
- **`attachPdf` pasó a `pdf.ts`**, para que el envío no importe el runner de reportes, que a su vez importa el envío (import circular).

## 2026-10-12 — Fase 6

- **Qué periodo cubre cada programación** (`periodFor` en `schedule.ts`): diaria, ese día; semanal, los 7 días que terminan ese día; mensual, el mes anterior completo. Si se genera antes del mediodía, el diario y el semanal cierran el día anterior, porque a las 8:00 el día recién empieza. Las fechas se probaron con casos de ejemplo (lunes 12/10 14:30, diario 21:00 → 11/10; semanal domingo 21:00 → 05/10 al 11/10; mensual día 1 → setiembre).
- **Sin reportes duplicados ni atrasados en cadena.** Cada programación guarda la clave del último periodo generado (`last_period`). Al revisar, solo se genera el periodo de la última ejecución que debió ocurrir; si la tablet estuvo apagada una semana, no se generan 7 reportes diarios. Al editar una programación se borra la clave, para que genere de nuevo.
- **Segundo plano.** La tarea se define a nivel de módulo (`background.ts`, importado desde el layout raíz), abre su propia conexión a SQLite y aplica las migraciones. Android decide cuándo corre (mínimo 15 minutos), así que además se revisa al abrir o volver a la app. No funciona en Expo Go. **Falta confirmar en el APK** que `expo-print` genere el PDF en segundo plano; si falla, el reporte se guarda igual con su texto, y el PDF se crea al tocar "Compartir PDF".
- **Fechas en hora local.** `created_at` se guarda en UTC (`datetime('now')`). Los reportes filtran con `date(created_at, 'localtime')` para que una venta de las 22:00 cuente en el día correcto en Perú (UTC−5). Las consultas se probaron con el esquema real.
- **El reporte guardado y el que se ve.** El historial guarda el texto y el PDF del momento en que se generó. Al abrirlo en la app se recalcula: ventas y cobros del periodo no cambian, pero "por vencer" y "con deuda" muestran la situación actual, y así lo indica la pantalla.
- **PDF con colores claros siempre**, como las boletas, y guardado en `documents/reports/` para poder compartirlo días después.
- **No mover el archivo que crea `expo-print`.** En Expo Go, `File.move` sobre ese archivo del caché falló con "Missing 'READ' permission". Se pide el PDF en base64 (`printToFileAsync({ base64: true })`) y se escribe directo en `documents/reports/` con `File.write(..., { encoding: 'base64' })`.

## 2026-10-12 — Fase 5

- **Avisos calculados, sin tabla de historial.** El plan contemplaba una tabla `notifications`. Pero si los avisos se guardaran, quedarían desactualizados apenas alguien paga o renueva. `computeAttention` los calcula al abrir la pantalla con las mismas consultas de los filtros de Clientes, y el contador de la campana es la suma.
- **Vencidas de los últimos 30 días.** Las membresías vencidas hace más de 30 días (`EXPIRED_LOOKBACK_DAYS`) ya no salen como pendientes, para que la lista no se llene de exclientes. Se pueden seguir viendo con el filtro "Vencidos" de Clientes.
- **Notificaciones con contenido fijo.** Una notificación local no puede consultar la base de datos al dispararse. Por eso `rescheduleAlerts` borra y vuelve a programar todo cada vez que cambia algo: al abrir la app, al inscribir, cobrar, anular, editar clientes, vender o ajustar stock. El resumen diario muestra lo que había en la última reprogramación.
- **Límite de alarmas.** Android permite unas 500 alarmas por app. Los recordatorios de membresía se limitan a las 60 que vencen primero (dos avisos cada una: N días antes y el mismo día).
- **Notificaciones solo en el APK.** En Expo Go no funcionan desde SDK 53 (ya pasaba en Bodega Scan). Los avisos dentro de la app sí funcionan en Expo Go.
- **Mensajes de WhatsApp fijos.** Están en `src/features/alerts/lib/messages.ts`. En la fase 7 pasan a ser plantillas editables desde Integraciones.
- **El módulo de notificaciones pasó a `src/lib/notifications.ts`**, porque ya no es solo de la tienda.

## 2026-10-12 — Fase 4

- **La deuda se calcula, no se guarda.** Es el precio del plan más los adicionales, menos la suma de los pagos (`SUBSCRIPTION_TOTAL_SQL` y `SUBSCRIPTION_PAID_SQL` en `payments.ts`). Si se anula un pago o una membresía, la deuda se actualiza sola. Las consultas se probaron con el esquema real en SQLite (cliente con plan de 80 + personalizado de 100 y pagos de 100 + 30: deuda de 50).
- **Pago dentro de la inscripción.** `insertPayment` no abre su propia transacción, para poder ir dentro de la transacción de `createSubscription`: la membresía y su primer pago se guardan juntos o no se guarda ninguno. `expo-sqlite` no permite anidar `withTransactionAsync`.
- **Una boleta por pago.** Cada pago genera su boleta (`M001-` + id del pago), separada de las ventas de la tienda (`B001-`). La boleta muestra lo pagado hasta ese pago (no lo pagado después), para que una boleta vieja no cambie si luego hay más abonos.
- **Abonos a la deuda más antigua.** Desde Cobrar y desde "Registrar pago" se abona primero a la membresía más antigua con saldo pendiente.
- **Compartir la boleta.** Se captura la vista como PNG (`react-native-view-shot`) y se abre el menú de compartir del sistema, donde WhatsApp aparece como opción. Una app no puede enviar una imagen directo a un chat de WhatsApp sin que el usuario lo elija. El papel de la boleta y la función de compartir están en `src/components/ReceiptPaper.tsx` y los usan las dos boletas.

## 2026-10-12 — Fase 3

- **Días inclusivos.** Un plan de 30 días que empieza el 1 termina el 30 (`endDateFor` = inicio + duración - 1). Un pase diario empieza y termina el mismo día.
- **Renovación encadenada.** Si la membresía sigue vigente, la renovación empieza el día siguiente a su fin, para no perder días pagados. Si ya venció, empieza hoy. Las dos fechas se pueden cambiar a mano.
- **Copia del nombre del plan.** `subscriptions.plan_name` guarda el nombre del plan al momento de inscribir. Si luego el plan se renombra o se desactiva, el historial no cambia. Por eso los planes se desactivan en vez de borrarse.
- **El estado de la membresía se calcula, no se guarda.** Se usa la última fecha de fin (`MAX(end_date)`) de cada cliente frente a la fecha de hoy, y así nunca queda desactualizado. El estado del cliente (prospecto, activo o inactivo) es otra cosa: indica la relación con el gimnasio, no si su plan está vigente.
- **Personalizado como adicional.** Va en `subscription_addons` con las mismas fechas de la membresía, para sumarlo en la boleta de la fase 4. La tabla tiene su propio inicio y fin por si más adelante se venden personalizados de duración distinta.
- **Planes y coaches son solo para el admin**, porque cambian precios. La recepción igual puede elegir plan y coach al inscribir.

## 2026-10-12 — Fase 2

- **DNI único pero opcional.** El índice `idx_members_dni` es parcial (`WHERE dni IS NOT NULL`) y los campos opcionales vacíos se guardan como `NULL`, así varios prospectos pueden quedar sin DNI. Además se valida antes de guardar, para mostrar a quién pertenece un DNI repetido.
- **Fotos de clientes.** La cámara y la galería devuelven archivos en el caché, que Android puede limpiar. Se copian a `documents/member-photos/` al guardar (`persistMemberPhoto`).
- **WhatsApp.** Se abre `https://wa.me/<número>`. Un celular de 9 dígitos se completa con el código de Perú (51); si el número ya trae código, se usa tal cual.
- **Dos columnas en tablet.** La lista y la ficha conviven en la pestaña Clientes. La ficha (`MemberDetail`) es un componente reutilizado también en la ruta `member/[id]` del teléfono, y se recarga al volver del formulario porque usa `useFocusQuery`.
- **Prospecto a cliente.** Por ahora, con "Marcar como activo". Cuando exista la inscripción en planes (fase 3), inscribir a un prospecto lo pasará a activo.

## 2026-10-12 — Fase 1

- **PIN con hash.** Se guarda `SHA-256(sal:PIN)` con `expo-crypto` y una sal aleatoria por usuario, nunca el PIN en claro. Con 4 dígitos el hash no impide que alguien con acceso al archivo de la base pruebe las 10 000 combinaciones. Lo que se busca es que el PIN no se pueda leer directamente; la protección real es la espera tras 5 intentos fallidos en la pantalla de bloqueo.
- **No usar `Stack.Protected` con guardas que cambian al iniciar sesión.** En el teléfono (Expo Go, SDK 57), cuando una guarda de `Stack.Protected` cambiaba al abrir la sesión, React volvía a renderizar el layout raíz (`root render user Ezer`), pero el cambio nunca llegaba a la pantalla: el bloqueo seguía visible y aceptando toques. Pasó tanto con la app entera protegida como solo con las pantallas de admin. La solución es que la lista de pantallas del `Stack` no cambie nunca:
  - El bloqueo se dibuja como una capa encima del `Stack` cuando no hay sesión (`LockScreen`), bloquea el botón atrás y, al cerrar sesión, cierra las pantallas abiertas con `router.dismissAll()`.
  - El layout raíz no se suscribe a la sesión. Aun sin `Stack.Protected`, cuando el raíz (que contiene el `Stack`) se volvía a renderizar al iniciar sesión, a veces ese render no llegaba a la pantalla. Ahora `LockGate`, un componente al lado del `Stack`, es el único que escucha la sesión y muestra u oculta el bloqueo.
  - Ajustes y Usuarios se protegen dentro de la propia pantalla con `AdminOnly`, que muestra "Solo administrador" a quien no es admin.
- **Diagnosticar con logs en Metro.** Los `console.log` de Expo Go salen en la terminal de `npx expo start`, no en `adb logcat`. En este Xiaomi, `adb` además se desconecta seguido, y MIUI bloquea `input tap` y `pm clear` si no está activada "Depuración USB (ajustes de seguridad)". Para empezar de cero: Ajustes → Aplicaciones → Expo Go → Borrar datos.
- **Cambio de rol del propio usuario.** Si el admin se quita el rol o se desactiva a sí mismo, primero se sale de la pantalla y después se actualiza la sesión, para que `AdminOnly` no reemplace el formulario mientras `router.back()` está en curso.
- **Detectar actividad.** `onTouchStartCapture` no existe en los tipos de `View`. Se usa `onStartShouldSetResponderCapture` devolviendo `false`, que registra cada toque sin quitarle el gesto a los hijos. Falta confirmar en la tablet que también cuenta los toques que empiezan un scroll.
- **La sesión vive en memoria.** Si Android cierra la app, al volver se pide el PIN otra vez. Es intencional para una tablet compartida.
- **expo-doctor.** Reporta 4 paquetes (`expo`, `expo-router`, `expo-sharing` y `expo-splash-screen`) con versiones de parche más nuevas; ya venían así de Bodega Scan. Se actualizarán en un PR aparte.

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
