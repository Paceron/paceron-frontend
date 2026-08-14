# Split marketplace corredor-entrenador (Sub-proyecto B) — Decisiones y lineamientos

> A diferencia del spec de [Sub-proyecto A](./2026-08-12-subscription-tier-checkout-design.md), este documento sigue sin ser un spec paso a paso — pero, tras confirmar reglas de negocio concretas con el usuario, la arquitectura central ya no es un fork abierto: quedó resuelta. Lo que sigue abierto son valores numéricos (comisión, precio mínimo, duración del plazo de gracia) y algunas decisiones de UX, no de arquitectura.

## Contexto y alcance

Cubre el Caso 2 del [análisis de viabilidad](./2026-08-11-payments-integration-feasibility-analysis.md): el corredor paga al entrenador por pertenecer a su equipo/recibir entrenamiento, con Paceron reteniendo una comisión (`marketplace_fee`). A diferencia de Sub-proyecto A (pago único, un solo vendedor), acá aparecen tres elementos que A no tiene: **un tercero cobrando** (el entrenador, no Paceron), **una relación de negocio recurrente** (membership de equipo, con vencimiento mensual real), y **estados de mora** (`SUBSCRIPTION_STATUSES` ya existe en `store/team-store.js`, hoy cosmético).

## Mecánica de cobro confirmada (regla de negocio, no técnica)

Confirmado por el usuario, no es una suposición del análisis:

- El corredor paga **manualmente** para pertenecer a un equipo — **no hay débito automático**, ni ahora ni como objetivo del producto.
- Ese pago es **válido por un mes**.
- Al vencer, hay un **plazo de gracia** para renovar (duración exacta sin definir todavía — mismo tipo de valor que la comisión y el precio mínimo, ver abajo).
- Si no se renueva dentro del plazo de gracia, el corredor es **expulsado automáticamente** del equipo.

Esto resuelve directamente el fork arquitectónico que este documento tenía abierto — ver siguiente sección.

## Fork arquitectónico — resuelto

Se había identificado (verificado contra documentación oficial de Mercado Pago, no una suposición) que el split (`marketplace_fee`) y el cobro recurrente automático (`/preapproval`, "Suscripciones") son productos distintos de MP que no se combinan en un solo mecanismo — lo que obligaba a elegir entre dos arquitecturas de fondo. Con la mecánica de cobro confirmada arriba, la elección queda resuelta:

### Camino elegido — Recurrencia gestionada por Paceron, split real de MP en cada cobro

Cada mes, se genera un pago puntual normal — el mismo mecanismo ya diseñado para Sub-proyecto A, con `marketplace_fee` en la preferencia. MP nunca sabe que es una relación recurrente; la recurrencia (qué corresponde cobrar, cuándo, plazo de gracia, expulsión) vive enteramente en el backend de Paceron. Esto encaja exactamente con "no hay débito automático" — de hecho, la ausencia de auto-debit es **la razón de negocio** que hace que este camino sea el correcto, no solo el más simple técnicamente.

Reutiliza 100% el mecanismo ya diseñado y documentado para A (`checkout-brick.jsx`, `WebView`+`postMessage`, `services/payments.js`) y requiere `mp-connect` (OAuth del entrenador), tal como estaba previsto desde el documento de propuesta backend original.

### Camino descartado — Suscripción real de MP a nombre de Paceron, payout aparte

Se documenta igual, para que quede registrado por qué no se eligió (y para no volver a evaluarlo sin una razón nueva): usar `/preapproval` de MP daría cobro automático real, pero el dinero entraría a la cuenta de Paceron (no hay forma de dirigir un `/preapproval` a una cuenta de tercero vía OAuth), obligando a un proceso de liquidación propio + probable revisión legal/regulatoria por retener y redistribuir dinero de terceros. Como el producto **no quiere débito automático**, esta ventaja (la única razón real para considerar este camino) no aplica — queda descartado, no por complejidad, sino porque resuelve un problema que el producto no tiene.

## Qué es compartido con Sub-proyecto A

