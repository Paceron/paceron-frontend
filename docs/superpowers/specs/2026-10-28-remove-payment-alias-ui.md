# Eliminar el alias de pagos de la experiencia de perfil

## Objetivo

Dejar de mostrar, pedir o enviar el alias de pagos desde la interfaz del frontend. La activación del perfil de entrenador conserva la contraseña y la conexión con Mercado Pago; el backend acepta ahora una activación sin alias.

## Alcance

- Quitar el alias de la sección “Datos de entrenador” del perfil.
- Quitar el campo y la validación del formulario `/profile/edit`.
- Quitar el campo/validación de la pantalla de activación de entrenador y enviar solo la contraseña al endpoint.
- Evitar que los payloads de edición de perfil o de ajustes envíen `bank_alias`; al omitirlo, el backend conserva datos heredados sin requerirlos.
- Actualizar mocks, textos y pruebas afectados.

## No alcance

- Eliminar `users.bank_alias` ni modificar la respuesta histórica del backend.
- Cambiar los requisitos de contraseña o conexión con Mercado Pago.

## Comportamiento esperado

- Editar el perfil sin tocar un alias ya no bloquea el guardado.
- Una solicitud de activación de entrenador puede llevar solo `password`.
- La sección de entrenador muestra únicamente el estado/conexión de Mercado Pago, no el alias.

## Verificación

- `npm test -- --runInBand`
- `npm run lint`
- Verificación manual de perfil, editar perfil y activar entrenador en preview web y en dispositivo.
