# Spec Delta

## Purpose

Permite que el entrenador de un equipo consulte y gestione la asistencia de las
sesiones presenciales de sus grupos, desde la web o la app, marcando y
desmarcando corredores en una sola operación y compartiendo el QR de la sesión
como PDF.

## ADDED Requirements

### Requirement: El sistema SHALL exponer la gestión de asistencia solo a entrenadores

El sistema SHALL exponer la pantalla de gestión de asistencia en la ruta
`/attendance`, y SHALL incluirla en la navegación **únicamente** cuando el rol
activo sea el de entrenador. Un corredor con esa misma URL activa SHALL ver un
aviso de que la pantalla es solo para entrenadores, en lugar de una lista vacía
sin explicación.

La pantalla SHALL aceptar los query params opcionales `team_id` y
`session_instance_id`. Cuando ambos vienen y son válidos, la pantalla SHALL
arrancar con la sesión ya seleccionada y SHALL validar la selección en contra
contra el backend. Cuando no vienen, SHALL arrancar sin sesión seleccionada y
con el flujo de selección completo visible.

La pantalla SHALL ser alcanzable y funcional en cualquier ancho de viewport, tanto
en web como en la app nativa, sin una versión distinta por plataforma.

#### Scenario: El entrenador entra desde la navegación
- **GIVEN** el usuario activo con rol de entrenador
- **WHEN** abre la sección de navegación
- **THEN** la entrada "Asistencia" está visible y navega a `/attendance`

#### Scenario: El corredor no ve la entrada de navegación
- **GIVEN** el usuario activo con rol de corredor
- **WHEN** abre la sección de navegación
- **THEN** la entrada "Asistencia" no aparece entre las rutas disponibles

#### Scenario: Deep link con equipo y sesión ya seleccionados
- **WHEN** el entrenador abre `/attendance?team_id=5&session_instance_id=42` y la sesión 42 es una sesión presencial ocurrida del equipo 5
- **THEN** la pantalla muestra directamente la grilla de la sesión 42, con el nombre del equipo y de la sesión en el encabezado

#### Scenario: Deep link con una sesión que no existe
- **WHEN** el entrenador abre `/attendance?team_id=5&session_instance_id=99999`
- **THEN** la pantalla muestra un mensaje de que la sesión indicada no existe y deja el selector de sesión disponible para elegir otra

#### Scenario: Deep link con una sesión que no es del equipo
- **WHEN** el entrenador abre `/attendance?team_id=5&session_instance_id=42` y la sesión 42 pertenece a un equipo del que no es entrenador
- **THEN** la pantalla muestra un mensaje de que no tiene permisos sobre esa sesión, sin revelar información de la sesión

### Requirement: El sistema SHALL permitir elegir equipo, grupo y sesión con un selector que se puede filtrar escribiendo

La pantalla SHALL presentar tres selectores encadenados —equipo, grupo y sesión—
en ese orden, donde cada uno SHALL habilitarse recién cuando el anterior tenga
selección.

Los tres SHALL permitir **escribir texto para filtrar** la lista de opciones por
nombre, y SHALL mostrar solo las que coincidan con el texto escrito, ignorando
mayúsculas y acentos. Con el filtro vacío se SHALL ver la lista completa.

El selector de grupo SHALL preseleccionar automáticamente el **primer grupo** del
equipo elegido en el momento en que se elige el equipo, sin esperar a que el
entrenador toque el selector.

Cambiar el equipo SHALL limpiar la selección de grupo y de sesión. Cambiar el
grupo SHALL limpiar la selección de sesión. En ambos casos se SHALL volver a
preseleccionar el grupo cuando corresponda y la grilla SHALL quedar en estado
vacío hasta que haya una sesión seleccionada.

Si un equipo no tiene grupos, o un grupo no tiene sesiones presenciales
ocurridas, el selector correspondiente SHALL quedar deshabilitado y SHALL
explicar por qué está vacío.

#### Scenario: Filtrar escribiendo el nombre del equipo
- **WHEN** el entrenador escribe "sur" en el selector de equipo y hay equipos "Club Sur", "Club Norte" y "River Plate"
- **THEN** el selector ofrece solo "Club Sur"

