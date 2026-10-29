# Selector de calendario para campos de fecha web

## Objetivo

Usar en la web el mismo calendario y formato `DD/MM/AAAA` de Métricas de rendimiento en los campos de fecha que hoy solo permiten tipear una fecha.

## Alcance

- Agregar el botón de calendario a los `DateField` web conservando la escritura manual y el enmascarado actual.
- Reutilizar el calendario de Métricas mediante un componente compartido.
- Reducir el calendario desplegable en web (ancho máximo 320 px y controles diarios de 36 px).
- Conservar límites de fechas, errores, etiquetas y callbacks actuales.

## No alcance

- No cambiar los selectores nativos de Android/iOS.
- No reemplazar calendarios o selectores propios que ya existen en otras pantallas.
- No cambiar el formato almacenado o enviado a servicios: continúa `DD/MM/AAAA` en el formulario.

## Verificación

- Probar escritura manual y selección desde calendario en los campos de fecha web.
- Comprobar que las pantallas sin `DateField` conservan sus calendarios actuales.
- `npm test` y `npm run lint`.
