# Testing en el scaffold de Paceron

Este documento resume lo que se decidió y configuró para el stack de testing del template Expo cross-platform, con foco en mantener el setup simple, estable y útil para un proyecto que todavía no implementa lógica de negocio real.

## Objetivo del setup

El valor principal de este scaffold no es tener muchos tests, sino dejar definida una base confiable para validar que el entorno de Expo, React Native y Expo Router pueda testearse sin introducir complejidad innecesaria.

La estrategia elegida es:

- usar un runner compatible con Expo;
- mantener la configuración mínima;
- agregar un smoke test muy estable;
- evitar dependencias deprecated o sobreconfiguración;
- dejar preparado el camino para tests de stores, servicios y componentes cuando el proyecto empiece a crecer.

## Librerías seleccionadas

El stack que quedó activo en el proyecto es el siguiente:

- `jest`: runner de pruebas.
- `jest-expo`: preset oficial para integrar Jest con Expo.
- `@testing-library/react-native`: utilidades de testing para componentes React Native.
- `babel-jest`: transformador para que Jest entienda el código del proyecto.
- `babel-preset-expo`: preset de Babel ya alineado con Expo y NativeWind.
- `react-native-worklets`: dependencia requerida por el preset de Expo en este entorno.
- `node-fetch`: dependencia auxiliar que puede mantenerse por compatibilidad, aunque a futuro podría no ser necesaria.

### Lo que no se incluye

- `@testing-library/jest-native` no se usa, porque está deprecada y agrega fricción innecesaria.
- No se agregó `setupFilesAfterEnv` para `jest-native`.
- No se incorporó un stack de E2E todavía.

## Configuración que conlleva

### Scripts agregados

En [package.json](package.json) se agregaron estos scripts:

- `npm test` para ejecutar Jest una vez.
- `npm run test:watch` para modo observación.
- `npm run test:coverage` para cobertura.

### Configuración de Jest

La configuración activa está en [jest.config.js](jest.config.js).

Contenido actual:

```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo(nent)?|expo-modules-core|@expo|expo-router|nativewind|react-native-worklets)/)',
  ],
};
```

#### Por qué esta configuración

- `preset: 'jest-expo'` resuelve la integración con Expo Router, React Native y el ecosistema Expo.
- `transformIgnorePatterns` debe permitir transpilar algunos paquetes Expo y React Native que llegan en sintaxis no consumible por Jest sin transformación.
- `expo-modules-core` y `react-native-worklets` fueron necesarios para evitar errores del preset en este entorno.

### Babel

La base de Babel ya estaba lista en [babel.config.js](babel.config.js) con:

- `babel-preset-expo`
- `nativewind/babel`

Eso es suficiente para que los tests puedan transformarse sin agregar un pipeline adicional.

## Dónde irían los tests

El template puede organizar los tests de forma simple y predecible.

### Opción recomendada para este repo

- `__tests__/` en la raíz para smoke tests y validaciones generales del scaffold.
- `store/__tests__/` para stores de Zustand.
- `services/__tests__/` para clientes HTTP, helpers de API y lógica de integración liviana.
- `components/__tests__/` para componentes de UI aislados.
- `app/__tests__/` si en algún momento conviene testear rutas o layouts directamente.

### Alternativa válida

También se pueden usar tests colocados junto al archivo fuente, por ejemplo `routes/catalog.test.js` o `module-detail-screen.test.jsx`. Para un scaffold como este, la carpeta `__tests__` separada suele ser más clara.

## Qué se puede probar con el stack actual

Con el setup actual se puede cubrir bien lo siguiente:

- funciones puras y helpers;
- catálogos estáticos de rutas y navegación;
- stores de Zustand;
- lógica de servicios y clientes HTTP;
- componentes React Native aislados;
- render básico de pantallas;
- comportamiento condicional simple;
- contratos de UI que no dependan de APIs nativas reales.

### Ejemplo de valor inmediato

El primer smoke test agregado valida que el catálogo de rutas de [routes/catalog.js](routes/catalog.js) esté coherente.

