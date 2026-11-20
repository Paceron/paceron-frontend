# Home: carga inicial, entrada y refresco en segundo plano

Fecha: 2026-11-20
Rama: `fix/ux-audit-improvements`
Estado: implementado; pendiente validación en device y ajustes visuales menores.

## Objetivo

Que el Home de corredor y entrenador se sienta como una sola pantalla:

- Un único estado de carga inicial, con un spinner general centrado.
- Ninguna card desaparece mientras carga: cada bloque tiene su propio estado de carga y entra con una animación breve cuando tiene datos.
- Al volver al Home, un fade completo desde 0 reanima el contenido sin volver a mostrar el spinner ni bloquear la interacción.
- Después del login, las consultas críticas se prefetchean en segundo plano para que el Home aparezca con datos o con el spinner, nunca con una pantalla vacía intermedia.

El alcance es web y mobile, en todos los anchos. El comportamiento nativo no se puede validar desde el navegador; la implementación debe ser compartida y quedar lista para probar en device.

## Fuera de alcance

- Cambiar los endpoints o el contrato del backend.
- Reemplazar TanStack Query por otro mecanismo.
- Rehacer el diseño visual de las cards.
- Tocar las cards de deuda que el usuario está editando en paralelo.
- Cambiar la lógica de negocio de pagos, competencias o gamificación.

## Decisiones de producto

1. **Spinner general, no skeleton.** Mientras no haya datos críticos, se muestra un spinner centrado sobre fondo `paper`/`ink`, del mismo tamaño que el Home. Las cards reales siguen montadas debajo para que sus queries arranquen y para no perder el scroll ni el estado.
2. **Una card no desaparece por estar cargando.** Las cards condicionales muestran un placeholder compacto; si el estado final es “no hay nada”, recién ahí desaparecen.
3. **Fade de entrada por bloque.** Cada card, hero o sección de primer nivel entra con opacidad y un desplazamiento vertical corto.
4. **Primera carga vs. retorno.**
   - Carga inicial: `0 → 1`, `8 px → 0`, 240 ms.
   - Retorno al Home: `0 → 1`, `8 px → 0`, 240 ms. Es una entrada completa, no un fade sutil.
5. **Secciones que cargan después.** Muestran su loading compacto y, cuando aparecen, usan el mismo fade de entrada. Las grillas internas entran completas con su card; no se anima cada KPI por separado.
6. **Reduced motion.** Si `useReducedMotion()` está activo, no hay desplazamiento ni fade animado: el contenido aparece en su estado final.
7. **Estabilización inicial.** La fase inicial es siempre `hidden`; aunque las queries ya tengan caché, se espera un mínimo de 200 ms antes de revelar. Si una query crítica entra en carga dentro de esa ventana, el spinner se mantiene. Esto evita el flash “contenido → blanco → contenido”.

## Consultas y estado crítico

El spinner inicial no espera todo el Home. Espera solamente lo que define la estructura y el contenido principal:

| Bloque | Hook / query | ¿Crítico? |
|---|---|---|
| Perfil | `useUser(userId)` → `['user', userId]` | Sí |
| Siguiente entrenamiento | `useNextTrainingBanner(role, userId)` → calendario de 90 días + estados de `runner_session` | Sí |
| KPI del rol | `useRunnerKpis(...)` o `useTrainerHomeKpis(...)` | Sí |
| Permisos | `usePermissions(userId)` → `['permissions', userId]` | Prefetch, no bloquea el spinner |
| Pagos próximos | `useUpcomingPayments` | No: loading compacto |
| Rachas | `useStreaks` → `['streaks', userId]` | No: loading compacto |
| Logros | `useAchievements` → catálogo + `['achievements', userId]` | No: loading compacto |
| Competencias | `useMyCompetitions(userId)` | No: loading compacto |
| Entrenamientos recientes | `useComparisonList(...)` | No: loading compacto |

