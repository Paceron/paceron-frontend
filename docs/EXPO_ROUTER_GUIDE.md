# Guia de Expo Router y ruteo del proyecto

Este documento describe como funciona el ruteo basado en archivos con Expo Router en este repo, como se trabajan los parametros, como se organizan las pantallas, y como se maneja el ruteo por plataforma.

## Objetivo y alcance

- Explicar el ruteo file-based y como se traduce a URLs.
- Documentar el flujo actual del repo (rutas, layouts y demo).
- Dejar buenas practicas para navegar, pasar parametros y organizar pantallas.

## Como funciona el ruteo file-based

Expo Router genera rutas a partir de la carpeta [app/](app/).

Reglas base:

- `app/index.jsx` o `app/(grupo)/index.jsx` representan `/` o el indice del grupo.
- `_layout.jsx` define layouts y navegadores para la carpeta actual.
- Carpetas entre parentesis (ej. `(tabs)`) son grupos logicos que no aparecen en la URL.
- Archivos con `[param]` generan segmentos dinamicos (ej. `[id].jsx` => `/:id`).
- Anidar carpetas anida la ruta (ej. `demo/step-one/step-two` => `/demo/step-one/step-two`).

## Layouts y navegadores del proyecto

En este repo, el ruteo se estructura asi:

- [app/_layout.jsx](app/_layout.jsx) define el `Stack` raiz, providers y estilos globales.
- [app/(tabs)/_layout.jsx](app/(tabs)/_layout.jsx) define el shell web/mobile segun plataforma.
- El `Stack` raiz registra `mobile-only` como modal.

Esto permite:

- Mantener un shell visual compartido en web y mobile.
- Declarar rutas especiales (por ejemplo modales) en el layout raiz.

## Rutas actuales en el repo

Rutas principales:

- `/` -> [app/(tabs)/index.jsx](app/(tabs)/index.jsx) (home principal).
- `/demo` -> [app/(tabs)/demo/index.jsx](app/(tabs)/demo/index.jsx).
- `/demo/step-one` -> [app/(tabs)/demo/step-one/index.jsx](app/(tabs)/demo/step-one/index.jsx).
- `/demo/step-one/step-two` -> [app/(tabs)/demo/step-one/step-two/index.jsx](app/(tabs)/demo/step-one/step-two/index.jsx).
- `/demo/step-one/step-two/[id]` -> [app/(tabs)/demo/step-one/step-two/[id].jsx](app/(tabs)/demo/step-one/step-two/%5Bid%5D.jsx).
- `/demo/step-one/params` -> [app/(tabs)/demo/step-one/params.jsx](app/(tabs)/demo/step-one/params.jsx).
- `/:module` -> [app/(tabs)/[module].jsx](app/(tabs)/%5Bmodule%5D.jsx) (modulos del catalogo).
- `/mobile-only` -> [app/mobile-only.jsx](app/mobile-only.jsx) (ruta mobile-only con redireccion web).

## Parametros: path vs query

Expo Router soporta dos formas principales:

### 1) Parametros en el path (segmentos dinamicos)

Se declaran con archivos `[param].jsx`.

Ejemplo real:

- Archivo: [app/(tabs)/demo/step-one/step-two/[id].jsx](app/(tabs)/demo/step-one/step-two/%5Bid%5D.jsx)
- Ruta: `/demo/step-one/step-two/:id`

Lectura:

```js
import { useLocalSearchParams } from 'expo-router';

const { id } = useLocalSearchParams();
```

### 2) Parametros por query (libres)

Se pasan via `router.push` con `params` y se leen con `useLocalSearchParams`.

Ejemplo real:

```js
router.push({
  pathname: '/demo/step-one/params',
  params: { mood: 'nitido', focus: 'parametros', count: '3' },
});
```

En la pantalla:

```js
const params = useLocalSearchParams();
const entries = Object.entries(params);
```

Notas:

- `useLocalSearchParams` puede devolver strings o arrays si el param se repite.
- Siempre normalizar con `String()` o `Array.isArray()` si se reutiliza el valor.

## Navegacion: router y redirects

En pantallas del repo se usa:

- `useRouter()` para `router.push`, `router.back`, `router.replace`.
- `Redirect` para redireccion en web cuando la pantalla es mobile-only.