Ese tipo de prueba sirve para detectar regresiones simples sin depender de datos remotos, permisos del dispositivo ni mocks complejos.

## Qué no conviene prometer con este stack

Este setup no está pensado para resolver todo el problema de testing del producto final.

### Limitaciones actuales

- No reemplaza pruebas end-to-end.
- No valida flujos reales en dispositivos.
- No prueba sensores, GPS, cámara, QR ni hardware nativo sin mocks adicionales.
- No cubre bien interacciones browser-specific de manera completa.
- No reemplaza pruebas visuales ni de performance.
- No debe usarse como sustituto de una estrategia de integración real con backend.

### Qué requeriría ampliación futura

- Para web con DOM real: `@testing-library/react` y, más adelante, Playwright.
- Para mobile end-to-end: Detox o una alternativa equivalente.
- Para validaciones visuales: una herramienta de snapshot visual o screenshot testing.

## Qué utilidad práctica aporta ahora

Aunque este proyecto sea solo un template, el stack elegido sí tiene valor:

- confirma que Expo, Babel y Jest conviven sin romperse;
- fija una convención para el crecimiento futuro;
- deja un lugar natural para tests de stores, servicios y componentes;
- ayuda a detectar problemas de dependencias temprano;
- hace visible qué piezas del scaffold son realmente testeables.

## Estado observado durante la configuración

Durante la puesta en marcha aparecieron incompatibilidades del ecosistema que justifican mantener el setup minimalista:

- `@testing-library/jest-native` se descartó por deprecated y por fricción con las versiones actuales.
- `jest-expo` requirió alinear la versión de `jest` y `babel-jest` para evitar errores de runtime.
- Fue necesario permitir la transformación de ciertos paquetes Expo en `transformIgnorePatterns`.

También se instaló `react-native-worklets` porque el preset de Expo lo requería al correr Jest en este entorno.

## Smoke test actual

El test agregado vive en [__tests__/routes.catalog.test.js](__tests__/routes.catalog.test.js).

Ese test verifica tres cosas simples:

- que la navegación incluya la ruta inicial;
- que un slug conocido se resuelva correctamente;
- que un slug inválido devuelva `null`.

Es un buen ejemplo del tipo de prueba que conviene en un scaffold: estable, rápida y con poco mantenimiento.

## Comandos útiles

```bash
npm test
npm run test:watch
npm run test:coverage
```

## CI/CD básico

El repositorio ya tiene un workflow mínimo en [.github/workflows/ci.yml](../.github/workflows/ci.yml) pensado para validar el template sin interferir con el desarrollo diario.

### Qué hace

- corre en `pull_request`;
- corre en `push` para ramas principales y ramas de soporte;
- también permite ejecución manual con `workflow_dispatch`;
- instala dependencias con `npm ci --legacy-peer-deps`;
- ejecuta `npm test -- --runInBand`.

### Por qué es una base segura

- no exige cambios en la configuración del repo en GitHub para empezar a funcionar;
- no bloquea `main` por sí mismo;
- no modifica el comportamiento de la app;
- usa el mismo setup de testing que ya quedó validado localmente.

### Relación con la política de ramas

El workflow ya contempla ramas como `feature/**`, `release/**`, `fix/**`, `hotfix/**` y `backport/**`, de forma compatible con la política de ramas descrita en [BRANCH_POLICIES.md](./BRANCH_POLICIES.md).

La política de branching puede evolucionar con el proyecto, pero el CI queda listo para acompañar ese esquema sin rehacer la base.

## Recomendación final

Para este proyecto conviene sostener un stack simple y moderno:

- Jest como runner;
- `jest-expo` como preset;
- `@testing-library/react-native` para UI RN;
- tests de lógica y catálogo como primer objetivo;
- E2E y testing web específico solo cuando el producto lo justifique.

En un template como este, la prioridad no es tener una batería grande de pruebas, sino una base correcta, estable y fácil de extender.
