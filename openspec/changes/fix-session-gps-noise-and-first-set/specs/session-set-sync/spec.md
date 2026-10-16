# Spec Delta

## Purpose

Garantizar que lo que el corredor registra en cada serie de una sesión en viva alcance al
backend con los valores que registró —tiempos y distancia— y que cualquier serie que no
haya podido subirse quede explícitamente identificada como pendiente, en lugar de
desaparecer en silencio.

## ADDED Requirements

### Requirement: Toda serie registrada SHALL alcanzar el backend con sus valores

Al finalizar una sesión, cada serie en estado registrado o salteada SHALL haberse enviado
al backend junto con su tiempo de pared, su tiempo activo y su distancia. Si alguna no
puede enviarse, SHALL quedar reintentable y SHALL NOT marcarse como ya sincronizada.

Una serie que se saltó, o que se registró sin señal de GPS, también SHALL llegar al
backend: la ausencia de medición es un dato válido del registro, no una razón para
omitirla.

#### Scenario: Todos los valores de la serie llegan al backend

Dado un corredor que registró una serie con 4 minutos de tiempo de pared, 3 minutos y medio
de tiempo activo y 1200 m de distancia, cuando la sesión se sincroniza, entonces la
evaluación de esa serie en el backend SHALL contener esos tres valores.

#### Scenario: Una serie sin señal de GPS también se sincroniza

Dado un corredor que registró una serie completa pero sin obtener señal de GPS, cuando la
sesión se sincroniza, entonces la serie SHALL llegar al backend con su tiempo y con la
distancia en estado "sin medir", y no SHALL omitirse.

#### Scenario: Una serie que falló queda pendiente

Dado un corredor cuya sesión tiene una serie que no se pudo enviar por un error de red,
cuando se reintenta la sincronización, entonces el sistema SHALL intentar esa serie de
nuevo junto con las demás.

### Requirement: Un conflicto de duplicado SHALL resolverse con los datos actuales

El backend rechaza con conflicto un alta de serie cuando ya existe una fila para la misma
sesión, ejercicio, atleta, propietario y número de serie. Ante ese rechazo, el sistema
SHALL NOT descartar los datos de la serie, y SHALL actualizar la fila existente con los
valores actuales, que son los más recientes.

El sistema SHALL NOT marcar como sincronizada una serie cuyos datos fueron descartados.

#### Scenario: Reintento de una serie ya existente

Dado un corredor cuya serie ya había llegado al backend con valores anteriores, cuando se
sincroniza de nuevo con valores nuevos, entonces la fila existente SHALL quedar con los
valores nuevos y la serie SHALL contar como sincronizada.

#### Scenario: El conflicto no se reporta como éxito

Dado un corredor cuya sincronización resolvió una o más series por conflicto, cuando se
muestra el resultado, entonces el sistema SHALL informar que hubo conflictos resueltos, y
SHALL NOT presentarlo como una sincronización sin incidencias.

### Requirement: Un fallo al registrar la sesión en el backend SHALL NOT impedir el envío de las series

El registro de la sesión en el backend es un paso previo y su propio resultado puede
colisionar con un registro ya existente. Un conflicto en ese paso SHALL NOT impedir que las
series se intenten enviar. Un fallo de ese paso por otra causa SHALL dejar las series
pendientes de reintento, sin marcarlas como sincronizadas.

#### Scenario: La sesión ya estaba registrada

Dado un corredor cuya sesión en vivo ya tiene un registro en el backend, cuando se
sincroniza, entonces las series SHALL enviarse igualmente.

#### Scenario: La sesión no se pudo registrar

Dado un corredor cuya sesión en vivo no se pudo registrar en el backend por un error de
red, cuando se reintenta la sincronización más tarde, entonces las series SHALL enviarse
en ese reintento.

### Requirement: El fallo de una serie SHALL NOT impedir el envío de las demás

Si el envío de una serie falla, el sistema SHALL NOT abortar el envío de las series
restantes de la misma pasada de sincronización.

#### Scenario: Una serie falla y las otras suben

Dado un corredor que registró tres series y una de ellas es inválida para el backend,
cuando se sincroniza, entonces las otras dos SHALL llegar al backend y la inválida SHALL
quedar pendiente con su motivo.

### Requirement: El resultado de la sincronización SHALL distinguir qué se subió y qué no

Al terminar la sincronización, el sistema SHALL informar por separado cuántas series se
subieron, cuántas se resolvieron por conflicto, cuántas quedaron pendientes y con qué
error. Un resultado con conflictos o con pendientes SHALL NOT presentarse como
sincronización exitosa.

#### Scenario: Sincronización completa

Dado un corredor cuyas N series se enviaron sin conflicto, cuando termina la
sincronización, entonces el sistema SHALL informar N series sincronizadas y ninguna
pendiente.

#### Scenario: Sincronización con pendientes

Dado un corredor cuya sincronización dejó al menos una serie pendiente, cuando termina,
entonces el sistema SHALL informar que la sincronización quedó incompleta, cuántas series
quedaron guardadas en el dispositivo y cuántas faltan, y SHALL NOT informar éxito.

#### Scenario: El resultado no depende de una corrida todavía no disponible

Dado un corredor que termina la sesión y el registro local de la sesión todavía no está
disponible, cuando se intenta la sincronización, entonces el sistema SHALL NOT informar una
sincronización exitosa con cero series subidas.
