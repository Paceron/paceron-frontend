# Arquitectura del template Paceron

La idea central del template es simple: servir como base cross-platform para la propuesta de Paceron, sin mezclar todavía lógica de negocio pesada ni asumir una implementación final del producto.

## Contexto del producto

La aplicación propuesta por el proyecto apunta a una plataforma digital para entrenadores, corredores y administradores, con foco en:

- gestión de usuarios y roles;
- administración de equipos de running;
- planificación y seguimiento de entrenamientos;
- registro de actividades deportivas;
- sesiones presenciales con control de asistencia;
- monitoreo de progreso;
- suscripciones y cobros;
- gamificación;
- asistencia basada en inteligencia artificial.

Ese alcance aparece en la documentación funcional del proyecto, pero este repositorio solo implementa la base estructural para empezar a construirlo.

## Objetivo del template

Proveer una base mínima, clara y extensible para una app Expo cross-platform con:

- navegación file-based con Expo Router;
- UI compartida para web y mobile;
- separación por dominios funcionales;
- estado local listo para crecer;
- servicios preparados para conectar backend;
- providers globales centralizados.

No pretende resolver todavía autenticación real, backend productivo ni toda la lógica de negocio del sistema final.

## Stack tecnológico real

El stack actual del repositorio es:

- Expo managed workflow;
- Expo Router;
- React 19;
- React Native 0.81;
- React Native Web;
- NativeWind + Tailwind;
- Zustand para estado local;
- TanStack Query para estado remoto;
- Expo Location, Expo Constants y Expo Status Bar;
- Jest + jest-expo para testing;
- Testing Library para React Native.

## Arquitectura general

### Routing y shell

- [app/](app) contiene las rutas reales.
- [routes/](routes) centraliza catálogos semánticos de navegación y helpers.
- [app/_layout.jsx](app/_layout.jsx) define el shell raíz, los providers y el stack principal.
- [app/(tabs)/_layout.jsx](app/(tabs)/_layout.jsx) elige shell web o mobile según plataforma.
- [app/(tabs)/index.jsx](app/(tabs)/index.jsx) es el home mobile; [app/(tabs)/index.web.jsx](app/(tabs)/index.web.jsx) es el home web (par platform-specific de Expo Router).
- [app/(tabs)/[module].jsx](app/(tabs)/[module].jsx) reserva una ruta genérica por módulo.
- [app/(tabs)/demo/](app/(tabs)/demo/) agrupa la demo de rutas anidadas y parámetros.
- [app/mobile-only.jsx](app/mobile-only.jsx) expone la pantalla móvil con `MobileOnlyRoute` (redirección en web).

### UI compartida

- [components/](components) contiene pantallas y piezas reutilizables.
- [components/app-shell.jsx](components/app-shell.jsx) es el shell mobile: TopAppBar + NavigationDrawer con animación Reanimated (solo Android).
- [components/web-app-shell.jsx](components/web-app-shell.jsx) es el shell web: TopBar + sidebar fijo de 240px.
- [components/home-mobile-screen.jsx](components/home-mobile-screen.jsx) es el home hub mobile con hero, bento de módulos y banner IA.
- [components/home-landing-screen.jsx](components/home-landing-screen.jsx) es el home hub web con hero, grid de 3 columnas y banner IA horizontal.
- [components/dashboard-screen.jsx](components/dashboard-screen.jsx) es el placeholder original del scaffold (referencia, ya no es el home activo).
- [components/module-detail-screen.jsx](components/module-detail-screen.jsx) muestra el detalle placeholder por módulo.
- [components/platform-gate.jsx](components/platform-gate.jsx) protege bloques de UI o rutas según plataforma.

### Estado y servicios

- [store/](store) concentra el estado compartido por dominio.
- [store/app-store.js](store/app-store.js) compone clock, weather, location y dashboard.
- [services/](services) contiene integraciones y clientes.
- [services/api.js](services/api.js) es el cliente HTTP base.
- [services/location.js](services/location.js) y [services/weather.js](services/weather.js) representan las integraciones de contexto.

### Providers y utilidades

