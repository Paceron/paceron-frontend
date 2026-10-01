# Ajustes de la revisión del dashboard de pagos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aplicar los 4 cambios de la revisión con el equipo: "Pagos" en el navbar, pista en los tiles clickeables, ventana del gráfico corrible y switch bruto/neto.

**Architecture:** el backend suma `until` y `earliest_month` a `GET /payments/received/summary` (D14 del change de OpenSpec). El frontend hace dos consultas del resumen: una fija (tiles y tarjeta del perfil) y otra con `until` (gráfico y cobros por equipo). La elección bruto/neto y la geometría quedan en funciones puras testeadas.

**Tech Stack:** Go/Gin/GORM + testify (backend); Expo/React Native Web, TanStack Query, Jest (frontend).

## Global Constraints

- Specs: `docs/superpowers/specs/2026-09-26-trainer-payments-dashboard-design.md` (sección "Ajustes de la revisión con el equipo") y `openspec/changes/historial-pagos-cobros-entrenador/` (D14) del backend.
- Nunca estimar el neto: solo se muestra el `net_amount` que informó Mercado Pago.
- `until`: formato `YYYY-MM`, no posterior al mes actual en hora argentina (`FixedZone -3h`); inválido → `400 INVALID_QUERY`.
- Backend: coverage total ≥ 85% (`go-test-coverage` con `.testcoverage.yml`).
- Frontend: `nativeID` + `testID` en todo componente visual; `npm test` y `npm run lint` (0 errores) en verde.
- Commits: backend en español, frontend con subject en inglés; sin línea de coautoría.
- Versión del frontend: 0.27.0.

---

## Backend (`paceron-backend`, rama `feature/historial-pagos-cobros-entrenador`)

### Task 1: DAO — rango y primer cobro

**Files:**
- Modify: `cmd/api/daos/payment_history_dao.go`
- Test: `cmd/api/daos/payment_history_dao_test.go`

**Interfaces:**
- Produces: `ListReceivedBetween(ctx *gin.Context, sellerID int64, from, to time.Time) ([]ReceivedPaymentRow, error)` (rango `[from, to)`) y `EarliestReceivedAt(ctx *gin.Context, sellerID int64) (*time.Time, error)` (nil si no hay cobros). Se elimina `ListReceivedSince`.

- [ ] Reemplazar el test `TestPaymentHistoryDao_ListReceivedSince` por `..._ListReceivedBetween`: filas antes de `from`, en `from`, dentro, en `to` (excluida). Esperado: solo `from` y la de adentro, en orden DESC.
- [ ] Test `..._EarliestReceivedAt`: sin cobros → nil; con cobros (incluida una fila fantasma más vieja, `payment_id=''`, y un pago de otro vendedor más viejo) → el `created_at` del cobro real más viejo.
- [ ] En `TestPaymentHistoryDao_DBFail`, cambiar la rama de `ListReceivedSince` por las dos nuevas (mensajes `error listing received payments between dates` y `error getting earliest received payment`).
- [ ] Implementar: `ListReceivedBetween` = `receivedBaseQuery(sellerID).Where("p.created_at >= ? AND p.created_at < ?", from, to)`; `EarliestReceivedAt` = `SELECT MIN(p.created_at)` sobre `receivedBaseQuery` (reusando joins y filtros), scan a `sql.NullTime`.
- [ ] Correr `go test ./cmd/api/daos/ -run PaymentHistory` con `TEST_DB_HOST` apuntando al container `paceron-test-db` (5433). Esperado: PASS.
- [ ] Commit: `feat(payments): consultar cobros por rango y primer cobro del vendedor`.

### Task 2: Service — `until` y `earliest_month`

**Files:**
- Modify: `cmd/api/services/payment_history_service.go`, `cmd/api/domains/payment/payment_history.go`
- Test: `cmd/api/services/payment_history_service_test.go`

**Interfaces:**
- Consumes: Task 1.
- Produces: `GetReceivedSummary(ctx *gin.Context, sellerID int64, months int, until string) (*payment.ReceivedSummaryResponse, error)`; `ReceivedSummaryResponse.EarliestMonth *string \`json:"earliest_month"\`` (formato `YYYY-MM` en hora argentina).

- [ ] Actualizar el mock del DAO (`listReceivedBetweenFn`, `earliestReceivedAtFn`) y las llamadas existentes a `GetReceivedSummary(nil, 7, n, "")`.
- [ ] Tests nuevos: `until=2026-05` con 6 meses → `from = 2025-12-01 ART`, `to = 2026-06-01 ART`, `monthly` de `2025-12` a `2026-05`; `until` inválido (`mayo`, `2026-13`, `2099-01`, `2026-10` con now en septiembre) → `ErrInvalidPaymentHistoryQuery`; `until` igual al mes actual → válido; `earliest_month` nil sin cobros y `"2026-02"` con un `created_at` de `2026-02-01T01:00Z` → `"2026-01"` (borde de huso); error de `EarliestReceivedAt` → error no-400.
- [ ] Implementar: parsear `until` con `time.ParseInLocation("2006-01", until, argentinaTZ)`; fin de ventana = mes actual si `until == ""`; rechazar si es posterior al mes actual; `start = end.AddDate(0, -(months-1), 0)`, `to = end.AddDate(0, 1, 0)`.
- [ ] Correr `go test ./cmd/api/services/ -run PaymentHistory`. Esperado: PASS.
- [ ] Commit: `feat(payments): correr la ventana del resumen de cobros con until`.

### Task 3: Controller, swagger y coverage