El criterio es: si falta user, siguiente entrenamiento o KPI del rol, se muestra el spinner general. Si falta gamificación, competencias, pagos o recientes, se muestra el Home con el placeholder de esa card.

### Consultas que hay que preparar para prefetch

Para que el login pueda prefetchear sin duplicar lógica, extraer opciones reutilizables:

- `userQueryOptions(userId)` y `permissionsQueryOptions(userId)` en `hooks/use-user.js`.
- `memberCalendarQueryOptions(userId, from, to)` y `administeredCalendarQueryOptions(userId, from, to)` en `hooks/use-aggregated-calendar.js`; las keys hoy son privadas.
- `runnerKpisQueryOptions({ period, referenceDate, tab })` en `hooks/use-runner-kpis.js`, con `enabled` opcional en `useRunnerKpis`.
- `trainerHomeKpisQueryOptions({ userId, period, referenceDate })` en `hooks/use-trainer-home-kpis.js`, con `enabled` opcional.

Los hooks actuales deben seguir devolviendo los mismos campos. El cambio es extraer las opciones y agregar `enabled` donde falte, no duplicar fetchers.

## Arquitectura de UI

### `HomeRevealProvider`

Vive en `authenticated-home-screen.jsx`. Provee:

- `phase`: `hidden` (spinner visible), `load` (primera entrada con datos) o `return` (retorno con caché).
- `revealKey`: contador que se incrementa cuando termina la carga inicial o cuando el Home recupera foco.

La fase se decide así:

- La fase inicial es siempre `hidden`.
- Si `criticalLoading` es `true`: `hidden`.
- Si `criticalLoading` es `false` y se mantiene así 200 ms: `load`; se incrementa `revealKey`. El retardo absorbe queries que empiezan a cargar en el primer render y evita el flash.
- Si el Home recupera foco y no hay spinner: `return`; se incrementa `revealKey`.

### `HomeReveal`

Componente compartido en `components/home/home-reveal.jsx`.

- Lee el contexto; también puede usarse sin provider con props explícitas.
- Anima opacidad y `translateY` con Reanimated (`useSharedValue` + `withTiming`).
- Desde `0` tanto en `load` como en `return`; el retorno es una entrada completa, no un fade sutil.
- `delay` opcional para escalonar bloques (30 ms entre bloques de primer nivel).
- `className` y `style` se aplican a un `View` interno, no al `Animated.View`: en este repo Reanimated no aplica clases de NativeWind de forma confiable.
- Con `useReducedMotion`, la opacidad queda en `1` y el desplazamiento en `0`.

Uso previsto:

- El saludo, el bloque de KPI y el hero de siguiente entrenamiento se envuelven desde la pantalla.
- Las cards que ya manejan su propio loading (`HomePaymentsDueCard`, racha, logro, competencias, recientes) envuelven su contenido listo, no el placeholder. Así el fade ocurre cuando el contenido real aparece.
- `NextTrainingBanner` envuelve su hero con `HomeReveal`; su card de loading queda estable.

### `HomeLoadingOverlay`

Componente nuevo en `components/home/home-loading-overlay.jsx`.

- Overlay absoluto `inset-0`, `pointerEvents="auto"`, `zIndex` alto, fondo `bg-paper dark:bg-ink`.
- Un único `ActivityIndicator` grande, centrado, con el color primario.
- `accessibilityLabel="Cargando inicio"`; el contenido de abajo queda con `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` mientras el spinner está visible.
- Se monta desde la fase inicial `hidden` y se desmonta cuando la carga inicial se asienta.

La pantalla queda con un wrapper `View className="flex-1"`:

```jsx
<View className="flex-1">
  <ScrollView ...>...</ScrollView>
  <HomeLoadingOverlay visible={loadingVisible} />
</View>
```

### Loadings compactos por card

