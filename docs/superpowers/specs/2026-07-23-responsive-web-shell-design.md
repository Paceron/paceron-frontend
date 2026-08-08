# Web responsivo: un solo bundle web para desktop y mobile — Design

**Fecha:** 2026-07-23
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

La web (`AppWebShell`, `HomeLandingScreen`) está pensada solo para
desktop. La app nativa compilada (`AppMobileShell`, `HomeMobileScreen`)
es otro bundle completamente aparte, elegido por `Platform.OS`. Nada
distingue hoy "web en desktop" de "web en un browser mobile" — ambos
caen en el mismo bundle desktop-only.

Como solución interina (branch `feature/mobile-browser-web-gate`,
mergeada) se agregó `isMobileBrowser()` (detección por user-agent) que
corta el acceso completo desde cualquier browser mobile y muestra una
landing placeholder ("la app nativa está pendiente de publicar"). Al
probarlo en el emulador se confirmó una limitación esperada pero
decisiva: el toggle "Sitio de escritorio" de Chrome cambia el
user-agent y evade la detección trivialmente — no es un bug, es una
limitación inherente a cualquier detección por user-agent. Esto llevó a
reconsiderar la estrategia completa: en vez de detectar y bloquear,
**hacer que la web sea responsive de verdad** — un solo bundle web que
se adapta a cualquier tamaño de viewport, eliminando la necesidad de
distinguir "mobile browser" de nada.

**Decisión explícita:** la app nativa compilada (Android, vía EAS)
queda **totalmente aparte** — el diferencial entre nativo y web pasa a
ser funcional (GPS, cámara, sensores — ya reflejado en
`utils/platform.js`), no de interfaz. Este trabajo es exclusivamente
sobre el bundle web.

**Urgencia:** el compañero del usuario arranca a desarrollar pronto
(días) — se prioriza que el shell de navegación y la landing queden
responsive y estables cuanto antes; el resto de las pantallas (perfil,
etc.) se revisan después si hace falta, no es parte del alcance de esta
spec.

**Convención hacia adelante:** a partir de ahora, todo componente o
pantalla nueva del front se construye pensando en que la web debe
funcionar en cualquier ancho de viewport — no se trata como un caso
aparte a resolver después. Esto se refleja en `CLAUDE.md` una vez
implementado.

## Alcance de esta spec

- Shell de navegación web (`app/(tabs)/_layout.jsx` y los componentes
  que renderiza cuando `isWeb`).
- Landing web (`app/(tabs)/index.web.jsx` y los componentes que
  renderiza).
- Remover el gate de `isMobileBrowser()` y la landing placeholder que
  lo acompañaba, ya superados por este trabajo.

**Fuera de alcance:** pantallas más allá de la landing (perfil, activar
entrenador, etc. — se evalúan después si el ancho angosto en web
resulta un problema ahí); la app nativa compilada (`AppMobileShell`,
`HomeMobileScreen` para `Platform.OS !== 'web'`) — no se toca su
comportamiento, solo se le extrae una pieza puramente presentacional
(ver Decisiones); desktop con aspect ratio angosto fuera de lo normal
— ya cubierto por este mismo breakpoint, no es un caso especial.

## Decisiones

### Mecanismo: `useWindowDimensions()`, no clases de NativeWind

Investigado antes de diseñar: los prefijos responsive de NativeWind
(`sm:`/`md:`/`lg:`) son media queries CSS — funcionan en web, no tienen
equivalente en nativo. Como este trabajo es exclusivamente web, esa
limitación en sí no bloquea nada, pero de todas formas **no se usan**
las clases responsive de NativeWind acá: la diferencia entre el shell
ancho y el angosto no es solo estilo (colores, spacing) sino qué
**estructura** se monta (tabs+dropdown vs. hamburguesa+drawer, con
estado propio cada una — dropdowns animados, drawer con
open/close). Decidir eso con clases CSS implicaría montar ambas
estructuras siempre y ocultar una con `display:none`, duplicando estado
y animaciones sin necesidad. En cambio, un hook compartido
(`useIsNarrowWeb()`, wrapper de `useWindowDimensions().width < 1024`)
decide en JS cuál de las dos estructuras montar.

**Breakpoint: 1024px.** Cualquier viewport más angosto que una notebook
chica (tablets y celulares en horizontal incluidos) cae en el modo
hamburguesa+drawer — evita un punto medio donde ni los tabs entran bien
ni se ve como mobile.

### Tres variantes evaluadas para el shell/landing angosto

1. **Reusar `AppMobileShell`/`HomeMobileScreen` tal cual** (los mismos
   componentes de la app nativa) — descartado: tienen código pensado
   para nativo (`BackHandler` del botón atrás de Android); cualquier
   cosa nativa-específica que se agregue ahí a futuro podría colarse al
   bundle web sin querer.
