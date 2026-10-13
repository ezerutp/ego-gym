import type { Role } from '@/features/auth/db/users';

export type TourStep = {
  /** Id given to a `TourTarget`; steps whose target is not on screen are skipped. */
  target: string;
  title: string;
  text: string;
  role?: Role;
};

export type TourId = 'home' | 'members' | 'charge' | 'store' | 'more';

export const TOURS: Record<TourId, TourStep[]> = {
  home: [
    { target: 'home-quick', title: 'Accesos rápidos', text: 'Registra un cliente, cobra una membresía, haz una venta o ingresa productos con un solo toque.' },
    { target: 'home-today', title: 'Tu día en números', text: 'Ingresos de hoy, clientes activos, membresías por vencer y deudas. Toca una tarjeta para ver el detalle.' },
    { target: 'home-bell', title: 'Avisos', text: 'La campana cuenta todo lo que requiere atención: vencimientos, deudas y productos con poco stock.' },
    {
      target: 'home-attention',
      title: 'Requiere atención',
      text: 'Los casos más urgentes, con botones para escribirle al cliente por WhatsApp, renovar su membresía o cobrarle.',
    },
    { target: 'nav-charge', title: 'Cobrar', text: 'El botón principal: cobra una membresía (o un abono a una deuda) o haz una venta de la tienda.' },
    { target: 'nav-members', title: 'Clientes', text: 'Registra clientes y prospectos con su foto, inscríbelos en un plan y revisa sus pagos.' },
    { target: 'nav-store', title: 'Tienda', text: 'El almacén, las ventas con escáner de códigos de barras y las alertas de stock y vencimiento.' },
    { target: 'nav-more', title: 'Más', text: 'Planes, coaches, reportes, integraciones, usuarios y ajustes. También puedes volver a ver esta guía desde aquí.' },
    { target: 'nav-lock', title: 'Bloquear la tablet', text: 'Al terminar tu turno, bloquea la tablet para que la siguiente persona entre con su propio PIN.' },
  ],
  members: [
    { target: 'members-add', title: 'Nuevo cliente', text: 'Registra a un cliente o prospecto con su foto, DNI y celular.' },
    { target: 'members-search', title: 'Buscar', text: 'Encuentra a cualquier cliente por su nombre, DNI o celular.' },
    {
      target: 'members-filters',
      title: 'Filtros',
      text: 'Revisa rápido quién está por vencer, quién ya venció o quién tiene deuda. Desde la ficha del cliente lo inscribes, renuevas o cobras.',
    },
  ],
  charge: [
    { target: 'charge-store', title: 'Venta de la tienda', text: 'Abre el escáner para vender productos y generar la boleta.' },
    {
      target: 'charge-members',
      title: 'Cobrar una membresía',
      text: 'Elige al cliente: si tiene deuda se registra un abono; si no, se renueva o inscribe en un plan. Los que deben aparecen primero.',
    },
  ],
  store: [
    { target: 'store-sections', title: 'Secciones de la tienda', text: 'Resumen del día, Almacén con todos tus productos, Vender con el carrito y Alertas de stock y vencimiento.' },
    { target: 'store-quick', title: 'Ingresar productos', text: 'Escanea el código de barras: la app busca el nombre y la foto en bases públicas y solo te pide la cantidad y el precio.' },
  ],
  more: [
    { target: 'more-user', title: 'Cambiar de usuario', text: 'Bloquea la app para que otra persona entre con su PIN. Cada venta y cobro guarda quién lo hizo.' },
    {
      target: 'more-gym',
      title: 'Configura tu gimnasio',
      text: 'Empieza poniéndole precio a los planes y registrando a tus coaches. Aquí también están los reportes.',
      role: 'admin',
    },
    {
      target: 'more-system',
      title: 'Sistema',
      text: 'Conecta Telegram para recibir reportes y boletas, crea los usuarios de recepción y haz respaldos desde Ajustes.',
      role: 'admin',
    },
    { target: 'more-guide', title: 'Volver a ver la guía', text: 'Si alguien nuevo usa la tablet, puede repetir esta guía cuando quiera.' },
  ],
};