Ya no es condicional — se reutiliza directamente:

- `checkout-brick.jsx`, la ruta `/checkout`, el mecanismo `WebView`+`postMessage`+inyección de sesión: tal cual, solo cambia el `access_token` server-side que usa el backend al crear la preferencia (el del entrenador conectado vía `mp-connect`, no el de Paceron) y que la preferencia lleve `marketplace_fee`.
- `services/payments.js` se extiende (no se duplica): `createPreference` necesita aceptar a qué entrenador/equipo corresponde el pago, además de (o en vez de) `tierId`.

## `mp-connect` — vinculación OAuth del entrenador

Mismo patrón de redirección que MP documenta oficialmente para Expo (`WebBrowser.openAuthSessionAsync` + deep link) — el mismo mecanismo que se descartó para el checkout de A por no ser "de marca Paceron" **sí aplica bien acá**, porque el propósito de esta pantalla es explícitamente autorizar una cuenta externa, no simular ser parte del checkout de Paceron (conceptualmente igual a "Conectar con Google").

**Ubicación sugerida:** junto a `bank_alias`, en el flujo del entrenador (`activate-trainer-screen.jsx` o una sección nueva dentro de `edit-profile-screen.jsx`) — mismo dominio conceptual ("cómo cobra el entrenador"). Sigue **abierto** si `mp-connect` reemplaza a `bank_alias` o conviven (ver checklist).

## Renovación — mismo mecanismo que el pago inicial

Renovar es literalmente pagar de nuevo — mismo `checkout-brick.jsx`/`WebView` que el pago inicial de membership, sin pantalla ni componente nuevo. Dos formas de llegar ahí:

- **Proactiva:** el corredor renueva antes de vencer, desde algún punto de la UI de su equipo (a definir dónde exactamente — candidato natural: `team-detail-screen.jsx` o una vista de "mi membership").
- **Reactiva:** ya venció y está en plazo de gracia — mismo botón, pero probablemente con urgencia visual distinta (ver estados de mora abajo).

**Necesita del backend:** una fecha de vencimiento/próximo cobro por membership, expuesta en el roster o en una consulta dedicada — hoy no existe ningún campo así. Sin esto, el frontend no puede mostrar "vence en 3 días" ni decidir cuándo mostrar la urgencia de renovación.

## Control de pagos — pendiente / realizado / morosidad

El frontend ya tiene el modelo de estados (`SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba']`, `store/team-store.js:31`), hoy cosmético — `subscriptionStatus` siempre llega `null` de la API real. Con la mecánica confirmada, esto se puede precisar más:

- **Los estados los define el backend, no el frontend** — el frontend nunca infiere `vencido`/`activo` comparando fechas localmente; sería divergir de la fuente de verdad si el backend ajusta la duración del plazo de gracia.
- **La expulsión automática por mora reutiliza la misma acción que la expulsión manual ya existente** (`RunnerActionsMenu`, ya en producción) — es el backend quien la dispara (job programado), no una acción nueva de frontend. El roster debería reflejar el resultado igual que cuando el entrenador expulsa manualmente hoy.
- **Dónde se muestra el estado:** `team-detail-screen.jsx` ya tiene el hook de roster (`hooks/use-team-roster.js`) y los tags `SUBSCRIPTION_META` montados — lugar natural, sin pantalla nueva.
- **Sigue abierto:** qué ve el corredor durante el plazo de gracia (sin restricción, aviso, o bloqueo de funcionalidades del equipo) — cuanto más severa la consecuencia, más importa que el estado sea confiable antes de exponerlo. Ver checklist.
- **`en_prueba`** sigue sin confirmar si existe (período de prueba antes del primer cobro al unirse a un equipo) — no mencionado en la mecánica de cobro confirmada, sigue como pregunta abierta.

## Precio — quién lo fija

**Resuelto en parte:** lo fija el entrenador (no un valor único de plataforma), pero con un **precio mínimo de mensualidad impuesto por Paceron** (valor exacto sin definir todavía) — confirmado explícitamente por el usuario, con el motivo de negocio explícito: evitar que un entrenador use todas las funciones de la plataforma y después arregle el cobro real en efectivo por fuera, dejando a Paceron sin comisión. Esto significa:

