# Split marketplace corredor-entrenador (Sub-proyecto B) — Decisiones y lineamientos

> A diferencia del spec de [Sub-proyecto A](./2026-08-12-subscription-tier-checkout-design.md), este documento sigue sin ser un spec paso a paso — pero tras varias rondas de repaso con reglas de negocio confirmadas, la arquitectura y casi todas las decisiones de UX/operativas quedaron resueltas. Lo que sigue abierto, **pospuesto deliberadamente** hasta tener más avance, son dos valores puramente financieros/estratégicos: **porcentaje de comisión** y **precio mínimo de mensualidad** — ver checklist al final.

## Contexto y alcance

Cubre el Caso 2 del [análisis de viabilidad](./2026-08-11-payments-integration-feasibility-analysis.md): el corredor paga al entrenador por pertenecer a su equipo/recibir entrenamiento, con Paceron reteniendo una comisión (`marketplace_fee`). A diferencia de Sub-proyecto A (pago único, un solo vendedor), acá aparecen tres elementos que A no tiene: **un tercero cobrando** (el entrenador, no Paceron), **una relación de negocio recurrente** (membership de equipo, con vencimiento mensual real), y **estados de mora** (`SUBSCRIPTION_STATUSES` ya existe en `store/team-store.js`, hoy cosmético).

## Mecánica de cobro confirmada (regla de negocio, no técnica)

- El corredor paga **manualmente** para pertenecer a un equipo — **no hay débito automático**, ni ahora ni como objetivo del producto.
- Ese pago es **válido por un mes**.
- Al vencer, hay un **plazo de gracia de 5 días** para renovar (decidido — mismo valor que Sub-proyecto A, misma mecánica).
- Si no se renueva dentro del plazo de gracia, el corredor es **expulsado automáticamente** del equipo.
- Antes del primer pago, el equipo puede tener un **período de prueba configurable por el entrenador**: `No` / `1 semana` / `2 semanas` / `4 semanas`. Recién terminado ese período (si lo hay) el pago pasa a ser obligatorio para seguir en el equipo.

Esto resuelve el fork arquitectónico que este documento tenía abierto — ver siguiente sección.

## Fork arquitectónico — resuelto

Se había identificado (verificado contra documentación oficial de Mercado Pago, no una suposición) que el split (`marketplace_fee`) y el cobro recurrente automático (`/preapproval`, "Suscripciones") son productos distintos de MP que no se combinan en un solo mecanismo — lo que obligaba a elegir entre dos arquitecturas de fondo. Con la mecánica de cobro confirmada arriba, la elección queda resuelta:

### Camino elegido — Recurrencia gestionada por Paceron, split real de MP en cada cobro

Cada mes, se genera un pago puntual normal — el mismo mecanismo ya diseñado para Sub-proyecto A, con `marketplace_fee` en la preferencia. MP nunca sabe que es una relación recurrente; la recurrencia (qué corresponde cobrar, cuándo, plazo de gracia, expulsión) vive enteramente en el backend de Paceron. Esto encaja exactamente con "no hay débito automático" — de hecho, la ausencia de auto-debit es **la razón de negocio** que hace que este camino sea el correcto, no solo el más simple técnicamente.

Reutiliza 100% el mecanismo ya diseñado y documentado para A (`checkout-brick.jsx`, `WebView`+`postMessage`, `services/payments.js`) y requiere `mp-connect` (OAuth del entrenador), tal como estaba previsto desde el documento de propuesta backend original.

### Camino descartado — Suscripción real de MP a nombre de Paceron, payout aparte

Se documenta igual, para que quede registrado por qué no se eligió: usar `/preapproval` de MP daría cobro automático real, pero el dinero entraría a la cuenta de Paceron (no hay forma de dirigir un `/preapproval` a una cuenta de tercero vía OAuth), obligando a un proceso de liquidación propio + probable revisión legal/regulatoria por retener y redistribuir dinero de terceros. Como el producto **no quiere débito automático**, esta ventaja (la única razón real para considerar este camino) no aplica — queda descartado porque resuelve un problema que el producto no tiene, no por complejidad.