**Files:**
- Modify: `cmd/api/controllers/payment_history_controller.go`, `cmd/api/docs/*` (generado)
- Test: `cmd/api/controllers/payment_history_controller_test.go`

- [ ] Actualizar mock y tests: `?until=2026-05` llega tal cual al service; sin `until` llega `""`.
- [ ] Pasar `c.Query("until")` al service y sumar `@Param until query string false "Último mes de la ventana (YYYY-MM), por defecto el actual"`.
- [ ] `swag init --parseDependency -g cmd/api/docs.go --output cmd/api/docs`.
- [ ] `go vet ./...`, `go test ./...` (con DB) y el coverage con `go-test-coverage`: total ≥ 85%.
- [ ] Marcar 11.1–11.4 en `tasks.md`. Commits: `feat(payments): aceptar until en el resumen de cobros` y `chore(swagger): documentar until y earliest_month`.

## Frontend (`paceron-frontend`, rama `feature/trainer-payments-dashboard`)

### Task 4: Datos — `until`, `earliestMonth` y mock

**Files:**
- Modify: `services/payment-history.js`, `services/normalizers.js`, `services/__mocks__/payment-history-mock.js`, `hooks/use-payment-history.js`
- Test: `__tests__/payment-history-mock.test.js`

**Interfaces:**
- Produces: `getReceivedPaymentsSummary({ months, until })`; `useReceivedPaymentsSummary({ enabled, months, until })` con `until` en la query key; modelo `summary.earliestMonth` (`'YYYY-MM'` o `null`).

- [ ] Tests del mock: con `until` dos meses atrás, `monthly` termina en ese mes y no suma cobros posteriores; `earliest_month` es el mes del cobro más viejo del listado; el normalizer mapea `earliest_month`.
- [ ] Implementar service, normalizer, mock y hook.
- [ ] `npm test`. Commit: `feat(payments): request summary for a given window end`.

### Task 5: Lógica pura — ventana y bruto/neto

**Files:**
- Modify: `utils/payments-summary.js`, `utils/payments-chart.js`
- Test: `__tests__/payments-summary.test.js`, `__tests__/payments-chart.test.js`

**Interfaces:**
- Produces:
  - `shiftMonth(key, delta) → 'YYYY-MM'`
  - `windowRange(monthly) → 'abr – sep 2026'` (con año de cada extremo si difieren: `'dic 2025 – may 2026'`)
  - `canGoBack(monthly, earliestMonth) → boolean` (false si `earliestMonth` es null o si el primer mes de la ventana es ≤ `earliestMonth`)
  - `amountFor(entry, mode) → { value: number|null, partial: boolean }` (`mode` = `'gross'|'net'`; en neto: `null` si no hay neto, `partial` si `netKnownCount < approvedCount`)
  - `computeMonthOverMonth(current, previous, mode = 'gross')` (en neto usa `amountFor`; si falta alguno → `direction: 'none'`)
  - `buildMonthlyBars(points, opts)` con `points = [{ month, value, partial, missing }]`; cada barra devuelve además `partial` y `missing`.

- [ ] Tests primero de cada función (casos de arriba, cambio de año, neto parcial y faltante, variación en neto con faltante).
- [ ] Implementar. `npm test`. Commit: `feat(payments): add window and gross/net helpers for the dashboard`.

### Task 6: UI — navbar, tiles, ventana y switch

**Files:**
- Modify: `routes/catalog.js`, `components/shared/stat-tile.jsx`, `components/profile/payments-dashboard.jsx`, `components/profile/payments-monthly-chart.jsx`, `components/profile/payments-screen.jsx`
- Create: `components/profile/payments-amount-mode.jsx`

- [ ] `paymentsRoute` al final de `navigationRoutes`, sin `role`.
- [ ] `StatTile` con `actionHint` (chevron + línea en color primario). Los tiles de cuotas pasan `actionHint={active ? 'Filtrando · tocá para quitar' : 'Tocá para filtrar'}`.
- [ ] `PaymentsAmountMode` (segmentado Bruto/Neto, ids `payments-amount-mode-*`).
- [ ] `PaymentsScreen`: estados `amountMode` y `windowOffset`; segunda consulta `useReceivedPaymentsSummary({ enabled: isTrainer, until })` con `until = windowOffset === 0 ? undefined : shiftMonth(currentMonth, -windowOffset * 6)`; la pasa al dashboard como `windowSummary`.
- [ ] `PaymentsDashboard`: tiles con `summary` y `amountMode`; gráfico y equipos con `windowSummary`; encabezado del gráfico con ‹ `windowRange` › (ids `payments-dashboard-window-prev/next/label`); nota de neto parcial/sin dato en modo neto.
- [ ] `PaymentsMonthlyChart` recibe `points`; barra `missing` sin relleno con "s/d", `partial` con "*" en la etiqueta.
- [ ] `npm test` + `npm run lint`. Verificar en preview con los datos sembrados (ítem del navbar, pista, ‹ › y su límite, bruto/neto en los 4 lugares, mobile sin scroll horizontal).
- [ ] Commit: `feat(payments): add navbar entry, tile hints, movable chart window and gross/net switch`.

### Task 7: Docs, versión y push

- [ ] `CLAUDE.md` (sección "Historial de pagos y cobros"): dos consultas del resumen (fija y con `until`), y que el switch nunca estima el neto.
- [ ] Bump a 0.27.0 (`package.json` + `package-lock.json`). Commit `chore(release): bump version to 0.27.0`.
- [ ] Push de las dos ramas y chequear CI.