#### Scenario: El filtro ignora mayúsculas y acentos
- **WHEN** el entrenador escribe "sur" y el único equipo que coincide se llama "Club Súr"
- **THEN** el selector lo ofrece igualmente

#### Scenario: El grupo se preselecciona al elegir el equipo
- **WHEN** el entrenador elige el equipo "Club Sur", que tiene los grupos "Grupo A" y "Grupo B"
- **THEN** el selector de grupo queda en "Grupo A" sin que el entrenador lo toque, y el selector de sesión se habilita

#### Scenario: Cambiar de equipo limpia las selecciones dependientes
- **GIVEN** el entrenador tiene un equipo, un grupo y una sesión seleccionados
- **WHEN** elige otro equipo
- **THEN** el grupo queda en el primero del nuevo equipo, la sesión queda sin seleccionar y la grilla en estado vacío

#### Scenario: Grupo sin sesiones presenciales
- **WHEN** el entrenador elige un grupo cuyos días no tienen ninguna sesión presencial ocurrida
- **THEN** el selector de sesión queda deshabilitado con un mensaje indicando que no hay sesiones presenciales para registrar asistencia

### Requirement: El sistema SHALL listar únicamente sesiones presenciales ya ocurridas

El selector de sesión SHALL ofrecer únicamente las sesiones que fueron
presenciales y cuya fecha es hoy o anterior. Cada opción SHALL mostrar el nombre
de la sesión, su fecha, y —cuando exista al menos una— la cantidad de asistentes
registrada hasta el momento.

La lista SHALL venir del backend en una sola consulta por grupo, ordenadas de la
fecha más reciente a la más antigua, y no SHALL construirse filtrando en el
cliente un rango de calendario.

#### Scenario: Solo aparecen las presenciales ocurridas
- **GIVEN** un grupo tiene tres sesiones presenciales ocurridas, una sesión presencial futura y dos sesiones asincrónicas pasadas
- **WHEN** el entrenador abre el selector de sesión
- **THEN** aparecen exactamente las tres presenciales ocurridas, de la más reciente a la más antigua

#### Scenario: La sesión de hoy está disponible
- **GIVEN** el grupo tiene una sesión presencial con la fecha de hoy que aún no terminó
- **WHEN** el entrenador abre el selector de sesión
- **THEN** esa sesión aparece en la lista y puede seleccionarse

#### Scenario: La cantidad de asistentes acompaña a cada opción
- **GIVEN** una de las sesiones listadas tiene 3 asistencias registradas
- **WHEN** el entrenador abre el selector de sesión
- **THEN** esa opción muestra "3" junto a su fecha

### Requirement: El sistema SHALL mostrar el resumen de asistencia de la sesión seleccionada

Cuando haya una sesión seleccionada, la pantalla SHALL mostrar, encima de la
grilla, tres tarjetas de métricas calculadas sobre el roster del grupo y las
asistencias de esa sesión: **cantidad de asistentes**, **cantidad de corredores
que no confirmaron asistencia**, y **porcentaje de asistencias confirmadas**.

El porcentaje SHALL ser el cociente entre asistentes y corredores del grupo,
expresado entre 0 y 100 con un decimal. Cuando el grupo no tenga corredores, el
porcentaje SHALL mostrarse como 0 y no SHALL producir un error.

Las tres tarjetas SHALL recalcularse en el momento en que se registre o se borre
una asistencia, sin que el entrenador tenga que recargar la pantalla.

#### Scenario: Resumen de una sesión con 2 de 4 asistentes
- **GIVEN** el grupo tiene 4 corredores y la sesión tiene 2 asistencias
- **WHEN** la pantalla muestra la grilla
- **THEN** las tarjetas muestran 2 asistentes, 2 sin confirmar y 50.0 % de asistencias confirmadas

#### Scenario: El resumen se actualiza al guardar
- **GIVEN** el resumen mostraba 2 asistentes, 2 sin confirmar y 50.0 %
- **WHEN** el entrenador marca 2 corredores más y guarda los cambios
- **THEN** las tarjetas pasan a 4 asistentes, 0 sin confirmar y 100.0 %