## Qué es compartido con Sub-proyecto A

- `checkout-brick.jsx`, la ruta `/checkout`, el mecanismo `WebView`+`postMessage`+inyección de sesión: tal cual, solo cambia el `access_token` server-side que usa el backend al crear la preferencia (el del entrenador conectado vía `mp-connect`, no el de Paceron) y que la preferencia lleve `marketplace_fee`.
- `services/payments.js` se extiende (no se duplica): `createPreference` necesita aceptar a qué entrenador/equipo corresponde el pago, además de (o en vez de) `tierId`.
- **"Equipo congelado"** (documentado en el spec de A, sección "Vencimiento y renovación del tier"): cuando un entrenador baja de tier y su equipo excede el nuevo límite de miembros, el equipo se bloquea para entrenador y corredores por igual. Aunque lo dispara A (tier del entrenador), afecta directamente a los corredores de B — **resuelto: modo solo lectura para el corredor**, decidido así por adelantado aunque hoy no exista ninguna función de corredor atada a tier que cortar (el plan de entrenamiento, la más obvia, todavía no está implementado).

## `mp-connect` — vinculación OAuth del entrenador

Mismo patrón de redirección que MP documenta oficialmente para Expo (`WebBrowser.openAuthSessionAsync` + deep link) — el mismo mecanismo que se descartó para el checkout de A por no ser "de marca Paceron" **sí aplica bien acá**, porque el propósito de esta pantalla es explícitamente autorizar una cuenta externa, no simular ser parte del checkout de Paceron (conceptualmente igual a "Conectar con Google").

**Ubicación sugerida:** junto a `bank_alias`, en el flujo del entrenador (`activate-trainer-screen.jsx` o una sección nueva dentro de `edit-profile-screen.jsx`) — mismo dominio conceptual ("cómo cobra el entrenador"). **Conviven, no se reemplazan** — `bank_alias` sigue existiendo tal cual está (sin split), `mp-connect` se suma como mecanismo nuevo específico para pagos con split, sin migrar ni deprecar nada existente.

## Configuración por equipo — precio y período de prueba

Nueva superficie de UI, en `create-team-screen.jsx`/`edit-team-screen.jsx` (no una pantalla aparte, dos campos nuevos en el flujo ya existente de crear/editar equipo):

- **Precio de la mensualidad:** lo fija el entrenador, por equipo (no un valor único de plataforma ni global del entrenador — un mismo entrenador puede tener equipos con precios distintos). Debe ser **mayor o igual al precio mínimo** que define el sistema (backoffice, `platform_settings`, mismo criterio que `marketplace_fee`) — el frontend valida contra ese mínimo, y debería **consultarlo y mostrárselo al entrenador** al momento de configurar el precio (ej. "el mínimo permitido es $X"), no solo rechazar después de intentar guardar un valor menor.
- **Período de prueba:** selector `No` / `1 semana` / `2 semanas` / `4 semanas`, también por equipo. Determina cuánto tiempo un corredor nuevo puede estar en el equipo antes de que el pago sea obligatorio (`en_prueba` en `SUBSCRIPTION_STATUSES`, que ya existía en el enum sin uso real).

## Renovación — mismo mecanismo que el pago inicial

Renovar es literalmente pagar de nuevo — mismo `checkout-brick.jsx`/`WebView` que el pago inicial de membership, sin pantalla ni componente nuevo. Dos formas de llegar ahí:

- **Proactiva:** el corredor renueva antes de vencer, desde algún punto de la UI de su equipo (a definir dónde exactamente — candidato natural: `team-detail-screen.jsx` o una vista de "mi membership").
- **Reactiva:** ya venció y está en plazo de gracia — mismo botón, con un banner de aviso (ver estados de mora abajo).

**Necesita del backend:** una fecha de vencimiento/próximo cobro por membership, expuesta en el roster o en una consulta dedicada — hoy no existe ningún campo así. Sin esto, el frontend no puede mostrar "vence en 3 días" ni decidir cuándo mostrar la urgencia de renovación.

## Control de pagos — pendiente / realizado / morosidad

