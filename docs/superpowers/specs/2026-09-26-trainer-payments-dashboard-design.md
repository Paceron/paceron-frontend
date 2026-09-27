# Historial de pagos y cobros

## Contexto

**HU "Historial de pagos y facturación":** como usuario quiero acceder a mi
historial de pagos y facturación para tener trazabilidad de mis suscripciones y
pagos a entrenadores. Criterios: listado con fecha, monto, método, tipo
(suscripción / pago a entrenador) y estado; descarga de comprobantes en PDF; web y
mobile.

La HU cubre a **cualquier usuario**. Además, el entrenador con el rol activo
conserva lo que se construyó primero para él: sus cobros y un dashboard.

Un entrenador no tiene forma de ver su dinero en la app: ni lo que le paga a
Paceron por su suscripción de tier, ni lo que le pagaron los corredores por
pertenecer a sus equipos. La ubicación ya estaba resuelta en
`docs/BACKEND_PAYMENTS_REQUIREMENTS.md`: una sección en el perfil del
entrenador, no dentro del detalle de cada equipo, para tener una vista
consolidada cuando maneja varios.

El backend suma tres endpoints nuevos en el change de OpenSpec
`historial-pagos-cobros-entrenador` (repo `paceron-backend`, rama
`feature/historial-pagos-cobros-entrenador`). El contrato está congelado ahí;
este frontend lo consume.

## Alcance

**Sí:**
- **Historial de pagos para cualquier usuario** en `/profile/payments`: fecha,
  tipo, detalle, método, estado, monto y comprobante en PDF de los pagos
  aprobados. Filtros por tipo y por estado.
- En Mi perfil, una tarjeta "Historial de pagos" que lleva a esa pantalla.
- Con el rol entrenador **activo**, la tarjeta pasa a ser "Pagos y cobros":
  cobrado este mes con el neto, variación contra el mes anterior, pendientes y
  rechazados, y un botón **Ver todo**.
- Pantalla nueva `/profile/payments` con:
  - dashboard: cobrado este mes, evolución de los últimos 6 meses (barras),
    cobros por equipo, pendientes y rechazados;
  - pestaña **Cobros**: listado paginado con filtros por equipo y estado;
  - pestaña **Mis pagos**: el mismo historial que ve cualquier usuario.
- Montos: el bruto siempre, y el neto solo cuando Mercado Pago lo informó.

**No** (fuera de esta spec):
- Comisión de Paceron. La `marketplace_fee` que guarda el backend es ficticia:
  el split nunca le manda `application_fee` a Mercado Pago. No se muestra.
- Checkout del corredor para pagar la membresía de un equipo. Hasta que
  exista, "Cobros" va a estar vacío en producción.
- Exportación (CSV, PDF) y vista de pagos del corredor.
- Cambios en los shells o en `routes/catalog.js`: se llega desde el perfil.

## Contrato consumido

Los tres requieren token; el usuario sale del token, no hay `:id` en el path.

| Endpoint | Uso |
|---|---|
| `GET /api/v1/payments/received?page&team_id&status` | Listado de cobros. `status` es un grupo: `approved`, `pending`, `rejected`, `refunded`. 20 por página, `has_more`. |
| `GET /api/v1/payments/received/summary?months=6` | Dashboard y tarjeta del perfil. `monthly` trae 6 meses seguidos y el último es el actual. |
| `GET /api/v1/payments/history?page&type&status` | Historial propio. `type` es `subscription` o `trainer_payment`; según el tipo viene `tier`, o `team` + `trainer`. |

Reglas que el frontend respeta sin recalcular:
- `net_amount` puede ser `null`. Nunca se inventa: se muestra "Neto no
  disponible" o "Neto parcial … (x de y)" usando `net_known_count`.
- Los meses vienen cortados en hora argentina por el backend.
- Pendientes y rechazados vienen contados por cuota, sobre el último intento.

## Diseño

### Gate por rol