#### Scenario: El resumen se actualiza al borrar
- **GIVEN** el resumen mostraba 4 asistentes y 0 sin confirmar
- **WHEN** el entrenador borra una asistencia y confirma
- **THEN** las tarjetas pasan a 3 asistentes, 1 sin confirmar y 75.0 %

#### Scenario: Grupo vacío
- **GIVEN** el grupo no tiene corredores
- **WHEN** la pantalla muestra la grilla
- **THEN** las tarjetas muestran 0, 0 y 0.0 %, y la grilla muestra un estado vacío explicando que el grupo no tiene corredores

### Requirement: El sistema SHALL mostrar una fila por corredor con su estado de asistencia

La grilla SHALL mostrar una fila por cada corredor del grupo, ordenada alfabéticamente por nombre, con el nombre del corredor, su email, y su estado de asistencia a la
sesión: **asistió** o **no confirmó**.

Una fila con asistencia SHALL distinguir cómo se registró: si fue por el código
QR de la sesión o cargada manualmente por el entrenador.

Cada fila SHALL incluir un control de selección —un check— que, al marcarse,
indica que esa fila fue editada en esta sesión de trabajo. Las filas sin cambios
no SHALL verse marcadas.

El sistema SHALL obtener la grilla, los nombres de los corredores y los totales en
**una sola consulta** al backend, y SHALL discharging una consulta por corredor.

#### Scenario: Grilla completa del grupo
- **GIVEN** el grupo tiene 4 corredores, 2 con asistencia
- **WHEN** la pantalla carga la grilla
- **THEN** muestra 4 filas, 2 con el estado "asistió" y 2 con "no confirmó", ordenadas por nombre

#### Scenario: La procedencia de la asistencia se muestra
- **GIVEN** una asistencia fue registrada por QR y otra fue cargada por el entrenador
- **WHEN** la pantalla muestra la grilla
- **THEN** la primera fila indica que llegó por QR y la segunda que la cargó el entrenador

#### Scenario: El check marca las filas editadas
- **WHEN** el entrenador marca el check de una fila
- **THEN** esa fila queda visualmente marcada como editada y su check queda tildado

#### Scenario: Cargar la grilla no genera una consulta por corredor
- **GIVEN** el grupo tiene 20 corredores
- **WHEN** la pantalla carga la grilla
- **THEN** la lista de corredores y sus asistencias se obtiene en una única llamada, sin una llamada adicional por corredor

### Requirement: El sistema SHALL guardar en una sola operación todas las filas marcadas

La pantalla SHALL ofrecer una acción de guardado que persista **todas** las filas
cuyos checks estén marcados, en una única operación, y SHALL indicar que no haya
nada marcado en ese momento.

Al guardar con éxito, el sistema SHALL limpiar los checks marcados, actualizar la
grilla y las tarjetas de métricas con los valores devueltos por el backend, y
confirmar la operación con un aviso de éxito. Un fallo SHALL dejar los checks
marcados, para que el entrenador no pierda lo que iba a guardar, y SHALL mostrar
el motivo del fallo.

Guardar dos veces el mismo lote SHALL ser seguro: el backend SHALL responder que
no creó nada nuevo y la pantalla SHALL quedar en el mismo estado.

Si el backend rechaza el guardado por un motivo que no sea de permisos —por
ejemplo que algún corredor ya no pertenece al grupo— la pantalla SHALL mostrar ese
motivo y NO SHALL marcar la operación como exitosa.

#### Scenario: Guardar varias filas a la vez
- **GIVEN** el entrenador marcó los checks de 3 corredores sin asistencia
- **WHEN** presiona "Guardar cambios"
- **THEN** se realiza una única operación que registra las 3 asistencias, los checks se limpian y las métricas pasan a 3 asistentes

#### Scenario: No hay nada marcado
- **WHEN** el entrenador no marcó ningún check y presiona "Guardar cambios"
- **THEN** la acción está deshabilitada y no se envía ninguna operación

#### Scenario: Guardar sin cambios pendientes
- **GIVEN** el entrenador ya guardó y los checks están limpios
- **WHEN** intenta guardar de nuevo
- **THEN** no se envía ninguna operación y las métricas no cambian

