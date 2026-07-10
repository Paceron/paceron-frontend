# Guía práctica del workflow de Git

Guía paso a paso del flujo que seguimos en este repo. Complementa
[BRANCH_POLICIES.md](BRANCH_POLICIES.md) (la política formal) con los comandos
y detalles concretos del día a día.

## Modelo de ramas

```
master   ← producción, estable. Solo recibe merges desde release/ (vía PR).
develop  ← integración. Recibe feature/, fix/, backport/ (vía PR).
feature/<nombre>   ← nuevas funcionalidades. Origen y destino: develop.
fix/<id>           ← correcciones puntuales. → develop (o release/).
release/<versión>  ← preparación de versión. Origen develop, destino master.
hotfix/<id>        ← urgencias en producción. Origen y destino: master.
backport/<versión> ← sincroniza master → develop tras un release.
```

Nombres en **kebab-case** (ej. `feature/profile-edit`, no `feature/profileEdit`).

## Reglas del repo (importante)

- **`develop` y `master` están protegidas**: NO aceptan `git push` directo.
  Todo entra por **Pull Request**.
- Cada PR debe pasar el check de CI **`Test paceron-frontend`** en verde
  (definido en `.github/workflows/ci.yml`). El merge lo hace una persona en la
  UI de GitHub.
- El workflow **`.github/workflows/auto-pr.yml`** crea un PR **draft**
  automáticamente en el primer push a una rama `feature/**`, `fix/**` o
  `backport/**` (apuntando a develop). Para `release/**` NO hay auto-PR: el PR a
  master se crea a mano.

## Ciclo de una feature (paso a paso)

### 1. Partir de develop actualizado

```bash
git checkout develop
git fetch origin
git merge --ff-only origin/develop   # dejar develop local == remoto
```

### 2. Crear la rama

```bash
git checkout -b feature/mi-cambio
```

### 3. Trabajar y commitear