- Hace falta una pantalla/campo de configuración de precio en el flujo del entrenador — no mencionada hasta ahora en ningún doc, nueva superficie de UI.
- El frontend necesita validar contra el mínimo (mensaje de error si el entrenador intenta poner un precio menor) — el mínimo en sí lo define y mantiene el backend/backoffice, el frontend solo lo consulta y valida contra él, mismo criterio que `marketplace_fee`/`platform_settings`.

## Comisión — confirmado que es porcentual

Confirmado con ejemplo concreto por el usuario: mensualidad de $100.000 con comisión del 5% → $5.000 le corresponden a Paceron. Coincide exactamente con la fórmula que ya describe el documento de propuesta backend original (`marketplace_fee = round(amount × percentage / 100)`) — no es información nueva sobre el mecanismo, es la confirmación de que el mecanismo ya documentado es el que se va a usar tal cual. El valor exacto del porcentaje sigue sin definir (configurable por owner vía backoffice, `platform_settings`, según el documento original).

**Transparencia para el corredor:** con split real de MP en cada cobro, el desglose (cuánto va al entrenador, cuánto a Paceron) es un dato real disponible antes de pagar — sigue como decisión de producto si se muestra o no (ver checklist), pero ahora es puramente una decisión de UX, no una limitación técnica (a diferencia de lo que hubiera sido en el camino descartado).

## Interacción con membership de equipo ya existente

Equipos ya tiene, en producción, acciones reales de membership (`RunnerActionsMenu`: expulsar, mover de grupo, salir del equipo). Con el Camino elegido, esto se resuelve así:

- **Expulsión manual** (ya la ejecuta hoy el entrenador/owner) y **expulsión automática por mora** (nueva, la dispara el backend) terminan en la misma acción de dominio — el roster no necesita distinguir visualmente por qué alguien fue expulsado, salvo que se decida lo contrario.
- **Corredor que se va solo** (`salir del equipo`, ya existe): sigue abierto si corta cualquier cobro pendiente en el momento o si simplemente no se renueva al vencer el período ya pagado (ver checklist).
- **Multi-equipo:** un corredor miembro de varios equipos a la vez (ya soportado por el modelo) necesita un pago/membership independiente por equipo — el cobro se identifica por `teamId` además de por usuario, no solo por rol/tier como en A.

## Testing

Mismo patrón que A: `services/payments.js` (extendido) + mocks + Jest, sin tests de render. La verificación manual de `mp-connect` necesita una cuenta de prueba con rol vendedor en el panel de Mercado Pago (ya documentado en el material backend original) — no es simulable con `EXPO_PUBLIC_USE_MOCKS` para el tramo de OAuth en sí, solo para lo que pasa después en el frontend.

## Checklist para discutir con el equipo

Recortado respecto a la versión anterior — varios puntos ya se resolvieron con la mecánica de cobro confirmada (fork de arquitectura, si el re-cobro es manual, quién fija el precio, si la comisión es porcentual). Queda:

1. **Valores numéricos sin definir** (existen, no están decididos): porcentaje de comisión, precio mínimo de mensualidad, duración del plazo de gracia antes de la expulsión automática.
2. `mp-connect` y `bank_alias`: ¿conviven, o el segundo queda obsoleto una vez integrado el primero?
3. ¿Existe período de prueba (`en_prueba`) antes del primer cobro al unirse a un equipo?
4. Qué ve el corredor durante el plazo de gracia — sin restricción, aviso, o bloqueo de funcionalidades del equipo.
5. ¿Se muestra el desglose de comisión al corredor antes de pagar, o queda opaco?
6. ¿"Salir del equipo" corta el cobro pendiente en el momento, o deja correr hasta el cierre del período ya pagado?
7. Dónde vive la pantalla de configuración de precio del entrenador (nueva superficie de UI, sin definir ubicación todavía).