#### Scenario: Fallo al guardar
- **GIVEN** el entrenador marcó 2 checks y el backend rechaza la operación
- **WHEN** presiona "Guardar cambios"
- **THEN** la pantalla muestra un aviso de error con el motivo, los 2 checks siguen marcados y las métricas no cambian

#### Scenario: Guardar sobre una sesión que ya no es válida
- **GIVEN** el entrenador tiene 2 checks marcados y mientras tanto la sesión dejó de ser presencial en el backend
- **WHEN** presiona "Guardar cambios"
- **THEN** la pantalla muestra un aviso de que la sesión ya no admite asistencia, sin limpiar los checks

### Requirement: El sistema SHALL eliminar una asistencia de forma individual y previa confirmación

Cada fila con asistencia SHALL tener una acción para eliminarla. Al activarla, el
sistema SHALL pedir confirmación en un modal antes de ejecutar el borrado, y
SHALL abandonar el borrado si el entrenador cancela.

El modal SHALL identificar de forma explícita a qué corredor y a qué sesión
corresponde la asistencia que se va a eliminar. La eliminación SHALL ser
**siempre individual**: no SHALL existir una acción para borrar varias
asistencias de una vez.

Tras un borrado exitoso, el sistema SHALL actualizar la fila, las tarjetas de
métricas y el conteo de asistentes de la sesión seleccionada, y SHALL confirmar la
operación con un aviso.

#### Scenario: Eliminar con confirmación
- **GIVEN** un corredor tiene asistencia en la sesión
- **WHEN** el entrenador activa la acción de eliminar y confirma en el modal
- **THEN** la asistencia se elimina, la fila vuelve al estado "no confirmó" y las métricas se actualizan

#### Scenario: Cancelar la eliminación
- **GIVEN** un corredor tiene asistencia en la sesión
- **WHEN** el entrenador activa la acción de eliminar y cancela el modal
- **THEN** la asistencia sigue registrada y no se envía ninguna operación de borrado

#### Scenario: El modal identifica corredor y sesión
- **WHEN** el entrenador abre el modal de confirmación de borrado
- **THEN** el texto nombra al corredor y la fecha de la sesión que se va a eliminar

#### Scenario: La eliminación es individual
- **GIVEN** hay 3 filas con asistencia
- **WHEN** el entrenador revisa la grilla
- **THEN** cada fila con asistencia tiene su propia acción de eliminar, y no hay ninguna acción que borre varias filas a la vez

#### Scenario: Borrar mientras hay checks marcados
- **GIVEN** el entrenador marcó 2 checks y además borra una asistencia de otra fila
- **WHEN** confirma el borrado
- **THEN** la asistencia se elimina y los 2 checks marcados siguen marcados

#### Scenario: El borrado falla
- **WHEN** el backend rechaza el borrado
- **THEN** la pantalla muestra un aviso de error, la asistencia sigue en la grilla y las métricas no cambian

### Requirement: El sistema SHALL generar y mostrar el QR de la sesión seleccionada

Con una sesión seleccionada, la pantalla SHALL ofrecer una acción para generar el
QR de esa sesión. El QR SHALL obtenerse del backend y mostrarse en un modal, junto
al nombre del equipo, el nombre de la sesión y su fecha.

El modal SHALL poder cerrarse con el botón de cerrar, con el gesto de cerrar del
sistema operativo y apretando afuera de la tarjeta.

Si la generación del QR falla, el sistema SHALL mostrar el motivo del fallo y
SHALL mantener la grilla y las selecciones intactas.

El QR SHALL estar disponible aunque la sesión no tenga ninguna asistencia cargada
todavía, y la acción SHALL permanecer habilitada incluso cuando hay cambios sin
guardar.

#### Scenario: Generar y ver el QR
- **GIVEN** hay una sesión presencial ocurrida seleccionada
- **WHEN** el entrenador presiona "Generar QR"
- **THEN** se abre un modal con el QR de esa sesión, el nombre del equipo y la fecha de la sesión

#### Scenario: Cerrar el modal del QR
- **WHEN** el entrenador cierra el modal del QR
- **THEN** el modal se cierra y la pantalla de la grilla queda como estaba

