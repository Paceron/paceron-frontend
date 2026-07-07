# Frontend

## Estructura

Basado en el scaffold cross-platform del repo.

- [app/](app/): Entradas de navegacion y UI de alto nivel
  Contrato: cada archivo representa una pantalla, layout o punto de entrada del sistema de rutas. Mantiene UI y composicion, sin logica de dominio profunda ni acceso directo a infraestructura.
  Que va aqui: layouts, tabs, rutas estaticas y dinamicas, wrappers de navegacion, entry points por plataforma, shells y contenedores de pagina.
  Buenas practicas: minimizar data-fetching directo, preferir props o hooks de dominio, y evitar decisiones de negocio en el nivel de rutas.

- [routes/](routes/): Catalogos de navegacion y metadatos
  Contrato: fuente de verdad para nombres, paths, agrupaciones y reglas de navegacion. No depende de UI ni de plataformas, y busca estabilidad para consumirla desde cualquier pantalla.
  Que va aqui: catalogos de rutas, helpers de navegacion, mapas de modulos, configuraciones compartidas, tags y metadata de navegacion.
  Buenas practicas: evitar acoplar labels o paths en componentes; consumir siempre desde el catalogo.

- [components/](components/): UI reutilizable y composicion
  Contrato: componentes, pantallas y bloques compartidos que pueden vivir fuera del enrutador. Evitan dependencia directa de rutas y exponen APIs de props claras.
  Que va aqui: screens, cards, headers, estados vacios, modulos visuales compartidos, layouts parciales y componentes de forma.
  Buenas practicas: separar componentes presentacionales de contenedores; mantener estilos y layout cerca de la UI.

- [store/](store/): Estado y logica de dominio
  Contrato: capa de estado, acciones y selectores que modelan el dominio sin conocer UI ni rutas. Debe ser predecible, testeable y desacoplada.
  Que va aqui: stores por dominio, store compuesto, helpers de estado compartidos, selectores y acciones reutilizables.
  Buenas practicas: mantener acciones puras, encapsular efectos en servicios y documentar el shape del estado.

- [services/](services/): Integraciones y acceso a datos
  Contrato: capa de acceso a APIs, dispositivos o servicios externos, sin dependencias de UI. Debe exponer interfaces estables para el dominio.
  Que va aqui: clientes HTTP, adaptadores de device APIs, wrappers externos, normalizadores de respuestas, gateways de infraestructura.
  Buenas practicas: centralizar manejo de errores, timeouts y retries; no incluir logica de presentacion.

- [providers/](providers/): Contextos y configuracion global
  Contrato: inicializacion de providers y configuraciones que envuelven la app completa. Define limites de contexto y dependencias globales.
  Que va aqui: providers de tema, estado, query, i18n, analytics u otros contextos globales.
  Buenas practicas: mantener orden de providers estable y documentado; evitar side effects no controlados.

- [utils/](utils/): Utilidades transversales
  Contrato: helpers puros y utilidades comunes sin dependencias de UI ni dominio. Deben ser pequenos, predecibles y faciles de testear.
  Que va aqui: helpers de plataforma, formateo, validaciones, utilidades compartidas.
  Buenas practicas: evitar dependencias circulares; priorizar funciones puras.

- [assets/](assets/): Recursos estaticos
  Contrato: archivos no ejecutables usados por la UI o el runtime. Deben estar organizados y con nombres consistentes.
  Que va aqui: imagenes, iconos, fuentes, animaciones, archivos estaticos.

- [app.json](app.json) / [babel.config.js](babel.config.js) / [metro.config.js](metro.config.js) / [tailwind.config.js](tailwind.config.js):
  Contrato: configuracion de tooling, build y estilos para el stack web y mobile.
  Que va aqui: configuraciones de bundler, transformaciones, alias, paths de contenido y ajustes de plataforma.

## Mapa de dependencias entre carpetas

- [app/](app/) -> [components/](components/), [routes/](routes/), [providers/](providers/), [utils/](utils/)
- [components/](components/) -> [store/](store/), [services/](services/), [utils/](utils/)
- [store/](store/) -> [services/](services/), [utils/](utils/)
- [services/](services/) -> [utils/](utils/) (opcional)
- [providers/](providers/) -> [store/](store/), [services/](services/), [utils/](utils/)
- [routes/](routes/) -> no depende de UI (solo data y helpers)
- [utils/](utils/) -> no depende de ninguna otra carpeta de la app

Regla de oro: la UI consume store y services, pero services y store no conocen UI.

## Acuerdos generales para frontend

- Framework: Expo managed workflow con Expo Router. Se prioriza una sola codebase con rutas declarativas y soporte web + mobile.
- UI: React 19 + React Native 0.81 + React Native Web. Componentes compartidos, con variantes por plataforma cuando sea necesario.
- Estilos: NativeWind + Tailwind. Se promueve el uso de tokens y clases reutilizables para consistencia visual.
- Estado local: Zustand para estado de UI y dominio con acciones claras y selectores.
- Estado remoto: TanStack Query para fetch, cache, reintentos y sincronizacion con backend.
- Testing: Jest, jest-expo, Testing Library para pruebas unitarias, integracion de componentes y smoke tests.

### Estado local con Zustand

Zustand se usa como capa de estado local y de dominio por su API simple y su composicion modular.

- Alcance: estado que debe sobrevivir a re-renders, compartir datos entre pantallas o modelar flujos de negocio.
- Diseno: stores por dominio con acciones descriptivas y selectores para evitar re-renderes innecesarios.
- Efectos: efectos secundarios se delegan a services y luego se consolidan en acciones del store.
- Consistencia: mantener un shape estable, versionado y documentado para evitar regresiones.
- Testing: acciones y selectores deben poder testearse sin dependencia de UI.

