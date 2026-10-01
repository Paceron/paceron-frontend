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

## Ajustes de la revisión con el equipo (2026-09-29)

Cuatro cambios pedidos al revisar la pantalla con datos cargados.

### 1. "Pagos" en el navbar

Ítem nuevo `paymentsRoute` al final de `navigationRoutes` (`routes/catalog.js`),
después de Entrenamientos: `{ name: 'payments', label: 'Pagos', href:
'/profile/payments', icon: 'cash-multiple' }`, **sin `role`**, porque el historial
es de cualquier usuario. Aparece solo en los tres shells (web ancho, web angosto y
mobile), que ya iteran `getRoutesByRole`. La tarjeta de Mi perfil se mantiene como
segunda entrada.

### 2. Pista en los tiles clickeables

Los tiles de "Cuotas pendientes" y "Cuotas rechazadas" filtran la lista, pero se
ven igual que los de monto, que no hacen nada. `StatTile` suma una prop opcional
`actionHint`: con ella muestra un chevron (›) y una línea de acción debajo de la
etiqueta, en color primario. Texto: "Tocá para filtrar"; activo, "Filtrando · tocá
para quitar", además del borde que ya tiene. Los tiles de monto no la llevan.

### 3. Mover la ventana del gráfico

El gráfico sigue mostrando 6 meses, pero se puede correr hacia atrás.

- Encabezado del gráfico: flechas ‹ › y el rango ("abr – sep 2026"). La › se
  deshabilita cuando la ventana termina en el mes actual. La ‹ se deshabilita
  cuando la ventana ya empieza en o antes de `earliest_month` (el primer mes con
  cobros que informa el backend), o si no hay cobros.
- El backend suma `until=YYYY-MM` a `/payments/received/summary` (ver el change de
  OpenSpec, D14). `useReceivedPaymentsSummary({ until })` agrega `until` a la query
  key, así cada ventana se cachea aparte y volver a una ya vista no repite el
  pedido.
- **Qué sigue a la ventana y qué no.** El gráfico y "Cobros por equipo" (que está
  al lado) usan la consulta con `until`. Los tiles (mes actual, variación,
  pendientes, rechazados) y la tarjeta del perfil usan siempre la consulta sin
  `until`: correr el gráfico no cambia "Cobrado en septiembre". El título de
  "Cobros por equipo" pasa a nombrar el período ("abr – sep 2026").
- La ventana vive en estado local de la pantalla (offset en meses, 0 = actual). Se
  vuelve a 0 al salir de la pantalla. El cálculo de `until` y del rango a partir del
  offset va en `utils/payments-summary.js` (`shiftMonth`, `windowRange`), testeado.

### 4. Bruto o neto

Control segmentado "Bruto / Neto" arriba del dashboard (`payments-amount-mode`),
estado local, bruto por defecto. Cambia juntos:

| Lugar | Bruto | Neto |
|---|---|---|
| Tile del mes | `gross_amount` del mes | `net_amount` del mes; "Sin datos de neto" si es `null` |
| Variación | contra el bruto del mes anterior | contra el neto del mes anterior; "—" y "Sin datos de neto" si falta alguno |
| Barras | bruto | neto; mes sin neto: barra vacía con "s/d"; neto parcial (`net_known_count < approved_count`): etiqueta del monto con "*" y nota al pie |
| Cobros por equipo | bruto | neto del equipo, con "neto parcial" si corresponde |

Nunca se estima el neto (misma regla de siempre). La lista de cobros no cambia:
ya muestra las dos columnas. La elección del valor por modo va en funciones puras
(`amountFor(entry, mode)` en `utils/payments-summary.js`, y `buildMonthlyBars`
recibe los valores ya elegidos más una marca de parcial/sin dato por barra), con
tests.

### Versión y verificación

Bump a 0.27.0 en la misma rama. Verificación con los datos sembrados
(`seed-qa-historial-*`): ítem del navbar en los tres shells, pista en los tiles,
‹ › con límite en `earliest_month`, bruto/neto en los cuatro lugares, y mobile sin
scroll horizontal.