#### Scenario: QR de una sesión sin asistencias
- **GIVEN** la sesión seleccionada no tiene ninguna asistencia registrada
- **WHEN** el entrenador presiona "Generar QR"
- **THEN** el modal muestra el QR igualmente

#### Scenario: El QR sigue disponible con cambios sin guardar
- **GIVEN** el entrenador tiene checks marcados sin guardar
- **WHEN** presiona "Generar QR"
- **THEN** el modal se abre y los checks siguen marcados al cerrarlo

#### Scenario: Falla la generación del QR
- **WHEN** el backend no puede emitir el QR
- **THEN** la pantalla muestra el motivo del fallo y la grilla con sus selecciones queda sin cambios

#### Scenario: El QR no está disponible para un corredor
- **GIVEN** el usuario activo tiene rol de corredor
- **WHEN** intenta abrir la pantalla de asistencia
- **THEN** el sistema le informa que la gestión de asistencia es exclusiva del entrenador, sin mostrar la grilla ni el botón de generar QR

### Requirement: El sistema SHALL permitir descargar el QR de la sesión como PDF

Desde el modal del QR, el sistema SHALL permitir descargar un documento PDF cuyo
contenido SHALL incluir, como mínimo: el **nombre del equipo**, el **logotipo de
la aplicación**, el **nombre de la sesión**, su **fecha**, el horario presencial y
el lugar cuando existan, y el **QR** de la sesión.

El documento SHALL tener un diseño cuidado —jerarquía visual, márgenes
consistentes, el QR como elemento dominante— y SHALL ser legible al imprimirse en
tamaño A4.

En la app nativa, la descarga SHALL producir un archivo PDF compartible. En web,
el sistema SHALL ofrecer la impresión o descarga del documento desde el navegador.

#### Scenario: Generar el PDF
- **WHEN** el entrenador pide descargar el PDF desde el modal del QR
- **THEN** el sistema genera un documento que contiene el nombre del equipo, el logotipo, el nombre y la fecha de la sesión, y el QR

#### Scenario: El PDF muestra horario y lugar cuando existen
- **GIVEN** la sesión presencial tiene horario y lugar cargados
- **WHEN** el entrenador genera el PDF
- **THEN** el documento incluye el horario y el lugar de la sesión

#### Scenario: El PDF omite horario y lugar cuando no existen
- **GIVEN** la sesión presencial no tiene horario ni lugar
- **WHEN** el entrenador genera el PDF
- **THEN** el documento se genera igual, sin esas dos líneas, y no muestra campos vacíos

#### Scenario: La descarga falla
- **WHEN** la generación del PDF falla
- **THEN** el sistema muestra un aviso de error y el modal del QR sigue abierto

### Requirement: El sistema SHALL permitir compartir el QR de la sesión

Desde el modal del QR, el sistema SHALL ofrecer una acción de compartir que
presente las **hojas de compartir del sistema operativo** con el archivo PDF
adjunto, de modo que el entrenador pueda enviarlo por la aplicación de mensajes
que prefiera, incluido WhatsApp si la tiene instalada.

Adicionalmente, el sistema SHALL ofrecer un atajo de **compartir por WhatsApp**
que abra directamente esa conversación con un mensaje que identifique al equipo y
a la sesión. Si WhatsApp no está disponible en el dispositivo, el atajo SHALL
ofrecer en su lugar la alternativa de abrir WhatsApp por web.

El atajo de WhatsApp SHALL funcionar tanto en la app nativa como en web.

#### Scenario: Compartir por la hoja del sistema
- **WHEN** el entrenador activa la acción de compartir desde el modal del QR
- **THEN** el sistema abre la hoja de compartir del sistema operativo con el PDF adjunto

#### Scenario: Atajo de WhatsApp disponible
- **GIVEN** el dispositivo tiene WhatsApp instalado
- **WHEN** el entrenador activa el atajo de compartir por WhatsApp
- **THEN** se abre WhatsApp con una conversación preparada que menciona el equipo y la sesión