- [providers/](providers) centraliza providers globales.
- [providers/app-providers.jsx](providers/app-providers.jsx) envuelve la app con `QueryClientProvider` y `ThemeProvider`.
- [providers/theme-provider.jsx](providers/theme-provider.jsx) administra el modo visual `light` / `dark`. En web gestiona la clase `.dark` en `<html>` directamente para que las variantes Tailwind se activen correctamente.
- [theme/colors.js](theme/colors.js) expone constantes de color JS y el hook `useThemeColors()` para resolver colores de íconos en props nativas (donde CSS variables no funcionan).
- [utils/](utils) agrupa helpers comunes.
- [utils/platform.js](utils/platform.js) expone checks de plataforma.

### Sistema visual y estilos globales

- [global.css](global.css) define reglas globales básicas del navegador (fondo y sizing).
- [nativewind.css](nativewind.css) es el input de Tailwind para NativeWind.
- [tailwind.config.js](tailwind.config.js) habilita `darkMode: 'class'` y define el escaneo de archivos donde se usan clases utilitarias.
- [metro.config.js](metro.config.js) conecta Metro con NativeWind (`withNativeWind`).
- [app/_layout.jsx](app/_layout.jsx) importa los estilos y conecta el shell con el provider de tema.
- [app.json](app.json) usa `userInterfaceStyle: automatic` para permitir el tema del sistema en plataformas nativas.

En mobile, `react-native-reanimated` es requerido por `react-native-css-interop`.

### Reconduccion del diseño

Si en el futuro cambia la UI (sidebar, layout, estilos o lenguaje visual), las capas a revisar son:

- [app/_layout.jsx](app/_layout.jsx) y [app/(tabs)/_layout.jsx](app/(tabs)/_layout.jsx) para estructura general, shells y ubicacion de navegacion.
- [components/](components) para el sistema de pantallas y bloques reutilizables (cards, headers, sidebars, etc.).
- [routes/catalog.js](routes/catalog.js) si se ajusta la navegacion, labels o agrupaciones de rutas.
- [global.css](global.css) para reglas base del navegador (scroll, background y sizing global).
- [nativewind.css](nativewind.css) y [metro.config.js](metro.config.js) para la compilacion de Tailwind en web.
- [tailwind.config.js](tailwind.config.js) para tokens, colores, tipografia, spacing y variantes.
- [providers/theme-provider.jsx](providers/theme-provider.jsx) para el modo visual y el toggle de tema.

La idea es que el layout se reconduzca modificando shells y componentes compartidos primero, dejando intacta la estructura de rutas y estados del dominio.

El tema visual se maneja así:

- el estado inicial se lee de `localStorage` en web (`light` por defecto si no hay valor guardado);
- `ThemeProvider` sincroniza ese estado con NativeWind y, en web, gestiona `document.documentElement.classList.toggle('dark', ...)` directamente;
- el shell expone un toggle manual para alternar entre `light` y `dark`;
- las pantallas usan variantes `dark:` para ajustar fondos, superficies y texto;
- los colores para props de íconos (`@expo/vector-icons`) se resuelven con `useThemeColors()` ya que los valores CSS no funcionan en props nativas.

### Qué aporta NativeWind aquí

NativeWind aporta:

- clases utilitarias cruzadas entre web y mobile;
- variantes de tema con `dark:`;
- una forma uniforme de expresar spacing, color, bordes, tipografía y layouts simples;
- bajo costo para iterar rápido en UI compartida.

NativeWind no resuelve por sí solo:

- el sistema de diseño completo del producto;
- la persistencia del tema;
- tokens semánticos de negocio como `coachPrimary` o `runnerWarning`;
- estados complejos de componentes, accesibilidad avanzada o interacción rica;
- la decisión arquitectónica de qué piezas viven en `components/`, `routes/`, `store/` o `services/`.

Por eso, en este scaffold se usa NativeWind para la capa visual base y se deja la semántica del producto a providers, catálogos y componentes de dominio.

## Comportamiento actual del scaffold

El estado real del repo muestra una arquitectura mínima pero ya operativa:

- el layout raíz usa `SafeAreaProvider` y `AppProviders`;
- el shell cambia entre web y mobile según `isWeb`;
- la navegación principal se apoya en `navigationRoutes`;
- la navegación incluye la ruta `demo` en el catálogo (`demoRoute`);
- el estado global se arma con Zustand;
- el cliente HTTP lee el token desde el store;
- el provider de TanStack Query ya está listo para usar queries y mutations;
- las pantallas principales son placeholders ricos en estructura, no en lógica de negocio.

