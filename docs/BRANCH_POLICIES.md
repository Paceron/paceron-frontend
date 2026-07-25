# Política de ramas y proceso de revisión de pull requests

La política de ramas y el proceso de revisión de pull requests garantizan orden, trazabilidad y calidad en el desarrollo colaborativo.  
Esta sección define el modelo de ramificación y el flujo de trabajo para el control de versiones, garantizando un ciclo de vida de desarrollo estructurado y estable.

## Ramas Principales (Protegidas)

* **MASTER:** Rama de producción. Contiene código estable y liberado. Está protegida y solo recibe fusiones desde ramas RELEASE/.

* **DEVELOP:** Rama de integración. Contiene el código en desarrollo para la próxima versión. Está protegida y recibe integraciones de FEATURE/ y BACKPORT/.

## Ramas de Soporte y Nomenclatura

| Tipo de Rama | Origen | Destino | Descripción |
| :---: | :---: | :---: | :---: |
| feature/\<nombre\> | develop | develop | Desarrollo de nuevas funcionalidades (ej. feature/userCreation). |
| release/\<versión\> | develop | master | Preparación de una nueva versión a producción (ej. release/0.4.0). |
| fix/\<id\> | release/ o develop | release/ o develop | Corrección de errores específicos (ej. fix/12346 o fix/sdfsdf). |
| hotfix/\<id\> | master | master | Corrección de errores en producción (ej. hotfix/12346 o hotfix/nullpointerfix). |
| backport/\<versión\> | master | develop | Sincronización de cambios de producción hacia desarrollo (ej. backport/0.4.5). |
| chore/\<nombre\> | develop | develop | Tareas de mantenimiento sin impacto funcional: config, tooling, CI/CD, docs (ej. chore/update-ci-config). |

## Flujo de Trabajo y Ciclo de Vida

### Desarrollo de Funcionalidades

Todo nuevo desarrollo inicia desde **develop** creando una rama **feature**/. Al finalizar, se realiza un Pull Request hacia **develop**.

### Preparación de Release y Correcciones

1. Se extrae una rama **release**/ desde **develop** cuando las funcionalidades están listas para la próxima versión.  
2. Si se detectan anomalías durante las pruebas, se crean ramas **fix**/ que se fusionan sobre la rama **release**/ correspondiente (ej. **fix**/12346 → **release**/0.4.0).  
3. Una vez estabilizada y aprobada, la rama **release**/ se fusiona directamente hacia **master** (ej. **release**/0.4.5 → **master**).

### Estrategia de Sincronización (Backporting)

Para asegurar que **develop** incorpore de manera estricta todas las correcciones aplicadas durante la fase de release en producción, se emplea el siguiente mecanismo de backporting:

* Se deriva una rama **backport** directamente desde **master** (ej. **master** → **backport**/0.4.5).  
* Esta rama se fusiona hacia **develop** (**backport**/0.4.5 → **develop**), asegurando la paridad del código base.

### Proceso de revisión de pull requests

Es una herramienta de equipo para:

* Compartir conocimiento y onboarding continuo  
* Detectar bugs, edge cases y deuda técnica temprano  
* Mantener consistencia en arquitectura, seguridad y estilo  
* Elevar el nivel técnico de todo el equipo  
* Crear responsabilidad compartida sobre el código

 ***Regla de oro: Se revisa el código, no a la persona.***

| Sección | Qué incluir | Ejemplo |
| ----- | ----- | ----- |
| Título | \[Tipo\] Ticket: Descripción corta | featiure/USER-123: añadir validación de email |
| Descripción | Qué hace, por qué se hace, impacto | Implementa regex \+ test unitarios. para Evitar registros inválidos en auth. |
| Contexto/Background | Enlace a ticket, decisiones técnicas, alternativas descartadas | Ver JIRA-456. Se eligió Clode Clean por acuerdo del team |
| Cómo probarlo | Pasos claros, credenciales o links, URLs, mocks | 1\. Levantarnpm run dev2. Ir a/register3. Usar emailtest@→ ver error |
| Screenshots/GIFs | Obligatorio si hay UI, logs o flujos visuales | \!\[registro\_valido.gif\](link) |
| Checklist de Auto-Verificación | Marcar solo si aplica | \- \[x\] Tests pasan localmente \- \[x\] CI verde \- \[x\] Sinconsole.logde debug |
| Tickets/Issues | Links a Jira | Closes \#89, Relates to JIRA-456 |

## Flujo del Proceso (Paso a Paso)

1. Autor crea la rama → trabaja → hace commits atómicos → sube a GitHub  
2. Autor abre PR, llena plantilla, asigna 1-2 revisores, verifica CI  
3. Revisor recibe notificación → revisa en \<48h → deja comentarios estructurados  
4. Iteración: Autor responde/ajusta → revisor vuelve a validar  
5. Aprobación: ≥1 aprobación \+ CI verde \+ sin conflictos  
6. Merge: Squash and merge (recomendado) → borrar rama → cerrar threads  
7. Post-Merge: Monitorizar logs, verificar despliegue, actualizar documentación si aplica

## Checklists para cada rol

### **Autor** (Antes de pedir review)

* El PR resuelve un solo objetivo lógico  
* Código formateado (prettier, eslint, black, etc.)  
* No hay código muerto, TODO, FIXME o logs de debug  
* Tests actualizados y pasan localmente \+ en CI  
* Descripción clara, reproducible y con contexto  
* Revisé mi propio diff completo (buscar errores triviales)  
* Asigné a los revisores correctos (no a todo el equipo)

### **Revisor** (Durante la revisión)

* Entiendo qué se cambia y por qué  
* El cambio cumple con los requisitos del ticket  
* No rompe funcionalidad existente (regresión)  
* ¿Edge cases, inputs inválidos, concurrencia y seguridad?  
* ¿Tests cubren los nuevos caminos? ¿Mocks adecuados?  
* ¿Sigue patrones del proyecto? (nombres, estructura, errores)  
* Comentarios son constructivos, específicos y accionables  
* Si no estoy seguro, pregunto en lugar de asumir

| Hacer | Evitar |
| ----- | ----- |
| Usar Suggestion de GitHub para cambios pequeños | Comentarios vagos: "fix this", "meh" |
| Etiquetar prioridad: \[Must\], \[Nice\], \[Question\] | Tono personal: "esto está mal hecho" |
| Explicar el porqué detrás de cada comentario | Aprobar sin leer (LGTM por presión) |
| Resolver threads cuando se aplique | Debates largos en comentarios → mejor sync de 10 min |
| Elogiar buenas prácticas también | Ignorar CI fallido o warnings |

*Fórmula de comentario útil:* Contexto → Problema → Sugerencia → Referencia (si aplica)

| Anti-patrón | Solución |
| ----- | ----- |
| PRs de 1000+ líneas | Divide en feat/A, feat/B, feat/C |
| Ignorar comentarios del revisor | Responde: "Aplicado", "No aplica porque...", "¿Aclaro?" |
| Pushar a la rama del PR sin avisar | Comenta: "Push \#2: corregí X según feedback" |
| Pedir review a 5 personas | 1-2 es suficiente. Más \= dilución de responsabilidad |
| Revisar solo en GitHub | Usa git diff local para entender el contexto completo |
| Tomar feedback como ataque | Es una herramienta de crecimiento. Pregunta si no entiendes |