### Estado remoto con TanStack Query

TanStack Query gestiona datos asincronicos y cache con politicas declarativas.

- Responsabilidad: fetch, cache, revalidacion, manejo de errores y sincronizacion.
- Estrategia: queries para lectura y mutations para escritura, con invalidacion explicita.
- Experiencia: estados de carga, error y stale manejados en la capa de hooks o store, no en UI directa.
- Performance: evitar sobre-fetching con keys estables y cache de queries compartidas.
- Observabilidad: habilitar logs y devtools en entornos de desarrollo cuando sea necesario.

### Providers y contexto global

Los providers encapsulan dependencias globales y configuraciones compartidas.

- Orden: definir un orden estable (tema, estado, query, i18n, analytics) para evitar efectos colaterales.
- Alcance: limitar la responsabilidad de cada provider y evitar mezclar concerns.
- Integracion: exponer hooks o helpers para consumo desde UI y stores.
- Cross-platform: centralizar aqui diferencias de plataforma que requieran contexto global.

## Reglas de arquitectura

### Direccion de dependencias

- UI -> Estado/Servicios -> Utilidades
- Providers -> Estado/Servicios
- Catalogos de rutas -> UI (solo lectura)
- Servicios no dependen de UI ni de providers.
- Utilidades no dependen de ningun otro dominio.
- Las dependencias deben fluir en una sola direccion para evitar ciclos.

### Acuerdos de consistencia

- Evitar mezclar UI, estado y servicios en la misma pantalla.
- No importar servicios desde components si ya existe un store para ese dominio.
- Centralizar la navegacion en routes/ y evitar hardcode de labels/hrefs en UI.
- Usar utils/ o variantes .web.jsx para decisiones de plataforma.
- Para pantallas mobile-only, usar `MobileOnlyRoute` y/o variantes `.native.jsx` segun el caso.
- Preferir composicion sobre herencia en componentes compartidos.
- Normalizar respuestas de servicios antes de llevarlas a estado.
- Mantener limites claros entre estado local y estado remoto.

## Nombres de archivos y convenciones

- Pantallas en components/ con nombres descriptivos y sufijo -screen.jsx.
- Rutas en app/ usando convenciones de Expo Router.
- Stores por dominio en store/ con sufijo -store.js.
- Servicios por dominio en services/ con sufijo .js.
- Hooks de dominio con prefijo use y ubicados junto al store o en una carpeta dedicada.
- Componentes de presentacion con nombres semanticos y sin sufijos de plataforma.
- Variantes por plataforma solo cuando sean necesarias (por ejemplo .web.jsx o .native.jsx).

## Sistema visual y tema

- [global.css](global.css) define base web (background, sizing, scroll).
- [nativewind.css](nativewind.css) es la entrada de Tailwind para NativeWind.
- [tailwind.config.js](tailwind.config.js) habilita darkMode: class y define content paths.
- [metro.config.js](metro.config.js) integra NativeWind con Metro.
- [providers/theme-provider.jsx](providers/theme-provider.jsx) controla modo light/dark. En web gestiona `document.documentElement.classList` directamente para activar variantes Tailwind.
- [app/_layout.jsx](app/_layout.jsx) importa estilos y conecta el provider de tema.

Principios de tema y estilos:

- Usar tokens de color y espaciado consistentes para web y mobile.
- Evitar estilos inline salvo excepciones.
- Definir escalas de tipografia y jerarquias de color.
- Preferir clases reutilizables y utilities sobre estilos ad-hoc.

En mobile, react-native-reanimated es requerido por react-native-css-interop.

## Flujo de datos

- Pantallas -> store/actions -> services -> api
- Queries y mutations viven en capa de hooks o store, no en UI directa.
- El store actua como orquestador: recibe datos, normaliza y expone estado.
- Los servicios son la unica capa que conoce endpoints, storage o SDKs externos.
- Las pantallas consumen el estado como fuente unica de verdad.

## Routing y shell

- [app/_layout.jsx](app/_layout.jsx) define el layout raiz y providers.
- [app/(tabs)/_layout.jsx](app/(tabs)/_layout.jsx) selecciona shell web o mobile.
- [app/(tabs)/[module].jsx](app/(tabs)/%5Bmodule%5D.jsx) reserva ruta generica por modulo.
- [routes/catalog.js](routes/catalog.js) centraliza rutas y labels.
- [app/(tabs)/demo/](app/(tabs)/demo/) contiene la demo de rutas anidadas y parametros.
- [app/mobile-only.jsx](app/mobile-only.jsx) es una pantalla mobile-only protegida con `MobileOnlyRoute`.

Buenas practicas de routing:

- Mantener rutas declarativas y alineadas con el catalogo.
- Encapsular protecciones de ruta en wrappers o guards.
- Evitar logica de fetch en layouts, salvo prefetching global.
- Usar rutas genericas solo cuando haya un contrato claro de params.

Para una guia detallada del ruteo, ver [docs/EXPO_ROUTER_GUIDE.md](docs/EXPO_ROUTER_GUIDE.md).

## Testing

- Jest como runner.
- jest-expo como preset.
- @testing-library/react-native para UI.
- Smoke tests sobre catalogos de rutas.
- Priorizar pruebas de dominio sobre pruebas de estilos.
- Cubrir flujos criticos con integracion de store + UI.
- Mantener mocks de services aislados y reutilizables.
