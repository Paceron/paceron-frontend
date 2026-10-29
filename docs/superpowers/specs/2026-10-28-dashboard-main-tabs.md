# Separar métricas y comparación en pestañas principales

## Objetivo

Reducir el largo de la pantalla de Rendimiento y dar acceso directo a la comparación sin apilarla debajo de gráficos y rankings.

## Alcance

- Debajo del título “Rendimiento”, agregar dos pestañas principales: “Métricas deportivas” y “Comparación”.
- “Métricas deportivas” conserva filtros, estados, gráficos, indicadores, perfil/radar y ranking actuales.
- “Comparación” contiene la sección completa actual, incluyendo comparación de sesiones A/B y el submodo de períodos cuando el rol lo permite.
- Mantener permisos, filtros, estado de borradores y consultas existentes; montar la sección de comparación solo al seleccionarla.
- Al cambiar de equipo o rol, volver a “Métricas deportivas”.

## No alcance

- No cambiar el contrato de API ni los criterios de comparación.
- No modificar el panel de filtros de métricas ni el panel de calidad.

## Verificación

- Comprobar que las dos pestañas aparecen debajo del título.
- Confirmar que cada pestaña muestra solo su contenido y que la comparación conserva sus subpestañas.
- `npm test` y `npm run lint`; revisar el cambio en web.
