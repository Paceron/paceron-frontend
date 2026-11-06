## 1. Home del entrenador

- [x] 1.1 Agregar servicio, mock, hook y normalización del contrato de trainer-home-kpis.
- [x] 1.2 Crear utilidades puras de período, valores dobles, moneda y labels/tooltips.
- [x] 1.3 Crear `TrainerHomeKpisCard` con período, cuatro métricas temporales y estructura actual.
- [x] 1.4 Montar la tarjeta solo para trainer y sumar su query al pull-to-refresh.
- [x] 1.5 Reutilizar el GIF con label contextual y estados de primera carga/actualización.

## 2. Rendimiento

- [x] 2.1 Hacer configurable el label/ID de `DashboardLoadingOverlay`, manteniendo defaults.
- [x] 2.2 Reemplazar el skeleton inicial de métricas por el overlay del dashboard.
- [x] 2.3 Agregar overlay a primera carga de ranking.
- [x] 2.4 Agregar overlay a cargas de Comparación (filtros, roster, sesiones A/B y resultado).
- [x] 2.5 Agregar overlay a la comparación por períodos y evitar overlay durante refetch de fondo.

## 3. Verificación

- [x] 3.1 Tests de servicio, normalizer, formato, keys y pull-to-refresh.
- [x] 3.2 Correr `npm test` y `npx expo lint`.
- [x] 3.3 Verificar visualmente Home en desktop/mobile y cargas de Métricas, Ranking, Comparación y Períodos en navegador.