El frontend ya tiene el modelo de estados (`SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba']`, `store/team-store.js:31`), hoy cosmético — `subscriptionStatus` siempre llega `null` de la API real.

- **Los estados los define el backend, no el frontend** — el frontend nunca infiere `vencido`/`activo` comparando fechas localmente; sería divergir de la fuente de verdad si el backend ajusta la duración del plazo de gracia.
- **La expulsión automática por mora reutiliza la misma acción que la expulsión manual ya existente** (`RunnerActionsMenu`, ya en producción) — es el backend quien la dispara (job programado), no una acción nueva de frontend. El roster debería reflejar el resultado igual que cuando el entrenador expulsa manualmente hoy.
- **Dónde se muestra el estado:** `team-detail-screen.jsx` ya tiene el hook de roster (`hooks/use-team-roster.js`) y los tags `SUBSCRIPTION_META` montados — lugar natural, sin pantalla nueva.
- **Durante el plazo de gracia:** el corredor sigue usando el equipo con normalidad — **banner de aviso, sin bloquear nada**, indicando que debe renovar antes de tal fecha para no ser expulsado.
- **`en_prueba`** confirmado que existe, configurable por equipo (ver sección de arriba) — durante ese período no corresponde ningún pago ni aviso de vencimiento.

## Comisión — porcentual, visible solo para el entrenador

Confirmado con ejemplo concreto: mensualidad de $100.000 con comisión del 5% → $5.000 le corresponden a Paceron. Coincide exactamente con la fórmula que ya describe el documento de propuesta backend original (`marketplace_fee = round(amount × percentage / 100)`). El valor exacto del porcentaje sigue sin definir (configurable por owner vía backoffice, `platform_settings`).

**Transparencia — resuelto, con un matiz importante:** el corredor **no** ve el desglose — solo le importa el precio total del servicio de estar en el equipo. Quien sí necesita ver el desglose (cuánto recibió neto, cuánto se llevó el sistema) es el **entrenador** — es su dinero el que se reparte. **Ubicación resuelta:** sección nueva en el perfil del entrenador, junto a `bank_alias`/`mp-connect` (mismo dominio conceptual, "cómo cobra el entrenador") — lista simple con fecha, corredor/equipo, monto bruto, comisión retenida, neto. No dentro de `team-detail-screen.jsx`, para que un entrenador con varios equipos tenga una vista consolidada sin entrar a cada uno.

## Interacción con membership de equipo ya existente

Equipos ya tiene, en producción, acciones reales de membership (`RunnerActionsMenu`: expulsar, mover de grupo, salir del equipo). Con el camino elegido:

- **Expulsión manual** (ya la ejecuta hoy el entrenador/owner) y **expulsión automática por mora** (nueva, la dispara el backend) terminan en la misma acción de dominio — el roster no necesita distinguir visualmente por qué alguien fue expulsado.
- **Corredor que se va solo** (`salir del equipo`, ya existe): **corte inmediato, sin reembolso del período ya pagado** — coincide con cómo ya funciona la acción hoy (instantánea), no se agrega ningún estado nuevo de "se va pero todavía tiene acceso".
- **Multi-equipo:** un corredor miembro de varios equipos a la vez (ya soportado por el modelo) necesita un pago/membership independiente por equipo — el cobro se identifica por `teamId` además de por usuario, no solo por rol/tier como en A.

## Testing

Mismo patrón que A: `services/payments.js` (extendido) + mocks + Jest, sin tests de render. La verificación manual de `mp-connect` necesita una cuenta de prueba con rol vendedor en el panel de Mercado Pago (ya documentado en el material backend original) — no es simulable con `EXPO_PUBLIC_USE_MOCKS` para el tramo de OAuth en sí, solo para lo que pasa después en el frontend.

## Checklist para discutir con el equipo

Recortado a lo que sigue genuinamente abierto — todo lo demás quedó resuelto en las rondas de repaso. Quedan solo dos valores, **pospuestos deliberadamente** (no son resolubles por análisis, necesitan trabajo de negocio propio — benchmarking, unit economics):

1. **Porcentaje de comisión.**
2. **Precio mínimo de mensualidad.**
