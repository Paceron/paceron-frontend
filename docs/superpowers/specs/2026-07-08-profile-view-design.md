# Visualizar Perfil — Design

**Branch:** `feature/profile-view` (desde `develop`)
**Fecha:** 2026-07-08

## Objetivo
Pantalla read-only de perfil del usuario autenticado, accesible desde el menú de usuario (web dropdown "Ver perfil" — hoy sin cablear — y header del drawer mobile).

## Decisiones
- **Ruta**: `app/(tabs)/profile.jsx` → dentro del shell (topbar web / drawer mobile).
- **Data**: `store.user` (de login/hydrate) + refresh best-effort vía `getUser` al montar. En web CORS bloquea el refresh → se mantiene la data del store sin romper; en mobile refresca.
- **Gating**: guard in-screen. Si `hydrated && !user` → `router.replace('/login')`.
- **Editar**: botón "Editar datos" presente; por ahora dispara toast info "próximamente" (la feature de edición es la siguiente y cableará `/profile/edit`).

## Componentes / archivos
- `services/auth.js`: agregar `getUser({ id, email })` → `GET /auth/user?id=|email=` (con soporte `USE_MOCKS`). Devuelve DTO crudo; el caller normaliza.
- `store/auth-store.js`: acción `refreshUser()` — llama `getUser({ id: user.userId })`, normaliza con `toUserModel`, actualiza `user`. Best-effort (catch → no rompe, conserva user actual).
- `data/locations.js`: helpers `getCountryName(code)`, `getProvinceName(countryCode, provinceId)` para mostrar nombres legibles (el user guarda `country`=ISO, `province`=id, `city`=string).
- `components/profile/profile-screen.jsx`: pantalla responsive (isWeb centra con max-width). Guard + refresh en mount.
- `app/(tabs)/profile.jsx`: renderiza `ProfileScreen`.
- `components/shell/app-web-shell.jsx`: cablear "Ver perfil" → `router.push('/profile')` + cerrar dropdown.
- `components/shell/app-mobile-shell.jsx`: header de usuario del drawer → tappable → `/profile` + cerrar drawer.

## Layout (ProfileScreen)
- **Header**: avatar circular (ícono account) + nombre + apellido; badge de `status` (active=verde, otros=slate/rojo).
- **Cards** (surface tokens, estética de la app), espejando el register:
  - Datos personales: nombre, apellido, email, DNI, fecha de nacimiento.
  - Dirección: país (nombre), provincia (nombre), localidad, calle, altura.
  - Contacto: teléfono, teléfono de contacto.
- Campos ausentes/vacíos → "—".
- Botón "Editar datos" al pie.
- Título de sección con estilo consistente (labels FIELD_LABEL, valores legibles).

## Fuera de alcance
Edición (feature siguiente), baja, rol entrenador. `role` no existe en el backend → no se muestra.

## Verificación
Web preview: setear `user` en el store por eval (o login mock) y renderizar `/profile`; screenshot. Mobile: en red buena, Expo Go.
