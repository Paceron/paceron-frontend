# Paceron Frontend

Plataforma digital integral web y mobile para la gestión de equipos de running, diseñada para entrenadores y corredores. Incorpora asistencia basada en inteligencia artificial para mejorar la toma de decisiones y la experiencia de uso.

## Stack tecnologico

| Capa | Tecnologia |
|------|-----------|
| Framework | Expo SDK 54 (managed workflow) + Expo Router |
| UI | React 19, React Native 0.81, React Native Web |
| Estilos | NativeWind 4 + Tailwind CSS 3 (dark mode) |
| Estado local | Zustand 5 |
| Estado remoto | TanStack Query 5 |
| Backend | Go (gin + gorm) — REST API |
| Testing | Jest + React Testing Library |
| CI | GitHub Actions |

## Estructura tentativa del proyecto

```shell
paceron-frontend/
├── .github/workflows/      # Pipelines CI/CD (tests, auto-PR, auto-backport)
├── __tests__/               # Tests unitarios y de integración
├── app/                     # Rutas de Expo Router (wrappers finos)
│   └── (tabs)/              # Grupo de tabs (navegación principal)
├── assets/                  # Imágenes, íconos y fuentes
├── components/              # Componentes organizados por dominio
│   ├── auth/                # Autenticación (login, registro, forgot password)
│   ├── brand/               # Branding y logo (variantes web/mobile)
│   ├── guards/              # Guards de plataforma y permisos
│   ├── home/                # Landing y pantalla principal
│   ├── shell/               # App shells (sidebar web, drawer mobile)
│   ├── training/            # (futuro) Planificación y sesiones de entrenamiento
│   ├── team/                # (futuro) Gestión de equipos y grupos
│   ├── tracking/            # (futuro) Registro y seguimiento de actividades
│   ├── monitoring/          # (futuro) Monitoreo de progreso y métricas
│   └── gamification/        # (futuro) Logros, rachas, desafíos, leaderboards
├── config/                  # Variables de entorno y configuración de la app
├── data/                    # Datos estáticos (ubicaciones, constantes)
├── docs/                    # Documentación del proyecto
├── providers/               # Context providers (theme, query client, etc.)
├── routes/                  # Catálogo de rutas y navegación por rol
├── services/                # Servicios de comunicación con el backend (un archivo por dominio)
├── store/                   # Stores Zustand para estado local/de dominio (un archivo por dominio)
├── theme/                   # Paleta de colores y tokens de diseño
└── utils/                   # Utilidades compartidas (validadores, flags de plataforma)
```

### Convenciones

- **`app/`** contiene solo wrappers finos que importan componentes de `components/`. Toda la lógica y UI vive en `components/`.
- **`components/`** se organiza por dominio funcional. Cada nueva funcionalidad agrega una subcarpeta propia.
- **Variantes por plataforma**: archivos `.web.jsx` para web y `.jsx` (o `.native.jsx`) para mobile cuando la UI difiere entre plataformas.
- **`services/`** define los contratos de cada endpoint del backend. Un archivo por dominio (ej. `auth.js`, `training.js`, `team.js`).
- **`store/`** contiene stores Zustand. Un archivo por dominio (ej. `auth-store.js`, `tracking-store.js`).
- **`__tests__/`** espeja la estructura de lo que testea. Convención: `<nombre>.test.js`.

## Inicio rapido

```bash
# Instalar dependencias
npm install --legacy-peer-deps

# Iniciar en web
npm run web

# Iniciar en mobile (Expo Go o emulador)
npm start

# Correr tests
npm test
```

### Variables de entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8080/api` | URL base del backend REST |

## Multiplataforma

El proyecto soporta web y mobile desde el mismo codebase:

- **Variantes por plataforma**: archivos `.web.jsx` y `.native.jsx` para componentes con diferencias visuales (ej. branding)
- **Funcionalidades mobile-only**: el guard `MobileOnlyRoute` y las flags `hasGPS`/`canScanQR` en `utils/platform.js` permiten habilitar features exclusivas del celular (geolocalización durante entrenamientos, escaneo QR para asistencia)
- **Shells diferenciados**: sidebar con navegación para web, drawer con tabs para mobile

## Manejo de estado

- **Zustand** para estado local, de UI y de dominio (auth, theme, flags de UI, datos GPS)
- **TanStack Query** para estado remoto del servidor (datos de API, cache, revalidación)

Ambas librerias se complementan: Zustand no cachea ni revalida llamadas al servidor, y TanStack Query no maneja estado local como la sesión del usuario o preferencias de tema.

## Backend

El frontend está preparado para comunicarse con un backend Go (gin + gorm) via REST API. Los servicios en `services/` definen los contratos de cada endpoint y se encargan de la comunicación con el backend.

## Branching y CI/CD

El proyecto sigue un modelo de branching estructurado:

| Rama | Proposito |
|------|----------|
| `master` | Producción (protegida) |
| `develop` | Integración (protegida) |
| `feature/*` | Nuevas funcionalidades |
| `release/*` | Preparación de versiones |
| `fix/*` | Correcciones |
| `hotfix/*` | Correcciones en producción |
| `backport/*` | Sincronización master → develop |

### Automatizaciones CI/CD

| Workflow | Trigger | Accion |
|----------|---------|--------|
| `ci.yml` | Push a cualquier rama / PR a `master`, `develop`, `release/**` | Ejecuta tests |
| `auto-pr.yml` | Push a `feature/**`, `fix/**`, `backport/**` | Crea un draft PR hacia `develop` si no existe |
| `auto-backport.yml` | Merge de `hotfix/*` a `master` | Crea rama `backport/*` y PR hacia `develop` |

El paso de `develop` a `master` se realiza manualmente a través de ramas `release/*`.

Ver detalle completo en [`docs/BRANCH_POLICIES.md`](docs/BRANCH_POLICIES.md).

## Documentacion

| Documento | Contenido |
|-----------|----------|
| [`ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Arquitectura general del frontend |
| [`FRONTEND_DEFINITIONS.md`](docs/FRONTEND_DEFINITIONS.md) | Definiciones y convenciones del frontend |
| [`BACKEND_DEFINITIONS.md`](docs/BACKEND_DEFINITIONS.md) | Definiciones del backend esperado |
| [`STYLE_CONTRACT.md`](docs/STYLE_CONTRACT.md) | Contrato de estilos y convenciones UI |
| [`TESTING.md`](docs/TESTING.md) | Estrategia y guias de testing |
| [`EXPO_ROUTER_GUIDE.md`](docs/EXPO_ROUTER_GUIDE.md) | Guia de Expo Router |
| [`BRANCH_POLICIES.md`](docs/BRANCH_POLICIES.md) | Politica de ramas y PRs |
| [`FUNCTIONAL_PROPOSE.md`](docs/FUNCTIONAL_PROPOSE.md) | Propuesta funcional del producto |

## Licencia

Proyecto academico — Universidad Tecnologica Nacional, Facultad Regional Cordoba.
Proyecto Final 5K3 - Grupo 11 - Paceron.
