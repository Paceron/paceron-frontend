# Contenido compartido para landing web/mobile — Design

**Fecha:** 2026-07-10
**Estado:** Aprobado, implementación directa (cambio chico)

## Contexto

`components/home/home-landing-screen.jsx` (web) y `components/home/home-mobile-screen.jsx`
(mobile) muestran la misma landing pública conceptualmente, pero cada uno
tiene su propio copy hardcodeado — y **ya divergieron**: mismas 6 features,
mismo hero, mismo panel de IA, mismas audience cards (corredores/entrenadores),
pero con textos distintos entre versiones (mobile más corto, web más
detallado). Riesgo de mantenimiento: cambiar un texto requiere tocar 2 lugares
y ya no coinciden.

## Decisión

- **Nuevo módulo de datos**: `components/home/landing-content.js` — sin JSX,
  exporta el copy compartido. Mismo patrón que `data/locations.js`.
- **Los dos componentes de presentación no cambian de estructura/layout**
  (grid de cards vs filas, botones lado a lado vs apilados, tamaños de fuente
  — todo eso se queda como está). Solo dejan de tener arrays de contenido
  propios y importan de `landing-content.js`.
- **Nombres de archivo sin cambios** (`home-landing-screen.jsx`,
  `home-mobile-screen.jsx`) — evita tocar imports en
  `app/(tabs)/index.jsx`/`index.web.jsx` sin necesidad.
- **Versión de copy que se conserva**: la más corta (la que hoy tiene mobile),
  para hero, las 6 features, panel de IA, y las 2 audience cards. Texto corto
  se ve bien en ambos layouts; texto largo desbordaría en mobile.
- **Footer no se toca**: es específico de la versión web (mobile ya no tiene
  footer, decisión de branches anteriores), sin datos que compartir ahí.

## Contenido de `landing-content.js`

```js
export const HERO_CONTENT = { badge, title, description, primaryCta, secondaryCta };
export const FEATURES = [ { icon, title, description }, ...6 ];
export const AI_PANEL_CONTENT = { badge, title, description };
export const AUDIENCE_CARDS = [ { icon, title, description }, ...2 ]; // corredores, entrenadores
```

Valores tomados literalmente del `home-mobile-screen.jsx` actual (fuente de
verdad = versión corta).

## Verificación

- `npm test` (suite no cubre estas pantallas, pero confirma que nada más se
  rompió).
- Web preview: landing renderiza igual, solo con el texto más corto donde
  antes tenía el largo.
- Mobile: sin device disponible en esta sesión para captura, se revisa
  visualmente en next device check por el usuario (queda igual
  estructuralmente, mismo copy que ya tenía).

## Fuera de alcance

Rediseño de copy (redacción nueva), unificación de layout, rename de archivos,
footer.