- `HomePaymentsDueCard`: hoy devuelve `null` mientras carga. Agregar un placeholder compacto con `SkeletonBlock` cuando `loading` y no hay datos; si al terminar no hay cuotas, recién ahí devolver `null`. Esto revierte la decisión anterior de “no mostrar nada” porque ahora el Home tiene un lenguaje de carga único.
- `StreakBanner` y `AchievementHighlightCard`: conservar sus placeholders actuales de `h-24` con spinner, pero envolver el contenido real en `HomeReveal` para que entre cuando llega.
- `CompetitionsPreviewCard` y `RecentTrainingsCard`: conservar la card de loading con spinner; envolver la card real en `HomeReveal`.
- `NextTrainingBanner`: conservar la card de loading; envolver el hero real en `HomeReveal`.
- `RunnerKpisCard` y `TrainerHomeKpisCard`: conservar `DashboardLoadingOverlay`; el bloque entero se envuelve desde la pantalla porque el KPI es crítico.

## Flujo de login

Archivo nuevo: `utils/home-prefetch.js`.

```js
prefetchHomeCriticalQueries(queryClient, { userId, role })
```

Prefetchea, en paralelo y best-effort:

1. `userQueryOptions(userId)`.
2. `permissionsQueryOptions(userId)`.
3. Calendario de 90 días: `memberCalendarQueryOptions` si `role === 'runner'`, `administeredCalendarQueryOptions` si es entrenador.
4. KPI del rol con el período y la fecha de referencia por defecto del Home.

No prefetchea pagos, rachas, logros, competencias ni recientes: no son críticos y agregarían requests que pueden competir con el login.

En `login-screen.jsx` y `register-screen.jsx`, después de un login/registro exitoso:

- Leer `userId` y `activeRole` del store.
- Apagar el spinner del formulario y navegar a `/` de inmediato.
- Lanzar el prefetch en segundo plano, sin `await`; si falla, no mostrar error: el Home tiene su propio manejo de carga y error.
- Mostrar el toast de bienvenida después de navegar, para que no aparezca mientras el login sigue en loading.

El objetivo es que el Home reciba `user`, calendario y KPI desde caché lo antes posible, mientras el spinner general cubre lo que falte.

## Flujo de foco y retorno

En `authenticated-home-screen.jsx`:

- Mantener `hasFocusedOnce`.
- En el primer foco no hacer nada extra: el montaje ya resolvió el spinner o el fade.
- En focos posteriores:
  - Incrementar `revealKey` y poner `phase='return'`.
  - Mantener la invalidación actual de rachas/logros del corredor.
- La fase inicial es siempre `hidden`: aunque las queries críticas tengan caché, se muestra el spinner durante 200 ms para absorber cargas que arrancan en el primer render y evitar el flash “contenido → blanco → contenido”.
- Si no hay caché, `criticalLoading` es `true` y el spinner se mantiene hasta que termina; luego fase `load`.

## Accesibilidad

- El spinner es un overlay modal para lectores de pantalla: `accessibilityViewIsModal`, label “Cargando inicio”.
- Mientras el spinner está visible, el contenido de abajo no debe ser enfocable ni legible: `accessibilityElementsHidden` y `importantForAccessibility="no-hide-descendants"`.
- Al desmontarse, el foco vuelve al contenido normal.
- Los placeholders de cards no llevan texto si el spinner general ya explica la carga; cuando una card carga sola, su spinner conserva el label existente.
- `HomeReveal` no debe ocultar contenido a lectores de pantalla: solo opacity/transform visual.
- Con reduced motion no hay desplazamiento ni fade; el contenido aparece en su estado final.

## Performance

- Las queries no se duplican: el prefetch usa las mismas keys y opciones que los hooks; TanStack Query deduplica.
- El KPI del rol se consulta desde la pantalla para el gate y desde la card para su estado local. Son dos suscripciones a la misma key, no dos requests.
- `NextTrainingBanner` deja de llamar `useNextTrainingBanner` por su cuenta: la pantalla lo llama una vez y le pasa el estado. Esto evita duplicar el cálculo de candidatos y los `useQueries` de estados.
- El spinner general es un único `ActivityIndicator`; no hay overlays por card.
- `HomeReveal` usa una shared value por bloque; no hay animaciones por KPI individual.
- No se agrega `refetchInterval` ni se cambia `ForegroundRefetch`.
- El prefetch de login tiene timeout y no bloquea la navegación más de 1.2 s.

