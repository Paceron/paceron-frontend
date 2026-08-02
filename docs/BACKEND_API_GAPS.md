# Huecos de backend detectados integrando equipos/grupos/invitaciones

Doc de seguimiento interno — refleja únicamente los gaps de backend **actualmente abiertos y accionables**. El historial completo (gaps ya resueltos, y los excluidos temporalmente) vive en el historial de git de este archivo (`git log -p -- docs/BACKEND_API_GAPS.md`).

**Actualización 2026-08-02:** limpieza de la doc por pedido del usuario, para dejarla enfocada en lo que hay que resolver ahora del lado del backend:
- Se sacaron los gaps ya resueltos (eran 7: sin endpoint "mis equipos", `show_groups_to_runners`, listar invitaciones pendientes de un equipo, aceptar/rechazar invitación, `DELETE /teams/{id}` rechazando al dueño, endpoint de invitaciones propias del invitado, `group_id` al invitar) — quedan documentados en el historial de git, no acá.
- Se excluyen **deliberadamente, hasta que el usuario lo indique**, los gaps referidos a foto de equipo y a plan de entrenamiento en el grupo — no son prioridad de backend por ahora (el equipo prioriza otro trabajo). El frontend ya refleja esa decisión: el selector de plan queda en la UI sin opciones (`TRAINING_PLAN_OPTIONS = []` en `store/team-store.js`), y la foto de equipo sigue sin persistir entre sesiones. Cuando el usuario retome alguno de los dos, se vuelve a documentar acá como gap propio.

Queda un único gap abierto y accionable:

## 1. Sin búsqueda de usuarios por nombre/email parcial

- **Qué hace falta:** un endpoint de búsqueda (ej. `GET /users/search?q=`) que devuelva coincidencias parciales por nombre o email.
- **Por qué:** al invitar corredores, sería útil sugerir usuarios ya registrados a medida que se tipea el email (autocompletar). Hoy solo existe `GET /auth/user?id=`/`?email=` — lookup exacto, sin buscar por texto parcial.
- **A qué bloquea:** cualquier UI de autocompletar/sugerir usuarios al invitar — no se puede construir sin este endpoint.
- **Workaround actual:** ninguno — el campo de invitar sigue siendo un input de email libre, sin sugerencias.
- **Estado:** abierto.
