# Notas y decisiones

Hallazgos técnicos y decisiones tomadas durante el desarrollo, con fecha. Lo más reciente va arriba.

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