Ejemplos reales:

- Demo anidada usa `router.push('/demo/step-one/step-two')`.
- Mobile-only usa `MobileOnlyRoute` y `Redirect` si la plataforma es web.

## Pantallas mobile-only

Este repo usa una estrategia de gate:

- [components/platform-gate.jsx](components/platform-gate.jsx) implementa `MobileOnlyRoute`.
- [app/mobile-only.jsx](app/mobile-only.jsx) envuelve su contenido con `MobileOnlyRoute`.
- En web, la ruta redirige a `/`.

Opciones disponibles:

1) **Gate por componente** (actual)
   - La ruta existe, pero se redirige en web.
   - Permite mantener el archivo unico y controlar el fallback.

2) **Archivos por plataforma** (`.native.jsx`, `.web.jsx`)
   - La ruta no existe en web si solo hay `.native.jsx`.
   - Requiere evitar links a esa ruta en web o proveer un fallback `.web.jsx`.

Si se agrega una nueva pantalla mobile-only:

- Mantener el archivo en `app/` y envolver con `MobileOnlyRoute`.
- Opcional: crear una variante `.native.jsx` si se quiere eliminarla del build web.
- Registrar el modal o screen en [app/_layout.jsx](app/_layout.jsx) si corresponde.

## Ruteo por plataforma

Expo Router resuelve la ruta por plataforma usando sufijos:

- `index.jsx` para ruta general.
- `index.web.jsx` para web.
- `index.native.jsx` para mobile.

En este repo:

- [app/(tabs)/index.web.jsx](app/(tabs)/index.web.jsx) simplifica la home en web.
- [utils/platform.js](utils/platform.js) ayuda a decidir renderizado en runtime.

## Componentes dentro de rutas

Regla del repo:

- `components/` contiene pantallas y bloques reutilizables.
- `app/` contiene rutas y layouts.

Las rutas pueden importar pantallas compartidas, por ejemplo:

- [components/home-mobile-screen.jsx](components/home-mobile-screen.jsx) en home mobile (`app/(tabs)/index.jsx`).
- [components/home-landing-screen.jsx](components/home-landing-screen.jsx) en home web (`app/(tabs)/index.web.jsx`).
- [components/module-detail-screen.jsx](components/module-detail-screen.jsx) para `/:module`.

Esto mantiene separada la logica de UI reutilizable del enrutamiento.

## Navegacion principal (Shell)

La navegacion visible en el shell sale del catalogo:

- [routes/catalog.js](routes/catalog.js) exporta `navigationRoutes`.
- `ShellNav` (en [app/_layout.jsx](app/_layout.jsx)) renderiza esos links.
- Para agregar una pantalla al menu, hay que agregarla al catalogo.

## Fortalezas y debilidades del enfoque

Fortalezas:

- Ruteo declarativo y claro por estructura de archivos.
- Co-locacion entre layout y ruta.
- Facil de escalar con nuevos modulos o grupos.
- Deep links naturales con URLs estables.

Debilidades y cuidados:

- Renombrar archivos cambia la URL (requiere revisar links).
- Mucha logica en `_layout.jsx` puede crecer rapido.
- Variantes por plataforma suman complejidad si no hay convencion.
- Parametros sin tipado fuerte requieren validacion manual.

## Checklist para agregar una ruta nueva

1) Crear el archivo en `app/` con la ruta deseada.
2) Si es una pantalla modal o especial, registrarla en [app/_layout.jsx](app/_layout.jsx).
3) Si debe verse en el menu, agregarla en [routes/catalog.js](routes/catalog.js).
4) Si es por plataforma, usar `.web.jsx` o `.native.jsx` o `MobileOnlyRoute`.
5) Si recibe parametros, normalizar con `useLocalSearchParams`.

## Demo de parametros (referencia)

La demo actual incluye ejemplos reales:

- Parametros por query en [app/(tabs)/demo/step-one/params.jsx](app/(tabs)/demo/step-one/params.jsx).
- Segmentos dinamicos en [app/(tabs)/demo/step-one/step-two/[id].jsx](app/(tabs)/demo/step-one/step-two/%5Bid%5D.jsx).

Estas pantallas sirven como base para replicar el patron en rutas nuevas.