Commits atómicos, mensajes en formato Conventional Commits
(`feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `chore:`).

```bash
git add <archivos>
git commit -m "feat(scope): descripción corta"
```

### 4. Push (y dejar que se cree el PR)

```bash
git push -u origin feature/mi-cambio
```

`auto-pr.yml` crea un **PR draft** a develop con un template a completar.

> No crear el PR a mano con `gh pr create` justo después del push: colisiona
> (race) con `auto-pr.yml` y el check "Create draft PR if not exists" queda en
> rojo (fallo benigno, ignorable).

### 5. Actualizar el PR con la descripción de los cambios

Antes de pedir review, editá el PR draft en GitHub y reemplazá el template por
una descripción real. No dejar el texto autogenerado. Incluir:

- **Título**: `[tipo] scope: descripción corta` (ej. `feat(profile): editar datos`).
- **Qué hace y por qué**: el objetivo del cambio y su motivación.
- **Cómo probarlo**: pasos concretos para verificarlo (rutas, datos de prueba,
  `EXPO_PUBLIC_USE_MOCKS=true` si aplica).
- **Screenshots/GIFs**: obligatorio si hay UI o cambios visuales.
- **Checklist**: tests locales en verde, sin `console.log` de debug, diff propio
  revisado.
- **Tickets**: `Closes #NN` / `Relates to ...` si corresponde.

Cuando la descripción está completa, marcá el PR **Ready for review** (sale del
estado draft). Cada push nuevo a la rama actualiza el PR; si subís cambios tras
feedback, dejá un comentario ("Push #2: corregí X").

### 6. CI + review + merge

- Esperar el check `Test paceron-frontend` en verde.
- Revisar el diff, iterar si hace falta (push a la misma rama actualiza el PR).
- **Merge** en GitHub (Squash and merge recomendado).

### 7. Limpiar la rama y sincronizar

Tras mergear:

```bash
git checkout develop
git fetch origin
git merge --ff-only origin/develop     # traer el merge del PR
git branch -d feature/mi-cambio        # borrar rama local
git push origin --delete feature/mi-cambio   # borrar rama remota (si no se borró sola)
```

GitHub suele ofrecer borrar la rama remota al mergear; si ya la borró, el último
comando avisa que no existe (sin problema).

## Ciclo de release (develop → master)

Cuando develop tiene un avance estable que se quiere llevar a producción:

### 1. Cortar la rama de release desde develop

```bash
git checkout develop
git fetch origin
git merge --ff-only origin/develop
git checkout -b release/0.1.0
```

### 2. (Opcional) Bump de versión / changelog

Actualizar `version` en `package.json`, notas de cambios, etc. Commitear.

### 3. Push y PR a master (manual, no hay auto-PR para release/)

```bash
git push -u origin release/0.1.0
gh pr create --base master --head release/0.1.0 \
  --title "release: 0.1.0" --body "Notas del release"
```

### 4. CI verde → merge a master en GitHub

### 5. Backport a develop (si hubo fixes en la release)

Si durante la release se corrigieron cosas sobre `release/` que develop no tiene:

```bash
git checkout master && git pull
git checkout -b backport/0.1.0
git push -u origin backport/0.1.0   # auto-pr crea el PR a develop
```

Si no hubo cambios extra en la release (develop == lo que fue a master), el
backport no es necesario.

## Correcciones y urgencias

- **fix/**: bug encontrado en develop o en una release. Mismo ciclo que feature,
  destino develop (o la `release/` correspondiente).
- **hotfix/**: bug en producción. Se corta desde `master`, se corrige, PR a
  `master`, y luego backport a develop.

## Referencia rápida

| Acción | Comando |
| --- | --- |
| Actualizar develop local | `git checkout develop && git fetch && git merge --ff-only origin/develop` |
| Nueva feature | `git checkout -b feature/<nombre>` |
| Publicar y abrir PR | `git push -u origin feature/<nombre>` (el PR draft lo crea auto-pr) |
| Borrar rama local | `git branch -d feature/<nombre>` |
| Borrar rama remota | `git push origin --delete feature/<nombre>` |
| PR de release a master | `gh pr create --base master --head release/<versión>` |

## Despliegues

### Web (Vercel)

Cuenta `paceron` (Hobby/free), un solo proyecto (`paceron-frontend`), dos
dominios `.vercel.app` gratuitos pinneados cada uno a una rama:

| Rama | URL |
| --- | --- |
| `master` (producción) | https://paceron-frontend.vercel.app/ |
| `develop` (preview) | https://paceron-frontend-git-develop-paceron.vercel.app/ |

- Config en [`vercel.json`](../vercel.json): build command (`npx expo export -p
  web`), `cleanUrls`, `rewrites` (404 branded), y `git.deploymentEnabled` que
  **limita el deploy automático a `master` y `develop`** — cualquier otra rama
  (`feature/**`, `fix/**`, etc.) no dispara build en Vercel.
- Deploy es automático: cada push a `master`/`develop` (o sea, cada merge de
  PR) buildea y publica solo. No hace falta correr nada a mano.
- No hay dominio propio comprado (`paceron.com`) — se evaluará más adelante si
  hace falta.

### Mobile (EAS — Android only)

Cuenta EAS **separada** de la personal: `paceronapp` / `paceron.app@gmail.com`
(login con `npx eas-cli login`). Proyecto: `@paceronapp/paceron-frontend`.

Dos variantes de la app, diferenciadas en [`app.config.js`](../app.config.js)
(dinámico) vía la env var `APP_VARIANT` que setea cada profile de
[`eas.json`](../eas.json):

| Variante | Nombre | `android.package` | Ícono | Canal de Update |
| --- | --- | --- | --- | --- |
| `production` | Paceron | `com.paceron.app` | blanco | `production` |
| `preview` (dev) | Paceron Dev | `com.paceron.app.dev` | ámbar + anillo | `develop` |

Ambas quedan **fuera de Play Store**: `distribution: internal` genera un APK
descargable por link/QR directo. Nunca se usa `eas submit`.

**Build vs Update** (no confundir):
- **Build** = binario nativo instalable. Solo hace falta rehacerlo cuando
  cambia algo nativo (módulo nativo, ícono, permisos, upgrade de SDK).
  `runtimeVersion` usa policy `fingerprint`: hashea automáticamente lo nativo
  para detectar cuándo un build viejo ya no es compatible.
- **Update** = publica JS/UI nuevo a un build ya instalado, sin reinstalar y
  sin pasar por ninguna store. Es el 99% de los cambios de este proyecto.

```bash
# Build manual (poco frecuente — solo si cambió algo nativo)
npm run eas:build:preview       # variante dev
npm run eas:build:production    # variante prod

# Publicar update (lo habitual, tras mergear a develop/master)
npm run eas:deploy:develop      # corre .eas/workflows/deploy-develop.yml
npm run eas:deploy:production   # corre .eas/workflows/deploy-production.yml
```

Los workflows (`.eas/workflows/deploy-*.yml`) ya tienen la lógica de
`fingerprint → get-build → build (solo si hace falta) → update`, pero **no se
disparan solos por push a propósito**: el free tier de EAS usa una cola
compartida de baja prioridad que puede tardar minutos a más de una hora en
horas pico (aplica incluso a jobs livianos como `fingerprint`, no solo al
build pesado). Se corren a mano, cuando se decide publicar — así la espera de
cola no bloquea el flujo de desarrollo. Si esto se vuelve un cuello de botella
real, evaluar plan pago de EAS (cola de prioridad).

## Errores comunes

- **Push a develop/master rechazado** (`Changes must be made through a pull
  request`): es lo esperado. Crear una rama y PR.
- **`git branch -d` falla** ("not fully merged"): la rama tiene commits no
  mergeados. Verificar que el PR se mergeó; si estás seguro, `-D` fuerza el
  borrado (cuidado).
- **Check "Create draft PR if not exists" en rojo**: race entre un `gh pr
  create` manual y `auto-pr.yml`. Ignorable. Para evitarlo, no crear el PR a
  mano tras el push (dejar que lo cree el workflow).