## Convenciones del proyecto

- Mantener las rutas reales dentro de [app/](app).
- Usar [routes/](routes) como fuente de verdad para labels, hrefs y catálogos.
- Separar lógica de plataforma en [utils/](utils) o en variantes `.web.jsx` cuando haga falta.
- Usar `MobileOnlyRoute` para pantallas móviles que deben redirigir en web.
- Evitar mezclar acceso a API, estado y UI dentro de una misma pantalla.
- Reservar una capa por dominio antes de implementar lógica compleja.
- Centralizar los estilos globales en [global.css](global.css) y el modo visual en [providers/theme-provider.jsx](providers/theme-provider.jsx).
- Resolver decisiones de tema y layout en componentes compartidos, no en pantallas aisladas.

## Qué ya está alineado con el producto

La estructura actual ya deja reservados los dominios funcionales del proyecto:

- usuarios y roles;
- equipos;
- entrenamientos;
- actividades;
- asistencia;
- monitoreo;
- administración;
- suscripciones;
- gamificación;
- asistente IA.

Eso permite que cada bloque crezca sin romper la navegación principal ni el shell compartido.

## Qué está previsto a futuro

La documentación funcional del proyecto propone extensiones que todavía no forman parte del scaffold:

- registro automático de asistencia por geolocalización;
- conexión con smartwatches;
- ampliación a otras disciplinas deportivas;
- reglas de negocio reales para suscripciones, cobros y moderación;
- IA para recomendaciones, resúmenes y consultas en lenguaje natural;
- integración backend completa.

## Integraciones visuales futuras

La arquitectura visual permite sumar más capas sin romper la base actual:

- design tokens en `tailwind.config.js` cuando el producto deje de ser solo scaffold;
- componentes de UI reutilizables por dominio para botones, cards, chips y formularios;
- persistencia de preferencias visuales por usuario cuando exista autenticación;
- librerías de gráficos, mapas o tablas sin abandonar NativeWind como capa base;
- una convención de tema compartida entre web, mobile y futuras vistas administrativas.

## Testing y evolución

La base de testing ya quedó preparada con una estrategia mínima y estable:

- Jest como runner;
- `jest-expo` como preset;
- `@testing-library/react-native` para UI;
- configuración mínima de Babel y transformaciones;
- un smoke test estable sobre el catálogo de rutas.

La prioridad de este template no es crear una gran batería de tests, sino asegurar que la base del proyecto es testeable y que el ecosistema de Expo queda bien configurado desde el inicio.

## Lectura recomendada por archivo

- [app/_layout.jsx](app/_layout.jsx): shell raíz y providers.
- [app/(tabs)/_layout.jsx](app/(tabs)/_layout.jsx): selección de shell web o mobile.
- [providers/app-providers.jsx](providers/app-providers.jsx): providers globales.
- [providers/theme-provider.jsx](providers/theme-provider.jsx): toggle light/dark y fix de dark mode web.
- [routes/catalog.js](routes/catalog.js): catálogo de navegación y módulos.
- [store/app-store.js](store/app-store.js): composición del estado compartido.
- [services/api.js](services/api.js): cliente HTTP base.
- [components/app-shell.jsx](components/app-shell.jsx): shell mobile con drawer animado.
- [components/web-app-shell.jsx](components/web-app-shell.jsx): shell web con sidebar fijo.
- [components/home-mobile-screen.jsx](components/home-mobile-screen.jsx): home hub mobile.
- [components/home-landing-screen.jsx](components/home-landing-screen.jsx): home hub web.
- [components/module-detail-screen.jsx](components/module-detail-screen.jsx): detalle placeholder de módulo.
- [components/platform-gate.jsx](components/platform-gate.jsx): gate de plataforma para rutas móviles.
- [theme/colors.js](theme/colors.js): constantes de color para íconos nativos.
- [TESTING.md](TESTING.md): decisión y alcance del setup de pruebas.

## Resumen final

La arquitectura del proyecto es deliberadamente mínima:

- una sola codebase para web y mobile;
- navegación centralizada en Expo Router;
- estado y servicios preparados para crecer;
- providers y utilidades separados;
- testing simple y estable.

Esa base es suficiente para empezar a implementar el dominio funcional del proyecto sin sobrecargar la plantilla.
