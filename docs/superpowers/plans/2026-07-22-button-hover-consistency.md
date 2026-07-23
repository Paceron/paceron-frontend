# Consistencia de botones: fondo + hover mínimo — Plan

Spec: `docs/superpowers/specs/2026-07-22-button-hover-consistency-design.md`

Implementación mecánica siguiendo las 4 reglas de la spec. Se agrupa en
commits chicos por área para no mezclar todo en un solo diff gigante.

## Task 1: Landing / home

- `components/home/home-landing-screen.jsx`: botón "Ingresar" — `border` → `bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700` (saca el border). CTA "Registrate" → suma `hover:opacity-90`.
- `components/home/home-mobile-screen.jsx`: mismo cambio en ambos botones (mismo patrón que web, ya que comparten `landing-content.js`).

```
git commit -m "feat(ui): give login button a background, add CTA hover on landing"
```

## Task 2: Auth screens

- `components/auth/login-screen.jsx`: submit button → `hover:opacity-90`; "¿Olvidaste tu contraseña?" y "¿No tenés cuenta? Registrate" → `hover:opacity-70`.
- `components/auth/register-screen.jsx`: submit button → `hover:opacity-90`; "¿Ya tenés cuenta?" → `hover:opacity-70`.
- `components/auth/forgot-password-form.jsx`: submit button → `hover:opacity-90`; "Volver al inicio de sesión" → `hover:opacity-70`.

```
git commit -m "feat(ui): add hover feedback to auth screens buttons and links"
```

## Task 3: Profile screens

- `components/profile/profile-screen.jsx`: "Borrar cuenta" (outline) → `hover:bg-red-50 dark:hover:bg-red-900/20`.
- `components/profile/edit-profile-screen.jsx`: "Guardar cambios" → `hover:opacity-90`; breadcrumb "Mi perfil" → `hover:bg-slate-100 dark:hover:bg-slate-800` (o `hover:opacity-70` si no tiene padding para bg — ver caso a caso).
- `components/profile/activate-trainer-screen.jsx`: "Activar" → `hover:opacity-90`; breadcrumb → igual que arriba.
- `components/profile/tier-upgrade-screen.jsx`: breadcrumb → igual que arriba.
- `components/profile/deactivate-account-modal.jsx`: "Cancelar" (outline) → `hover:bg-slate-100 dark:hover:bg-slate-800`; "Confirmar baja" → `hover:opacity-90`.
- `components/profile/role-switch-toggle.jsx`: "Volverse Entrenador" → `hover:opacity-90`; "Mejorar tier" → `hover:opacity-70`.

```
git commit -m "feat(ui): add hover feedback to profile screens buttons and links"
```

## Task 4: Shell / navegación mobile

- `components/shell/app-mobile-shell.jsx`: menu toggle (hamburguesa) → `hover:bg-slate-100 dark:hover:bg-slate-800`; todos los items del drawer (perfil, ingresar, equipos expander, team items, crear equipo, rutas, logout) → mismo `hover:bg-slate-100 dark:hover:bg-slate-800` (logout usa la variante roja `hover:bg-red-50 dark:hover:bg-red-900/20`, igual que su par web).
- `components/theme/theme-toggle.jsx`: agregar `hover:opacity-90` al Pressable contenedor.

```
git commit -m "feat(ui): add hover feedback to mobile drawer items"
```

## Task 5: Forms compartidos

- `components/forms/fields.jsx`: todos los botones icon-only (clear de SelectField, date picker opener, password toggle de InputField, clear/opener de PickerField) → `hover:bg-slate-100 dark:hover:bg-slate-800`; botón "Listo" del date picker (iOS modal) → `hover:opacity-90`; items del picker dropdown → ya deberían tener algo, verificar y sumar `hover:bg-slate-100 dark:hover:bg-slate-800` si falta.
- `components/forms/section-card.jsx`: header colapsable → `hover:bg-slate-100 dark:hover:bg-slate-800` (o `hover:opacity-80` si ya tiene fondo propio — verificar).

```
git commit -m "feat(ui): add hover feedback to shared form field buttons"
```

## Task 6: Resto

- `app/+not-found.jsx`: botón "Volver al inicio" → `hover:opacity-90`.

```
git commit -m "feat(ui): add hover feedback to not-found screen button"
```

## Verification

- `npm test` → 33/33 después de cada task (cambios de className puro, no debería romper nada).
- Verificación visual: dado que `hover:` solo es observable en web con mouse, y varios de estos archivos SÍ renderizan en preview web (a diferencia de los mobile-only vistos hoy) — vale la pena que el agente pase por preview con `preview_inspect`/hover simulado en al menos los cambios de Task 1 (Ingresar) y Task 2 (auth), que son los que el usuario puede notar más. El resto (drawer mobile, Task 4) no es verificable por preview por el mismo motivo ya conocido (`AppMobileShell` solo en nativo) — queda para que el usuario confirme en emulador si le interesa, aunque el cambio es tan mecánico (agregar una clase `hover:`) que el riesgo es bajo.