## Archivos previstos

Nuevos:

- `components/home/home-reveal.jsx`
- `components/home/home-loading-overlay.jsx`
- `utils/home-prefetch.js`
- `__tests__/home-prefetch.test.js`

Modificados:

- `components/home/authenticated-home-screen.jsx`
- `components/home/next-training-banner.jsx`
- `components/home/home-payments-due-card.jsx`
- `components/home/streak-banner.jsx`
- `components/home/achievement-highlight-card.jsx`
- `components/home/competitions-preview-card.jsx`
- `components/home/recent-trainings-card.jsx`
- `components/auth/login-screen.jsx`
- `components/auth/register-screen.jsx`
- `hooks/use-user.js`
- `hooks/use-aggregated-calendar.js`
- `hooks/use-runner-kpis.js`
- `hooks/use-trainer-home-kpis.js`
- Tests existentes de Home, login y carrusel que mockeen los hooks modificados.

## Pruebas

- `home-prefetch`: con un queryClient falso, verifica que se encolen user, permissions, calendario del rol y KPI del rol; que un fallo no propague; que el timeout resuelva sin cancelar el prefetch.
- `authenticated-home-screen`: actualizar mocks de `useNextTrainingBanner`, `useRunnerKpis`/`useTrainerHomeKpis`, `HomeLoadingOverlay` y `HomeReveal`; verificar que el spinner aparece desde el primer render, se oculta a los 200 ms y que el contenido sigue montado.
- `next-training-banner-carousel`: actualizar el render para pasar el estado del banner en vez de mockear el hook interno, si se concreta el cambio de firma.
- `HomeReveal`: testear `resolveRevealStart(phase)` con `load → 0`, `return → 0` y reduced motion → 1.
- `npm test -- --runInBand`, `npm run lint`, `git diff --check`.

## Riesgos y mitigaciones

- **Spinner demasiado largo por el estado de `runner_session`:** el calendario se prefetchea; los estados por sesión son la parte más lenta. Si en la práctica tarda, se puede sacar `statusLoading` del gate crítico y dejar que el banner muestre su propio loading. Medir antes de optimizar.
- **Prefetch que compite con el login:** timeout de 1.2 s y best-effort; se lanza después de navegar y no se espera.
- **Doble suscripción al KPI:** no genera requests extra; si se quiere evitar también el doble render, se puede pasar el estado del KPI a la card en una segunda iteración.
- **Remount del Home en mobile:** la fase inicial es `hidden` y se asienta a los 200 ms; un remount con datos muestra un spinner breve en vez de un flash de contenido.
- **Contenido oculto por accesibilidad:** el wrapper del contenido debe desactivar accesibilidad mientras el spinner está visible y reactivarla al desmontarlo.

## Criterios de aceptación

- Al entrar al Home, aparece un único spinner general desde el primer render, incluso si hay datos en caché.
- Si no hay caché, el spinner se mantiene hasta que terminan user, siguiente entrenamiento y KPI del rol; después las cards entran con fade.
- Al entrar con caché, el spinner se muestra 200 ms y luego el contenido entra completo, sin flash intermedio.
- Ninguna card de racha, logro, competencias, recientes o pagos desaparece mientras carga; muestra su placeholder y luego su contenido.
- Al volver al Home desde otra pantalla, no se muestra spinner y el contenido hace una entrada completa desde 0.
- En web ancha, web angosta y mobile, el orden y los anchos no cambian.
- Con reduced motion no hay animación; el contenido aparece en su estado final.
- Los tests y el lint quedan verdes.
