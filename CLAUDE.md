# Paceron Frontend — Guía de trabajo

Convenciones de workflow, diseño y decisiones para trabajar en este repo — humanos y agentes de IA por igual. **Si tomás una decisión relevante para el equipo (workflow, estilo, arquitectura), reflejala acá** para que aplique a todos, no solo a la sesión donde se decidió.

Esto incluye, sin limitarse a: incorporar una tecnología/librería nueva de peso (ej. adoptar TanStack Query para data-fetching), cambios de contexto relevantes en frontend o backend (ej. el backend suma el modelo de roles que hoy es local-only), o configuración a nivel proyecto que afecte a todo el equipo (ej. setup de emulador Android). Si en el momento no amerita su propia sección, al menos dejar una línea en "Quirks conocidos" o donde corresponda — mejor una nota corta que nada.

## Stack

Expo (React Native + React Native Web), NativeWind (Tailwind para RN), Zustand (store), react-native-reanimated, Expo Router (file-based). Backend separado (Go/Gin, otro repo), ver sección Backend.

**Estado de aplicación vs. estado de servidor:** `@tanstack/react-query` está instalado y el `QueryClientProvider` ya está armado (`providers/app-providers.jsx`). **Convención:** Zustand para estado de aplicación (sesión, UI, preferencias locales), TanStack Query para estado de servidor (cualquier dato que se pide/muta contra el backend). Equipos/grupos/invitaciones (CRUD real contra la API, reemplazando el mock original `MOCK_TEAMS`) siguen siendo Zustand (`store/team-store.js`) — decisión tomada antes de que hubiera un caso concreto que justificara el cambio, no se retrofiteó después. El primer uso real de TanStack Query es `hooks/use-team-roster.js` (2026-08-02, rama `feature/team-roster-membership-actions`): roster de un equipo, donde `GET /teams/{id}/users`/`GET /groups/{id}/users` no traen nombre/email y hace falta un fan-out N+1 contra `GET /auth/user?id=` — el cache por `queryKey` es lo que dedupea ese N+1 entre pantallas/equipos sin armarlo a mano. Nuevo trabajo sobre datos de servidor en equipos/grupos/invitaciones puede seguir este patrón (Query, no Zustand); no hay plan de migrar el CRUD ya existente sin una razón concreta.

## Workflow de branches y PRs

- **Rama base:** `develop`. Producción es `master`, se llega ahí vía `release/<versión>` (ver `docs/BRANCH_POLICIES.md` para el modelo completo — en la práctica todavía no se usó `hotfix/`/`backport/`, pero `release/` sí, vía el workflow descripto abajo).
- **Versionado (`package.json`):** el bump se hace de forma **incremental**, dentro de la misma PR de la feature/fix/chore que lo amerita — no existe una branch dedicada solo a bumpear versión (excepto el bootstrap inicial, ya resuelto). Así, al momento de cortar un release, `develop` ya tiene la versión correcta y `release/` no necesita ningún commit propio. Semver pre-1.0 (`0.x.y`) hasta que el equipo decida explícitamente que el producto llegó a un hito `1.0.0`.
- **Release a producción (1-2 veces por sprint):** `gh workflow run prepare-release.yml` lee la versión actual de `package.json` en `develop`, corta `release/<versión>` **sin commits propios** (pasamanos puro) y abre el PR a `master` — disparo manual siempre (nunca por push ni por schedule, un release a producción es una decisión humana). Revisión y merge siguen siendo manuales. Detalle completo en `docs/WORKFLOW.md` ("Ciclo de release").
- **Nomenclatura de rama:** `feature/<kebab-case>`, ej. `feature/light-theme-contrast`, `feature/mobile-date-picker`. Siempre creada desde `develop` actualizado.
- **Quién corre los comandos git:** a elección de cada dev. El agente de IA puede ejecutarlos directamente, o armar el bloque de comandos para que el desarrollador lo corra él mismo (útil para aprender el flujo o mantener control manual). Ninguna de las dos es "la forma correcta" — se acuerda con quien esté trabajando.
- **Ciclo de PR:** al hacer push de una rama `feature/*`, un CI/CD crea automáticamente una PR en draft hacia `develop` con título/descripción placeholder. Se actualiza título y descripción (ver formato abajo), se marca como lista (`gh pr ready`), se espera CI verde, y se mergea. Después: `git checkout develop && git pull && git branch -d feature/<nombre> && git remote prune origin`.