2. **Componentes nuevos y dedicados para web angosto** — elegido. La
   app nativa compilada queda intocada y aislada; cero riesgo de romper
   algo ya en uso mientras se itera en web.
3. **Un shell universal (mismo componente para web y nativo)** —
   descartado, contradice la decisión explícita de mantener el
   diferencial nativo/web funcional y no de interfaz; tocar el shell
   nativo que ya funciona es riesgo innecesario dada la urgencia.

### Mitigar la duplicación de la opción 2

El acordeón de Equipos (`TeamsAccordion`, hoy definido dentro de
`app-mobile-shell.jsx`) es puramente presentacional — no usa nada
nativo-específico (Reanimated + `View`/`Pressable`/`Text`, todo seguro
en web). Se extrae a `components/shell/teams-accordion.jsx` y lo
importan **ambos** shells (nativo y web angosto), evitando duplicar esa
pieza. Lo que no se comparte es el wrapper externo de cada shell
(`BackHandler`, `SafeAreaView` con edges distintos por plataforma) —
ahí es donde vive el riesgo real que se quiere evitar manteniendo
componentes separados.

### Archivos nuevos

- `hooks/use-is-narrow-web.js` — hook compartido del breakpoint
  (`useWindowDimensions().width < 1024`, fuente de verdad única del
  valor 1024 para que shell y landing usen exactamente el mismo corte).
- `components/shell/teams-accordion.jsx` — extraído de
  `app-mobile-shell.jsx`, sin cambios de comportamiento, ahora
  compartido.
- `components/shell/app-web-shell-narrow.jsx` (`AppWebShellNarrow`) —
  hamburguesa + drawer, propio de web, usa `teams-accordion.jsx`.
- `components/home/home-web-narrow-screen.jsx`
  (`HomeWebNarrowScreen`) — landing angosta web, reusa
  `landing-content.js` (misma fuente que ya comparten
  `home-landing-screen.jsx`/`home-mobile-screen.jsx`). A diferencia de
  la landing placeholder que se saca, esta **sí** tiene los CTAs
  funcionando (Empezar ahora/Ingresar) — mobile web pasa a ser una
  experiencia soportada, no bloqueada.

### Archivos modificados

- `app/(tabs)/_layout.jsx` — cuando `isWeb`, usa `useIsNarrowWeb()`
  para elegir `AppWebShell` (sin cambios internos) vs
  `AppWebShellNarrow`. Cuando no es web, sin cambios (sigue
  `AppMobileShell` tal cual).
- `app/(tabs)/index.web.jsx` — usa el mismo hook para elegir
  `HomeLandingScreen` (sin cambios) vs `HomeWebNarrowScreen`.
- `components/shell/app-mobile-shell.jsx` — se le saca `TeamsAccordion`
  (pasa a importarlo de `teams-accordion.jsx`), sin cambio de
  comportamiento.
- `app/_layout.jsx` — se saca el gate de `isMobileBrowser()` y el
  render condicional de la landing placeholder.

### Archivos que se borran

- `components/home/mobile-browser-landing-screen.jsx`.
- `isMobileBrowser()` en `utils/platform.js` — sin consumidores una vez
  sacado el gate, se borra en vez de dejarla sin uso.

## Notas de implementación

- `useWindowDimensions()` durante el prerender estático (Node, sin
  `window` real) devuelve un valor por default de RN Web — la
  reconciliación real ocurre al hidratar en el cliente. Puede causar un
  reflow/parpadeo breve en la primera carga; trade-off aceptado de
  detección client-side sin SSR por request (mismo tipo de limitación
  ya aceptada para `isMobileBrowser()`, pero acá el impacto es menor:
  ambas variantes son funcionales, no es "contenido bloqueado vs
  permitido", solo un ajuste de layout).
- Se implementa **por etapas, en la misma branch** (`feature/responsive-web-shell`),
  commits chicos separados por pieza — mismo criterio que se usó en
  `feature/button-hover-consistency` y el backfill de `nativeID`: no
  mezclar todo en un diff gigante.

## Verification

- `npm test` → 33/33 (sin lógica nueva testeable con Jest, es
  UI/layout puro).
- `npm run lint` → 0 errores, incluye `nativeID`/`testID` obligatorio en
  todo lo nuevo.
- Preview web: redimensionar el viewport cruzando los 1024px y
  confirmar que el shell y la landing cambian de estructura en el punto
  justo.
- Verificación real del usuario en el emulador Android (Chrome,
  `localhost:8081`): confirmar que la web mobile ahora funciona de
  punta a punta (login, registro, nav por drawer, Equipos vía
  acordeón) en vez de mostrar el aviso bloqueado de antes.