#### Scenario: Atajo de WhatsApp sin la app instalada
- **GIVEN** el dispositivo no tiene WhatsApp instalado
- **WHEN** el entrenador activa el atajo de compartir por WhatsApp
- **THEN** el sistema ofrece abrir WhatsApp por web en lugar de fallar silenciosamente

#### Scenario: El mensaje identifica equipo y sesión
- **WHEN** se abre el atajo de compartir por WhatsApp
- **THEN** el mensaje preparado incluye el nombre del equipo y la fecha de la sesión

#### Scenario: Compartir en web
- **WHEN** el entrenador activa cualquiera de las acciones de compartir desde un navegador
- **THEN** el comportamiento de compartir o imprimir está disponible y no arroja un error

### Requirement: El sistema SHALL advertir al entrenador antes de descartar cambios sin guardar

La pantalla SHALL detectar si hay filas marcadas sin guardar y SHALL pedir
confirmación antes de qualquer salida que las descarte, sea la navegación hacia
otra sección, el gesto de volver del sistema operativo o el cambio de equipo,
grupo o sesión.

Al confirmar el descarte, el sistema SHALL limpiar los checks marcados. Al
cancelar, el entrenador SHALL permanecer en la pantalla con los checks intactos.

Este aviso SHALL ser el único mecanismo de descarte: no SHALL perderse el
trabajo en silencio.

#### Scenario: Salir con checks sin guardar
- **GIVEN** el entrenador tiene 2 checks marcados sin guardar
- **WHEN** intenta salir de la pantalla
- **THEN** aparece un aviso pidiendo confirmar el descarte, y los checks siguen marcados mientras tanto

#### Scenario: Cancelar el descarte
- **WHEN** el entrenador marca 2 checks, intenta salir y cancela el aviso de descarte
- **THEN** permanece en la pantalla y los 2 checks siguen marcados

#### Scenario: Confirmar el descarte
- **WHEN** el entrenador marca 2 checks, intenta salir y confirma el descarte
- **THEN** la pantalla se cierra y al volver a abrirla no queda ningún check marcado

#### Scenario: Cambiar de sesión con checks sin guardar
- **GIVEN** el entrenador tiene 2 checks marcados y elige otra sesión del selector
- **WHEN** el sistema pide confirmación
- **THEN** al confirmar se cambia de sesión con los checks limpios, y al cancelar se sigue en la sesión anterior con los checks marcados

#### Scenario: Guardar y salir sin aviso
- **GIVEN** el entrenador marcó 2 checks y los guardó con éxito
- **WHEN** intenta salir de la pantalla
- **THEN** no aparece ningún aviso, porque ya no hay nada sin guardar

### Requirement: El sistema SHALL comunicar los estados de carga, vacío y error de la pantalla

Mientras se cargan los datos, la pantalla SHALL mostrar un indicador de progreso en
la zona correspondiente, y no SHALL mostrar un estado vacío que sugiera que no hay
datos.

Cuando no haya una sesión seleccionada, la pantalla SHALL mostrar un mensaje
pidiendo elegir equipo, grupo y sesión. Cuando la sesión seleccionada no tenga
corredores en el grupo, SHALL mostrar un mensaje explicando que el grupo no tiene
corredores. Cuando una consulta falle, SHALL mostrar el motivo del fallo y ofrecer
reintentar.

Si el usuario baja o refresca la pantalla, el sistema SHALL volver a pedir los
datos de la sesión seleccionada y SHALL reflejar el resultado.

#### Scenario: Estado de carga
- **WHEN** la pantalla está pidiendo la grilla de la sesión seleccionada
- **THEN** se muestra un indicador de progreso en lugar de un mensaje de grupo vacío

#### Scenario: Sin sesión seleccionada
- **WHEN** el entrenador todavía no eligió sesión
- **THEN** la pantalla indica que debe elegir equipo, grupo y sesión, y no muestra tarjetas de métricas

#### Scenario: Error al cargar con reintento
- **WHEN** la carga de la grilla falla
- **THEN** la pantalla muestra el motivo y una acción para reintentar

#### Scenario: Refrescar la pantalla
- **WHEN** el entrenador tira para actualizar la pantalla con una sesión seleccionada
- **THEN** la grilla y las métricas se vuelven a pedir al backend y se actualizan