### Mensajes de commit

Formato [Conventional Commits](https://www.conventionalcommits.org/): `tipo(alcance): resumen corto en imperativo`. Tipos usados: `feat`, `fix`, `docs`, `refactor`, `chore`.

**Idioma:** subject del commit, título de PR y nombre de rama van en **inglés** (convención ya establecida en la práctica). El cuerpo del commit (cuando lo amerita) y la descripción de la PR van en **español**.

Preferir simple: **el subject alcanza en la mayoría de los casos.** Agregar cuerpo (1-2 oraciones) solo cuando el "por qué" no sea obvio desde el diff — no narrar el "qué" (el diff ya lo muestra).

```
# Bien — subject solo, cambio mecánico y autoexplicativo
feat(theme): apply paper background and opaque tints to profile screens

# Bien — cuerpo corto, explica un "por qué" no obvio
fix(roles): decide role-switch redirect by current route, not caller

El caller no sabe en qué pantalla está el usuario — la ruta actual sí.

# Evitar — cuerpo largo narrando el "qué", eso ya está en el diff
feat(roles): dedicated activation screen with validated payment alias

Replaces ActivateTrainerModal with a full screen at
/profile/activate-trainer (same pattern as edit-profile...)
[3 párrafos más]
```

### Formato de PR

**Título:** mismo estilo que el commit principal — `tipo(alcance): resumen corto`.

**Descripción — corta y concreta, no una repetición de la spec:**

```markdown
## Qué cambió
- Bullet corto por cambio, no párrafos.
- Otro bullet.

Spec: `docs/superpowers/specs/<archivo>.md`   ← SOLO si esta rama usó una spec

## Cómo probarlo
Pasos mínimos para confirmar que funciona (no el checklist completo de la spec).

`npm test` → N/N.
```

Ejemplo real corto: ver PR de `feature/light-theme-contrast`. Ejemplo de qué evitar: PRs anteriores con secciones "Descripción" de varios párrafos calcados de la spec — funcionan, pero son más caras de leer y de escribir sin aportar más información.

## Cuándo usar spec y/o plan (skill `brainstorming` → `writing-plans`)

No todo cambio necesita el ciclo completo spec → plan → implementación. Regla práctica:

| Tamaño del cambio | Spec | Plan |
|---|---|---|
| Retoque/corrección chica (1 prop, 1-3 archivos, sin decisión de diseño real) | No — charlarlo y aprobar en el chat alcanza | No |
| Feature con flujo real, componente nuevo compartido, o que toca ~5+ archivos | Sí | Opcional — preguntar; sí si hay muchos archivos o pasos frágiles, no si el diseño ya quedó concreto y es mecánico |
| Cambio grande, nueva arquitectura, o afecta varias pantallas con decisiones no triviales | Sí | Sí |

Sea cual sea el tamaño: **siempre crear la rama `feature/*` antes de tocar código**, incluso si se saltea spec/plan — no quedan commits sueltos en `develop`.

Specs viven en `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`, planes en `docs/superpowers/plans/YYYY-MM-DD-<tema>.md`.

## Testing

`npm test` corre Jest sobre `__tests__/` — cubre store, servicios, validadores y normalizers (lógica pura). **No hay tests de render de componentes** — es convención del proyecto, no un hueco a llenar por default: los componentes visuales/presentacionales se verifican manualmente (preview web + en device). Antes de mergear, la suite completa debe estar en verde.

`npm run lint` (ESLint, ver `eslint.config.js`) también debe estar en verde antes de mergear — incluye la regla custom `local/require-native-id` (ver sección "Identificadores de componentes"). Se corre en CI (`.github/workflows/ci.yml`) junto a `npm test`, en el mismo job — el pipeline falla si hay **errores** de lint (warnings preexistentes como `react-hooks/exhaustive-deps` no bloquean todavía, es una decisión deliberada; encararlas es un posible próximo paso, no urgente).

## Verificación visual

- Cambios chicos de un solo valor visual (tamaño, color puntual) → el desarrollador los confirma él mismo en el preview, no hace falta que el agente levante el server para eso.
- Flujos multi-paso (varios clicks, transiciones de estado, confirmar que algo NO pasa como un redirect) → vale la pena que el agente los verifique directo con las herramientas de preview.
- **Mobile real (Expo Go) tiene una limitación de red:** el dispositivo y la máquina donde corre el dev server deben estar en la **misma red WiFi**. En redes restrictivas (corporativas, de invitado, algunos routers) el QR de Expo Go puede fallar directamente ("something went wrong") aunque estén en la misma red. Cuando eso pasa, no hay más diagnóstico que probar en otra red — no es siempre reproducible. Alternativa si esto bloquea seguido: correr un **emulador Android/iOS en el mismo host** donde corre el dev server (evita la dependencia de red local, pero requiere el SDK/Android Studio o Xcode instalado — no configurado todavía en este entorno).
- El preview web (`react-native-web`) permite verificar layout/lógica de casi todo, **excepto** comportamiento específico de plataforma nativa (ej. el date picker nativo, el gesto de back de Android, el `AppMobileShell` que solo renderiza cuando `Platform.OS !== 'web'`) — eso se prueba solo en device real. Mismo problema, otro mecanismo: rutas con override `.web.jsx` (ej. `app/(tabs)/index.jsx` vs `index.web.jsx`) — el bundle web siempre usa la variante `.web.jsx`, nunca la nativa, sin importar el tamaño de viewport que se pruebe en preview.

## Theming (claro/oscuro)

Los estilos de tema se definen **inline por componente**, vía clases NativeWind con el modificador `dark:` (ej. `bg-white dark:bg-surface`) — es el patrón estándar/recomendado para NativeWind + React Native (no hay un sistema de custom properties CSS real cross-platform, RN no lo soporta nativamente). No se planea migrar a un sistema de tokens centralizado — no encaja con el modelo nativo y sería mucho esfuerzo por poco beneficio real.

Lo que sí conviene mantener: cuando un par claro/oscuro se repite en más de un lugar (una card, un badge, un wrapper de página), extraerlo a un componente compartido en vez de duplicar el string de clases — ver `components/forms/section-card.jsx`, `components/shell/role-badge.jsx` como ejemplos ya hechos así. Los tokens de color (paleta base) viven en `tailwind.config.js` (`theme.extend.colors`) — antes de agregar un color nuevo, revisar si ya existe algo cercano ahí.

## Responsive web

**Regla estricta y obligatoria:** toda pantalla o componente nuevo del
front se construye pensando en que la web debe funcionar en cualquier
ancho de viewport desde el día uno — no es un caso aparte a resolver
después. Mismo nivel de obligatoriedad que la regla de `nativeID`/`testID`
(ver sección "Identificadores de componentes").

La web (`isWeb`) se adapta a cualquier ancho de viewport — no hay una
versión "solo desktop". El breakpoint (`BREAKPOINTS.lg` en
`theme/tokens.js`, hoy 1024px — único lugar donde se define el valor,
`useIsNarrowWeb()` en `hooks/use-is-narrow-web.js` lo importa en vez de
hardcodearlo) decide en JS (`useWindowDimensions()`, no clases
`sm:`/`md:`/`lg:` de NativeWind — esas son CSS-only, no sirven para
decidir qué estructura montar) entre el shell/landing anchos
(`AppWebShell`, `HomeLandingScreen`) y sus variantes angostas
(`AppWebShellNarrow`, `HomeWebNarrowScreen`). Ver
`docs/superpowers/specs/2026-07-23-responsive-web-shell-design.md` para
el detalle completo de la decisión.

La app nativa compilada (`AppMobileShell`, `HomeMobileScreen`,
`Platform.OS !== 'web'`) es independiente de todo esto — el diferencial
entre nativo y web es funcional (GPS, cámara, sensores — ver
`utils/platform.js`), no de interfaz.

**Formularios — aprovechar el ancho en desktop, apilar en mobile:** todo
formulario nuevo con 2+ campos relacionados (ej. contraseña +
confirmar, nombre + apellido) se arma con `Row`/`Col` de
`components/forms/fields.jsx`, no uno debajo del otro por default. `Row`
pone los campos en fila **solo en web** (`isWeb ? 'flex-row gap-4' :
''`); en mobile cada `Col` cae a ancho completo automáticamente (sin
código adicional). Esto ya es el patrón de `register-screen.jsx` y
`reset-password-screen.jsx` — la idea es que la web desktop aproveche el
ancho disponible en vez de quedar con columnas angostas de mobile
estiradas verticalmente, mientras mobile sigue apilado y usable sin
ningún cambio de código entre plataformas.

## Identificadores de componentes (`nativeID` / `testID`)

**Regla estricta y obligatoria:** todo componente visual del front (`View`, `Text`, `Pressable`, `TextInput`, `Image`, `ScrollView`, `Touchable*`, `FlatList`, `SectionList`, `Modal`, `SafeAreaView` — incluye sus variantes `Animated.*`) debe llevar `nativeID` y `testID` con un valor identificable y único en su contexto. Ya no es "a partir de ahora" — el backfill retroactivo sobre todo el código existente se hizo (branch `chore/eslint-native-id-rule` + las que le siguieron), así que hoy la regla aplica sin excepción a todo el árbol de `components/`/`app/`.

`nativeID` es el que aporta valor hoy en la práctica: en web (`react-native-web`) se renderiza como el atributo `id` real del DOM, lo que permite apuntarle con selectores CSS estables en vez de tener que recorrer el árbol de `Pressable`s a mano — esto era un problema recurrente al verificar cambios con las herramientas de preview. `testID` no tiene efecto hoy (el proyecto no hace tests de render de componentes, ver sección Testing) pero se agrega igual para dejar el terreno preparado si eso cambia a futuro.

Convención de nombres: kebab-case, con scope propio del componente/rol (ej. `profile-header-edit-button`, `role-switch-corredor-segment`) — evitar nombres genéricos como `button-1` que puedan colisionar entre pantallas.

**Enforcement automático:** regla custom de ESLint (`local/require-native-id`, definida directamente en `eslint.config.js` — no es un paquete separado, solo un plugin inline) falla si falta cualquiera de los dos atributos en alguno de los tags de la lista de arriba. `npm run lint` debe estar en verde antes de mergear, igual que `npm test` — esto incluye código de otros devs (ej. si el compañero tiene una rama en paralelo que no cumple, se corrige al revisar/mergear esa PR). Excepción: un elemento con spread (`{...props}`) no se exige explícitamente, se asume que los ids pueden venir por ahí.

## Backend

- Repo separado (Go/Gin), no vive en este working directory, lo mantiene otra persona del equipo.
- URL configurable vía `EXPO_PUBLIC_API_URL` (ver `config/env.js`) — sin esa var, cae al backend remoto en Render (`https://paceron-backend-as9c.onrender.com/api/v1`) por default. **Actualización 2026-08-08:** este dominio cambió — el deploy viejo (`https://paceron-backend.onrender.com`) ahora sirve `master` (sin nada desplegado ahí todavía); el trabajo en curso vive en `develop`, servido por el dominio `-as9c` de arriba. Para apuntar a un backend local: copiar `.env.example` a `.env`, ajustar `EXPO_PUBLIC_API_URL=http://localhost:<puerto>/api/v1`, y **reiniciar** el dev server (Expo inyecta `EXPO_PUBLIC_*` al bundlear, no es hot-reloadable).
- Render (plan free) tiene cold-start de ~20-25s en la primera request tras inactividad — un "backend caído" suele ser esto, no un error real.
- El sistema de roles (corredor/entrenador) **ya pega contra el backend real** — activación (`assignRole`), alias de pago (`updateUser`) y consulta de roles asignados (`getPermissions` vía `/auth/permissions`) son requests reales, verificados 2026-07-19. Lo único que sigue siendo local-only es `activeRole` (cuál de los roles asignados se muestra activo en la UI en un momento dado) — el backend no tiene ese concepto, solo trackea qué roles tiene asignados un usuario (un conjunto, no una selección). Ver `store/auth-store.js`.
- Recuperación de contraseña (`forgot-password`/`reset-password`, código OTP de 6 dígitos, vence a los 10 minutos) también pega contra el backend real desde `feature/password-recovery` — ver `services/password.js`, pantallas en `components/auth/forgot-password-screen.jsx`/`reset-password-screen.jsx`.
- Equipos (`services/teams.js`) pega contra el backend real desde `feature/teams-backend-integration` (Etapa 1 de 3 — ver `docs/superpowers/specs/2026-07-28-teams-backend-integration-design.md`). Grupos e invitaciones siguen local-only en el frontend (Etapa 2/3, sin arrancar), pero **el backend ya tiene los endpoints reales de ambos** (CRUD de `/groups` completo, `/teams/{id}/invitations` para listar pendientes, `/invitations/{id}/accept`/`/reject`) — confirmado re-inspeccionando el swagger el 2026-07-30, ya no son bloqueante para arrancar esas etapas. Huecos de funcionalidad que siguen abiertos (foto de equipo, plan de entrenamiento en grupo) están documentados y trackeados en `docs/BACKEND_API_GAPS.md`, que también lleva el registro de qué se fue cerrando.
- Cambio de contraseña autenticado (`PATCH /users/{id}/password`, distinto del flujo OTP de recuperación) es un endpoint nuevo en el backend desde 2026-07-30, sin consumidor en el frontend todavía — no hay pantalla de "cambiar contraseña" dentro de Perfil hoy.

## Documentación existente en `docs/`

Además de `docs/superpowers/{specs,plans}/`, hay documentación previa al uso de Claude Code en este repo: `WORKFLOW.md`, `BRANCH_POLICIES.md`, `TESTING.md`, `STYLE_CONTRACT.md`, `ARQUITECTURA.md`, `FRONTEND_DEFINITIONS.md`, `BACKEND_DEFINITIONS.md`, `EXPO_ROUTER_GUIDE.md`, `FUNCTIONAL_PROPOSE.md`. Son una buena base pero **no están 100% sincronizados con la práctica actual** (ej. `BRANCH_POLICIES.md` describe un modelo con `release/`/`hotfix/`/tickets de Jira que todavía no se usa en la práctica — hoy el flujo real es el descripto arriba). Si algo de ahí queda desactualizado al tocarlo, corregirlo ahí también, no solo acá.

## Quirks conocidos

- El wordmark de `PaceronBrand` usa `skewX` para inclinarlo (se ve bien en web); en Android ese transform no se aplica (bug conocido de RN). Ya se probaron y descartaron 2 arreglos: mantener `skewX` (Android queda recto, aceptado) y usar `fontStyle: 'italic'` (cambia la tipografía por completo, rechazado por el usuario). No reintentar ninguno de los dos sin una idea genuinamente nueva.
- EAS (deploy mobile) usa una cuenta separada (`paceronapp`), con variantes dev/prod para Android (solo Android, iOS descartado). Sin trigger automático por push — el free tier tiene cola compartida de baja prioridad, poco predecible; se dispara a mano (`npm run eas:deploy:develop`/`:production`) cuando se decide publicar. Detalle completo en `docs/WORKFLOW.md`.
- `typescript@5.9.3` está pinned como `devDependency` real en `package.json` (satisface la dependencia interna de `eslint-config-expo`/`typescript-eslint`). Este proyecto no usa TypeScript — el pin existe solo para la plomería de linting. Resuelve el quirk anterior de flakiness local en `npm run lint`.
- Los archivos `.md` se pueden importar como string desde el código (ej. el contrato en `data/legal/terms-and-conditions.md`), gracias a `metro-markdown-transformer.js` enganchado en `metro.config.js`. **Cambiar config de Metro no es hot-reloadable:** después de bajar una rama que la toque, arrancar una vez con `npx expo start -c`. El renderer (`components/legal/markdown-view.jsx`) soporta solo un subset de markdown — el alcance exacto está documentado en el header de `utils/markdown-parser.js`.
- **Split `.web.jsx`/`.jsx` a nivel de componente (no de ruta) — el `import` tiene que ir SIN extensión.** Metro solo aplica resolución por plataforma (`.web.jsx` antes que `.jsx`) cuando el specifier no trae extensión (`from './checkout-flow'`); si se escribe la extensión explícita (`from './checkout-flow.jsx'`, el hábito de todo el resto del repo), Metro carga ese archivo literal en cualquier plataforma — en web, terminás ejecutando la rama nativa sin ningún error, solo el componente equivocado montado. Bug real encontrado en `components/payments/checkout-flow.jsx`/`.web.jsx` (2026-09-03, verificado en preview inspeccionando el DOM). No confundir con el split de rutas de Expo Router (`app/(tabs)/index.jsx`/`index.web.jsx`) — ese es un mecanismo aparte (file-based routing), no pasa por esta resolución de `import`.