La tarjeta y la pantalla dependen de `hasTrainerRole && activeRole === 'trainer'`.
`TrainerDataSection` sigue gateada solo por `hasTrainerRole`, como hoy. La
pantalla va dentro de `RequireAuth`; si el rol activo no es entrenador
redirige a `/profile`. No redirige mientras `usePermissions` carga, para evitar
el redirect espurio que ya documenta `profile-screen.jsx`.

### Comprobante en PDF

Solo de pagos aprobados. El HTML lo arma `utils/receipt-html.js` (lógica pura,
testeada) y lo imprime `services/receipt.js` / `receipt.web.js`:

- **Nativo:** `expo-print` (`printToFileAsync`) genera un PDF real y
  `expo-sharing` abre la hoja de compartir del sistema.
- **Web:** `expo-print` en web ignora el HTML e imprime la ventana entera (su
  implementación web es solo `window.print()`). Por eso el comprobante se carga
  en un `iframe` oculto y se imprime ese documento; el diálogo del navegador
  ofrece "Guardar como PDF". No abre ventanas emergentes.

El comprobante dice explícitamente que no es una factura fiscal.

### Estado de servidor

`hooks/use-payment-history.js`:
- `useReceivedPaymentsSummary` con `useQuery`.
- `useReceivedPayments` y `useMyTierPayments` con **`useInfiniteQuery`**.

Es el primer `useInfiniteQuery` del repo, y rompe a propósito el precedente de
`use-team-search.js` (acumulación manual). Acá hay pull-to-refresh: el
`refetch` de un infinite query vuelve a pedir todas las páginas ya cargadas, y
la acumulación a mano no lo resuelve sin reescribir esa lógica.

### Componentes

- `components/shared/stat-tile.jsx`: extraído de `team-detail-screen.jsx`, que
  lo sigue usando con los mismos ids (`idPrefix="team-detail-stat"`).
- `components/profile/payments-summary-card.jsx`: la tarjeta del perfil.
- `components/profile/payments-screen.jsx`: breadcrumb "Mi perfil / Pagos y
  cobros" (mismo patrón que `tier-upgrade-screen.jsx`), dashboard, pestañas y
  lista. Tocar el tile de rechazados o pendientes filtra la lista de cobros.
- `components/profile/payments-dashboard.jsx` y
  `payments-monthly-chart.jsx`: el gráfico es SVG a mano con
  `react-native-svg` (ya instalado, sin librería de gráficos nueva), con el
  ancho medido por `onLayout`.
- `components/profile/payments-list.jsx`, `payment-row.jsx`,
  `payments-filters.jsx`: filtros con `ResponsiveSelectField`.

### Responsive

| | Web ancha (≥ 1024 px) | Web angosta y nativo |
|---|---|---|
| Contenedor | `max-w-5xl` | ancho completo |
| KPIs | 4 en una fila | grilla 2×2 |
| Gráfico y equipos | 2 columnas | apilados |
| Lista | tabla (Fecha · Corredor · Equipo · Estado · Bruto · Neto) | tarjetas de 2 líneas |

Pull-to-refresh solo en mobile, como en el resto del repo.

### Mocks

`services/__mocks__/payment-history-mock.js` replica el contrato con datos
generados relativos a un "hoy" inyectable: tres equipos, unos 60 intentos en 6
meses, ~60% con neto, rechazos (uno seguido de un aprobado en la misma cuota),
un `in_process`, un `refunded` y un mes sin cobros. Aplica las mismas reglas de
resumen que el backend, así que sirve también para validar que el contrato se
entiende igual de los dos lados.

## Verificación

- `npm test` (utils, mock y normalizers) y `npm run lint`.
- Preview con mocks y después contra el backend real:
  1. Como corredor no aparece la tarjeta; al cambiar a entrenador sí.
  2. **Ver todo** abre `/profile/payments`.
  3. Pestañas, filtros, "Cargar más" y tocar el tile de rechazados.
  4. Por debajo de 1024 px: grilla 2×2 y tarjetas.
  5. `/profile/payments` como corredor redirige a `/profile`.
- En dispositivo: pull-to-refresh y que el gráfico mida bien el ancho.
