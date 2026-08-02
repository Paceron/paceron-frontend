# Pulido de invitaciones y grupos (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver el batch de feedback de QA sobre Etapa 3 (invitaciones + grupos): 2 bugs de select/duplicado, split visual de invitar vs. invitados, badge de invitaciones pendientes, rediseño de creación de grupos (2 columnas, default primero e inmutable), y vaciar el catálogo mock de planes de entrenamiento.

**Architecture:** Continúa sobre `feature/teams-invitations-and-qa-fixes` (no pusheada). Mayormente cambios de UI en componentes ya existentes — sin cambios de store ni de servicios, salvo el fetch de conteo de invitaciones para el badge (reutiliza `fetchMyInvitations`, ya existe).

**Tech Stack:** Zustand, Expo Router, NativeWind, Jest.

## Global Constraints

- **Roster real y membresía por grupo quedan explícitamente fuera de este plan** (complejidad de N+1 + cruce de membresía por grupo, ver conversación — es un plan aparte).
- **Autocompletar/sugerir usuarios al invitar queda fuera** — el backend no tiene búsqueda difusa, solo `GET /auth/user?email=` (lookup exacto). Documentar como gap nuevo, no construir nada.
- **Planes de entrenamiento:** el selector se mantiene en la UI (no se elimina el campo), pero sin catálogo mock — `TRAINING_PLAN_OPTIONS` pasa a ser `[]` hasta que exista un backend real de planes.
- **Sin verificación en browser por parte de los subagentes** (misma convención que el resto de esta rama) — código + tests unitarios (donde el repo los tiene) + `npm run lint` alcanza. Al final se entrega script de prueba manual.
- Modelos: el nivel más barato que alcance por rol.
- Todo elemento visual nuevo lleva `nativeID`/`testID` únicos.
- `npm test` y `npm run lint` en verde después de cada tarea.

---

### Task 1: Bugs de select — sacar "Sin grupo" duplicado, arreglar filtro de grupo en Corredores, diferenciar búsqueda

**Files:**
- Modify: `components/forms/fields.jsx`
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `ResponsiveSelectField` (ya existe).

- [ ] **Step 1: Sacar el sentinel "Sin grupo" de `EmailListField`**

El picker de grupo al invitar mostraba "Sin grupo" (opción inventada del cliente) Y el grupo principal real (ej. "General") como dos opciones separadas — ambas producen el mismo resultado en el backend (sin `group_id` → cae en el principal), así que se ven como duplicadas. Se saca el sentinel: las opciones pasan a ser directamente `groups` (que ya incluye el grupo principal real), sin agregar nada al principio.

Localizar en `components/forms/fields.jsx`, dentro de `EmailListField`:

```js
const NO_GROUP_ID = '';
const NO_GROUP_LABEL = 'Sin grupo';
```

y

```js
  const groupOptions = [{ id: NO_GROUP_ID, name: NO_GROUP_LABEL }, ...groups];
```

Reemplazar por (sacar las dos constantes, dejar `groupOptions` como alias directo de `groups`):

```js
  const groupOptions = groups;
```

Actualizar el `useState` inicial y el reset post-submit:

```js
  const [draftGroupId, setDraftGroupId] = useState(NO_GROUP_ID);
```

por:

```js
  const [draftGroupId, setDraftGroupId] = useState('');
```

y:

```js
    setDraftGroupId(NO_GROUP_ID);
```

por:

```js
    setDraftGroupId('');
```

Actualizar el placeholder del picker — buscar:

```jsx
          <InlinePicker
            onChange={setDraftGroupId}
            options={groupOptions}
            placeholder={NO_GROUP_LABEL}
            scope={`${slug}-invite-group`}
            value={draftGroupId}
            widthClass="max-w-[112px]"
          />
```

por:

```jsx
          <InlinePicker
            onChange={setDraftGroupId}
            options={groupOptions}
            placeholder="Grupo"
            scope={`${slug}-invite-group`}
            value={draftGroupId}
            widthClass="max-w-[112px]"
          />
```

Actualizar la resolución de nombre de grupo en el chip — buscar:

```js
            const groupName = groupOptions.find((g) => g.id === invite.groupId)?.name ?? NO_GROUP_LABEL;
```

por:

```js
            const groupName = groupOptions.find((g) => g.id === invite.groupId)?.name ?? 'Grupo principal';
```

Actualizar el comentario de cabecera de `EmailListField` (reemplazar la mención a `NO_GROUP_ID`/"Sin grupo" por una explicación de que ya no hay sentinel):

```js
// Junta una lista de emails validos, uno por uno (ej. invitar gente a un
// equipo antes de que exista, o desde la pantalla de invitar de un equipo
// ya existente), cada uno con el grupo al que se invita — value es
// [{ email, groupId }]. Sin grupo elegido, groupId queda '' — el backend
// asigna el grupo principal del equipo por default (ver
// docs/BACKEND_API_GAPS.md gap 9, resuelto 2026-07-31). Las opciones del
// picker son directamente `groups` (ya incluye el grupo principal real) —
// no hay un "Sin grupo" inventado aparte, sería la misma opción dos veces.
// `groups` es opcional: sin ese prop (o vacío) no se muestra el picker de
// grupo, para los casos donde no aplica.
```

- [ ] **Step 2: Arreglar el filtro de grupo en la pestaña Corredores (`team-detail-screen.jsx`)**

Este `PickerField` nunca tuvo rama web — siempre mostraba el modal mobile sin importar la plataforma. Localizar:

```jsx
          <PickerField dense label="Grupo" onChange={setGroupFilter} options={groupOptions} placeholder="Todos los grupos" value={groupFilter} />
```

por:

```jsx
          <ResponsiveSelectField dense label="Grupo" onChange={setGroupFilter} options={groupOptions} placeholder="Todos los grupos" value={groupFilter} />
```

Agregar el import (junto a los imports existentes de `../forms/fields.jsx`):

```js
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
```

Confirmar si `PickerField` sigue usándose en algún otro lado de este archivo antes de sacar su import — si no, sacarlo del import de `../forms/fields.jsx`.

- [ ] **Step 3: Diferenciar visualmente la fila de búsqueda**

Localizar el bloque `<Row>` que envuelve el buscador y el filtro de grupo en la pestaña Corredores:

```jsx
      <Row>
        <Col>
          <InputField dense label="Buscar corredor" onChange={setSearch} placeholder={isTrainerView ? 'Nombre o email del corredor' : 'Nombre del corredor'} value={search} />
        </Col>
        {canSeeGroups && (
          <Col>
            <ResponsiveSelectField dense label="Grupo" onChange={setGroupFilter} options={groupOptions} placeholder="Todos los grupos" value={groupFilter} />
          </Col>
        )}
      </Row>
```

Envolverlo en un contenedor con fondo/borde sutil:

```jsx
      <View className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900" nativeID="team-detail-search-row" testID="team-detail-search-row">
        <Row>
          <Col>
            <InputField dense label="Buscar corredor" onChange={setSearch} placeholder={isTrainerView ? 'Nombre o email del corredor' : 'Nombre del corredor'} value={search} />
          </Col>
          {canSeeGroups && (
            <Col>
              <ResponsiveSelectField dense label="Grupo" onChange={setGroupFilter} options={groupOptions} placeholder="Todos los grupos" value={groupFilter} />
            </Col>
          )}
        </Row>
      </View>
```

(los `InputField`/`ResponsiveSelectField` de adentro ya traen su propio `mb-*` — confirmar que no queda doble espaciado raro; si lo hay, es un ajuste visual menor, no bloqueante).

- [ ] **Step 4: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/forms/fields.jsx components/team/team-detail-screen.jsx
git commit -m "fix(teams): remove duplicate 'sin grupo' option, fix unresponsive group filter select"
```

---

### Task 2: Separar `EmailListField` en formulario + lista

**Files:**
- Modify: `components/forms/fields.jsx`

**Interfaces:**
- Consumes: nada de la Task 1 más allá del archivo ya tocado (aplicar sobre el resultado de la Task 1).
- Produces: `EmailInviteForm({onAdd, groups, placeholder})` — el formulario (input + picker de grupo + botón agregar), llama `onAdd({email, groupId})` por cada alta. `InvitedEmailsList({value, onChange, groups})` — la lista de chips ya agregados, con botón de quitar. Reemplazan a `EmailListField` (que se elimina).

- [ ] **Step 1: Reemplazar `EmailListField` por los dos componentes nuevos**

Localizar el bloque completo de `EmailListField` (desde el comentario de cabecera hasta el cierre de la función) y reemplazarlo por:

```js
// Formulario para agregar un email a la vez a una lista de invitados (ej.
// invitar gente a un equipo antes de que exista, o desde la pantalla de
// invitar de un equipo ya existente), con grupo opcional por invitación.
// Solo agrega — no muestra la lista de ya agregados, eso es
// InvitedEmailsList (abajo), pensado para vivir en su propia sección
// visual separada ("Invitar" vs. "Invitados"). `groups` es opcional: sin
// ese prop (o vacío) no se muestra el picker de grupo. Sin grupo elegido,
// `onAdd` manda `groupId: ''` — el backend asigna el grupo principal del
// equipo por default (ver docs/BACKEND_API_GAPS.md gap 9, resuelto
// 2026-07-31). Las opciones del picker son directamente `groups` (ya
// incluye el grupo principal real) — no hay un "Sin grupo" inventado
// aparte.
export function EmailInviteForm({ onAdd, groups = [], placeholder = 'nombre@email.com' }) {
  const colors = useThemeColors();
  const slug = 'email-invite-form';
  const [draft, setDraft] = useState('');
  const [draftGroupId, setDraftGroupId] = useState('');
  const [draftError, setDraftError] = useState(null);

  const handleAdd = () => {
    const email = draft.trim();
    if (!email) return;
    if (!validateEmailFormat(email)) {
      setDraftError('Email inválido');
      return;
    }
    onAdd({ email, groupId: draftGroupId });
    setDraft('');
    setDraftGroupId('');
    setDraftError(null);
  };

  return (
    <View nativeID={slug} testID={slug}>
      <View className="flex-row items-center gap-2" nativeID={`${slug}-row`} testID={`${slug}-row`}>
        <View
          className={`h-12 flex-1 flex-row items-center rounded-xl border ${
            draftError ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
          }`}
          nativeID={`${slug}-input-wrapper`}
          testID={`${slug}-input-wrapper`}
        >
          <TextInput
            autoCapitalize="none"
            className={INPUT_CLASS}
            keyboardType="email-address"
            onChangeText={(text) => { setDraft(text); if (draftError) setDraftError(null); }}
            onSubmitEditing={handleAdd}
            placeholder={placeholder}
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="done"
            value={draft}
            nativeID={`${slug}-input`}
            testID={`${slug}-input`}
          />
        </View>

        {groups.length > 0 && (
          <InlinePicker
            onChange={setDraftGroupId}
            options={groups}
            placeholder="Grupo"
            scope={`${slug}-group`}
            value={draftGroupId}
            widthClass="max-w-[112px]"
          />
        )}

        <Pressable
          className="h-12 w-12 items-center justify-center rounded-xl bg-primary hover:opacity-90 active:opacity-80"
          accessibilityLabel="Agregar email"
          nativeID={`${slug}-add-button`}
          onPress={handleAdd}
          testID={`${slug}-add-button`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={20} />
        </Pressable>
      </View>

      <View className="h-5" nativeID={`${slug}-error-row`} testID={`${slug}-error-row`}>
        {draftError && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`${slug}-error`} testID={`${slug}-error`}>{draftError}</Text>}
      </View>
    </View>
  );
}

// Lista de invitados ya agregados (borrador, todavía sin mandar) — chips
// con nombre de grupo (si `groups` viene con datos) y botón de quitar.
// Vive en su propia sección visual, separada de EmailInviteForm.
export function InvitedEmailsList({ value = [], onChange, groups = [] }) {
  const colors = useThemeColors();

  const handleRemove = (email) => {
    onChange(value.filter((e) => e.email !== email));
  };

  if (value.length === 0) {
    return (
      <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="invited-emails-list-empty" testID="invited-emails-list-empty">
        Todavía no agregaste a nadie.
      </Text>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-2" nativeID="invited-emails-list-chips" testID="invited-emails-list-chips">
      {value.map((invite) => {
        const chipSlug = slugify(invite.email);
        const groupName = groups.find((g) => g.id === invite.groupId)?.name ?? 'Grupo principal';
        return (
          <View
            key={invite.email}
            className="flex-row items-center gap-1.5 rounded-full bg-primary-tint-subtle px-3 py-1.5 dark:bg-primary/10"
            nativeID={`invited-emails-list-chip-${chipSlug}`}
            testID={`invited-emails-list-chip-${chipSlug}`}
          >
            <Text
              className="text-xs font-medium text-on-primary-tint dark:text-primary"
              nativeID={`invited-emails-list-chip-${chipSlug}-label`}
              testID={`invited-emails-list-chip-${chipSlug}-label`}
            >
              {groups.length > 0 ? `${invite.email} · ${groupName}` : invite.email}
            </Text>
            <Pressable
              accessibilityLabel={`Quitar ${invite.email}`}
              onPress={() => handleRemove(invite.email)}
              nativeID={`invited-emails-list-chip-${chipSlug}-remove-button`}
              testID={`invited-emails-list-chip-${chipSlug}-remove-button`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={14} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores. (Los call sites que todavía importan `EmailListField` van a romper — eso se arregla en las Tasks 3/4, no en esta.)

- [ ] **Step 3: Commit**

```bash
git add components/forms/fields.jsx
git commit -m "refactor(forms): split EmailListField into EmailInviteForm + InvitedEmailsList"
```

---

### Task 3: `create-team-screen.jsx` — secciones separadas "Invitar" / "Invitados"

**Files:**
- Modify: `components/team/create-team-screen.jsx`

**Interfaces:**
- Consumes: `EmailInviteForm`/`InvitedEmailsList` de la Task 2.

- [ ] **Step 1: Actualizar el import**

Reemplazar:

```js
import { EmailListField } from '../forms/fields.jsx';
```

por:

```js
import { EmailInviteForm, InvitedEmailsList } from '../forms/fields.jsx';
```

- [ ] **Step 2: Separar el paso 3 en dos `SectionCard`**

Localizar:

```jsx
        {step === 3 && (
          <SectionCard icon="email-outline" title="Invitar corredores">
            <EmailListField groups={groups} label="Invitar corredores por email" onChange={setInvitedEmails} value={invitedEmails} />

            <StepNav disabled={submitting} loading={submitting} nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
          </SectionCard>
        )}
```

Reemplazar por:

```jsx
        {step === 3 && (
          <>
            <SectionCard icon="email-outline" title="Invitar corredores">
              <EmailInviteForm groups={groups} onAdd={(invite) => setInvitedEmails((prev) => [...prev, invite])} placeholder="Email del corredor" />
            </SectionCard>

            <SectionCard icon="account-multiple-check" title="Corredores a invitar">
              <InvitedEmailsList groups={groups} onChange={setInvitedEmails} value={invitedEmails} />

              <StepNav disabled={submitting} loading={submitting} nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
            </SectionCard>
          </>
        )}
```

(`StepNav` se muda a la segunda `SectionCard` — tiene más sentido como acción de cierre del paso completo, después de ver a quién se va a invitar, no pegada al formulario de agregar).

- [ ] **Step 3: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/team/create-team-screen.jsx
git commit -m "feat(teams): split create-team wizard's invite step into invite form + invited list sections"
```

---

### Task 4: `invite-team-members-screen.jsx` — secciones separadas "Invitar" / "Invitados"

**Files:**
- Modify: `components/team/invite-team-members-screen.jsx`

**Interfaces:**
- Consumes: `EmailInviteForm`/`InvitedEmailsList` de la Task 2.

**Nota:** esta pantalla ya tiene una `SectionCard` "Solicitudes pendientes" (invitaciones YA MANDADAS al backend, real). Esta tarea no toca esa sección — agrega una nueva para el borrador de invitados TODAVÍA NO enviados, entre "Solicitudes pendientes" e "Invitar más corredores".

- [ ] **Step 1: Actualizar el import**

Reemplazar:

```js
import { EmailListField } from '../forms/fields.jsx';
```

por:

```js
import { EmailInviteForm, InvitedEmailsList } from '../forms/fields.jsx';
```

- [ ] **Step 2: Separar el formulario de invitar en dos secciones**

Localizar:

```jsx
        <SectionCard icon="account-plus-outline" title="Invitar más corredores">
          <EmailListField groups={team.groups} label="Email del corredor" onChange={setDraftInvites} value={draftInvites} />

          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={sending}
            nativeID="invite-team-send-button"
            onPress={handleSendInvites}
            testID="invite-team-send-button"
          >
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="send-outline" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-team-send-button-label" testID="invite-team-send-button-label">
                  Enviar invitaciones
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>
```

Reemplazar por:

```jsx
        <SectionCard icon="account-plus-outline" title="Invitar más corredores">
          <EmailInviteForm groups={team.groups} onAdd={(invite) => setDraftInvites((prev) => [...prev, invite])} placeholder="Email del corredor" />
        </SectionCard>

        <SectionCard icon="account-multiple-check" title="Corredores a invitar">
          <InvitedEmailsList groups={team.groups} onChange={setDraftInvites} value={draftInvites} />

          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={sending}
            nativeID="invite-team-send-button"
            onPress={handleSendInvites}
            testID="invite-team-send-button"
          >
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="send-outline" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-team-send-button-label" testID="invite-team-send-button-label">
                  Enviar invitaciones
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>
```

- [ ] **Step 3: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/team/invite-team-members-screen.jsx
git commit -m "feat(teams): split invite screen's draft form into invite form + invited list sections"
```

---

### Task 5: Badge de invitaciones pendientes en el nav

**Files:**
- Modify: `components/shell/app-web-shell.jsx`
- Modify: `components/shell/app-web-shell-narrow.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: `fetchMyInvitations(userId, email)`/`myInvitations` de `store/team-store.js` (ya existen).

- [ ] **Step 1: `app-web-shell.jsx` — fetch al montar el shell + badge en el tab**

Junto al `useEffect` de `fetchTeams` ya existente en `AppWebShell` (agregado en una tarea anterior de esta rama), agregar:

```js
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    fetchMyInvitations(user.userId, user.email);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.email]);
```

(sin loading state acá — el badge simplemente no aparece hasta que resuelve, no hay UI de carga que mostrar para un puntito).

En `TopBar`, dentro del `.map` de `routesTab` (la rama `else` que renderiza un link plano, no la de `route.name === 'teams'`), agregar el badge condicional. Localizar:

```jsx
                  <MaterialCommunityIcons
                    name={route.icon}
                    size={16}
                    color={isActive ? colors.primary : colors.onSurfaceVariant}
                  />
```

Reemplazar por:

```jsx
                  <View className="relative" nativeID={`web-shell-nav-tab-${route.name}-icon-wrapper`} testID={`web-shell-nav-tab-${route.name}-icon-wrapper`}>
                    <MaterialCommunityIcons
                      name={route.icon}
                      size={16}
                      color={isActive ? colors.primary : colors.onSurfaceVariant}
                    />
                    {route.name === 'invitations' && myInvitationsCount > 0 && (
                      <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-shell-nav-tab-invitations-badge" testID="web-shell-nav-tab-invitations-badge" />
                    )}
                  </View>
```

`myInvitationsCount` tiene que llegar a `TopBar` — agregarlo a sus props: buscar la firma `function TopBar({ isGuest, userName, activeRole, dropdownOpen, routesTab, activeTab, teamsMenuOpen, onTabPress, onUserPress, onTeamsPress })` y sumar `myInvitationsCount`, y en el JSX donde `AppWebShell` renderiza `<TopBar ... />` sumar `myInvitationsCount={myInvitationsCount}`.

- [ ] **Step 2: `app-web-shell-narrow.jsx` — mismo fetch + badge en el drawer**

Agregar junto al `useEffect` de `fetchTeams` ya existente:

```js
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);

  useEffect(() => {
    if (!user?.userId) return undefined;
    fetchMyInvitations(user.userId, user.email);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.email]);
```

En el `.map` de rutas (rama que no es `teams`), localizar el `<MaterialCommunityIcons name={route.icon} ... />` de ese branch y aplicar el mismo wrapper `relative` + badge condicional que en el Step 1, con los `nativeID`/`testID` ajustados al prefijo de este archivo (buscar el prefijo ya usado en los demás elementos de esa rama, ej. `web-narrow-drawer-nav-...` — confirmar el nombre real leyendo el archivo antes de aplicar, no asumir el prefijo exacto sin chequear).

- [ ] **Step 3: `app-mobile-shell.jsx` — mismo fetch + badge en el drawer**

Mismo patrón exacto que el Step 2, con el prefijo de `nativeID`/`testID` correspondiente a este archivo (confirmar leyendo el archivo real antes de aplicar).

- [ ] **Step 4: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(shell): show a badge dot on the Invitaciones nav item when there are pending invitations"
```

---

### Task 6: `GroupListEditor` — grupo default primero (preview), formulario en 2 columnas

**Files:**
- Modify: `components/team/group-list-editor.jsx`

**Interfaces:**
- Consumes: `Row`/`Col` de `components/forms/fields.jsx` (ya existen, patrón establecido).

- [ ] **Step 1: Reemplazar el archivo completo**

```jsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Editor controlado de grupos de un equipo, usado en el paso "Grupos" del
// wizard de creación (components/team/create-team-screen.jsx, sobre datos
// en borrador — el equipo todavía no existe). Muestra primero una fila
// informativa fija del grupo principal (el backend lo crea automáticamente
// vía create_default_group al crear el equipo — acá es solo un preview,
// no editable ni eliminable, no tiene id real todavía) y después el
// formulario para agregar grupos extra, en 2 columnas: nombre+plan a la
// izquierda, descripción a la derecha ocupando el mismo alto. Los grupos
// ya agregados se listan debajo con botón de eliminar (el preview del
// principal nunca lo tiene).
export function GroupListEditor({ groups, onChange, onRemove, planOptions }) {
  const colors = useThemeColors();
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPlan, setDraftPlan] = useState('');
  const [draftError, setDraftError] = useState(null);

  const handleAdd = () => {
    const name = draftName.trim();
    if (!name) {
      setDraftError('Ingresá un nombre para el grupo.');
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setDraftError('Ya creaste un grupo con ese nombre.');
      return;
    }
    onChange([...groups, { id: `group-draft-${Date.now()}`, name, description: draftDescription.trim() || null, trainingPlanId: draftPlan || null }]);
    setDraftName('');
    setDraftDescription('');
    setDraftPlan('');
    setDraftError(null);
  };

  const handleRemove = (groupId) => {
    onChange(groups.filter((g) => g.id !== groupId));
    onRemove?.(groupId);
  };

  return (
    <View nativeID="group-list-editor" testID="group-list-editor">
      <View
        className="mb-4 flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        nativeID="group-list-editor-default-preview"
        testID="group-list-editor-default-preview"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID="group-list-editor-default-preview-icon" testID="group-list-editor-default-preview-icon">
          <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={18} />
        </View>
        <View className="flex-1" nativeID="group-list-editor-default-preview-info" testID="group-list-editor-default-preview-info">
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="group-list-editor-default-preview-name" testID="group-list-editor-default-preview-name">
            Grupo principal
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="group-list-editor-default-preview-hint" testID="group-list-editor-default-preview-hint">
            Se crea automáticamente con el equipo — todo corredor sin grupo elegido cae acá.
          </Text>
        </View>
      </View>

      <View className="mb-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="group-list-editor-form" testID="group-list-editor-form">
        <Row>
          <Col>
            <InputField
              dense
              error={draftError}
              label="Nombre del grupo"
              onChange={(text) => { setDraftName(text); if (draftError) setDraftError(null); }}
              placeholder="Ej. Grupo avanzado"
              value={draftName}
            />
            <ResponsiveSelectField
              dense
              label="Plan de entrenamiento"
              onChange={setDraftPlan}
              options={planOptions}
              placeholder={planOptions.length === 0 ? 'Sin planes disponibles todavía' : 'Sin plan asignado'}
              value={draftPlan}
            />
          </Col>
          <Col>
            <InputField
              className="flex-1"
              dense
              label="Descripción del grupo"
              multiline
              numberOfLines={5}
              onChange={setDraftDescription}
              placeholder="Ej. Corredores con mayor volumen y ritmo."
              value={draftDescription}
            />
          </Col>
        </Row>

        <Pressable
          className="h-11 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
          nativeID="group-list-editor-add-button"
          onPress={handleAdd}
          testID="group-list-editor-add-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={18} />
          <Text
            className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
            nativeID="group-list-editor-add-button-label"
            testID="group-list-editor-add-button-label"
          >
            Agregar grupo
          </Text>
        </Pressable>
      </View>

      {groups.length > 0 && (
        <View className="mb-6 gap-2" nativeID="group-list-editor-list" testID="group-list-editor-list">
          {groups.map((group) => {
            const planName = planOptions.find((p) => p.id === group.trainingPlanId)?.name;
            return (
              <View
                key={group.id}
                className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                nativeID={`group-list-editor-row-${group.id}`}
                testID={`group-list-editor-row-${group.id}`}
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15"
                  nativeID={`group-list-editor-row-${group.id}-icon`}
                  testID={`group-list-editor-row-${group.id}-icon`}
                >
                  <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={18} />
                </View>
                <View className="flex-1" nativeID={`group-list-editor-row-${group.id}-info`} testID={`group-list-editor-row-${group.id}-info`}>
                  <Text
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                    nativeID={`group-list-editor-row-${group.id}-name`}
                    testID={`group-list-editor-row-${group.id}-name`}
                  >
                    {group.name}
                  </Text>
                  <Text
                    className="text-xs text-slate-500 dark:text-slate-400"
                    nativeID={`group-list-editor-row-${group.id}-plan`}
                    testID={`group-list-editor-row-${group.id}-plan`}
                  >
                    {planName ?? 'Sin plan asignado'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Quitar grupo ${group.name}`}
                  className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
                  nativeID={`group-list-editor-row-${group.id}-remove-button`}
                  onPress={() => handleRemove(group.id)}
                  testID={`group-list-editor-row-${group.id}-remove-button`}
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trash-can-outline" size={18} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
```

(`InputField` acepta `className` para el caso de la descripción — confirmar leyendo `InputField` en `components/forms/fields.jsx` que reenvía ese prop a su contenedor; si no lo hace, sacar el `className="flex-1"` de ese `InputField` y envolverlo en un `View className="flex-1"` en su lugar, ajustando el `nativeID`/`testID` de ese wrapper).

- [ ] **Step 2: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/team/group-list-editor.jsx
git commit -m "feat(teams): show default group preview first, redesign group form as 2 columns"
```

---

### Task 7: `team-detail-screen.jsx` — grupos: lista primero, default primero, form de agregar después

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: nada nuevo.

- [ ] **Step 1: Ordenar `team.groups` con el default primero**

Localizar el `.map` de la lista de grupos:

```jsx
      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
        {team.groups.map((group) => (
```

Reemplazar por (ordenar sin mutar el array original):

```jsx
      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
        {[...team.groups].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((group) => (
```

(cerrar el paréntesis de más al final del `.map` según corresponda — el resto del JSX interno del `.map` no cambia).

- [ ] **Step 2: Mover la lista antes del formulario de agregar**

Localizar el bloque completo de `gruposContent` — hoy el orden es: form de agregar (`{addGroupVisible && (...)}`) primero, lista de grupos (`<View ...team-detail-groups-list...>`) después. Invertir el orden: mover el `<View ...gap-2" nativeID="team-detail-groups-list"...>...</View>` (con el `.sort()` ya aplicado en el Step 1) para que quede ANTES del bloque `{addGroupVisible && (...)}`, dentro del mismo `<SectionCard>`. El contenido de ambos bloques no cambia, solo el orden en el JSX.

- [ ] **Step 3: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(teams): show existing groups before the add-group form, default group always first"
```

---

### Task 8: Vaciar catálogo de planes de entrenamiento + documentar gap de búsqueda de usuarios

**Files:**
- Modify: `store/team-store.js`
- Modify: `docs/BACKEND_API_GAPS.md`

**Interfaces:**
- Consumes: nada.

- [ ] **Step 1: Vaciar `TRAINING_PLAN_OPTIONS`**

Localizar en `store/team-store.js`:

```js
// Sin dominio de planes de entrenamiento todavia (ver FUNCTIONAL_PROPOSE.md,
// "Planificacion de entrenamientos" sigue siendo un modulo reservado, no
// implementado) — catalogo mock compartido por el wizard de creacion y la
// pantalla de detalle (pestaña Grupos), hasta que exista ese servicio real.
export const TRAINING_PLAN_OPTIONS = [
  { id: 'plan-5k', name: 'Plan 5K' },
  { id: 'plan-10k', name: 'Plan 10K' },
  { id: 'plan-21k', name: 'Plan 21K (medio maratón)' },
  { id: 'plan-42k', name: 'Plan 42K (maratón)' },
];
```

Reemplazar por:

```js
// Sin dominio de planes de entrenamiento todavia — antes había un catálogo
// mock fijo acá (4 planes inventados), se sacó por decisión explícita del
// usuario (2026-08-02): el selector de plan sigue en la UI (no se elimina
// el campo) pero sin opciones fantasma hasta que exista un backend real de
// planes (bloqueado además por el módulo de cobros/suscripciones, en
// desarrollo en paralelo por otro miembro del equipo — ver
// docs/BACKEND_API_GAPS.md gap 4).
export const TRAINING_PLAN_OPTIONS = [];
```

- [ ] **Step 2: Actualizar gap 4 en `docs/BACKEND_API_GAPS.md`**

Localizar la sección `## 4. Sin campo de plan de entrenamiento en el grupo` y actualizar la línea de "Workaround actual":

```
- **Workaround actual:** `TRAINING_PLAN_OPTIONS` en `store/team-store.js`, catálogo fijo sin persistencia real.
```

por:

```
- **Workaround actual (actualizado 2026-08-02):** el selector de plan sigue en la UI (grupo, tanto en el wizard de creación como al editar un grupo existente), pero `TRAINING_PLAN_OPTIONS` en `store/team-store.js` pasó de un catálogo mock de 4 planes a un array vacío — decisión explícita del usuario de no mostrar opciones fantasma. El selector queda sin opciones hasta que exista un backend real de planes.
```

- [ ] **Step 3: Documentar gap nuevo de búsqueda de usuarios**

Agregar al final de `docs/BACKEND_API_GAPS.md`:

```markdown

## 10. Sin búsqueda de usuarios por nombre/email parcial

- **Qué hace falta:** un endpoint de búsqueda (ej. `GET /users/search?q=`) que devuelva coincidencias parciales por nombre o email.
- **Por qué:** al invitar corredores, sería útil sugerir usuarios ya registrados a medida que se tipea el email (autocompletar). Hoy solo existe `GET /auth/user?id=`/`?email=` — lookup exacto, sin buscar por texto parcial.
- **A qué bloquea:** cualquier UI de autocompletar/sugerir usuarios al invitar — no se puede construir sin este endpoint.
- **Workaround actual:** ninguno — el campo de invitar sigue siendo un input de email libre, sin sugerencias.
- **Estado:** abierto.
```

- [ ] **Step 4: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 5: Commit**

```bash
git add store/team-store.js docs/BACKEND_API_GAPS.md
git commit -m "feat(teams): empty the training-plan catalog (no more fake options), document user-search gap"
```

---

## Después de este plan

Queda pendiente, para un ciclo aparte (Plan B, no arrancado): roster real de corredores (`GET /teams/{id}/users` + `GET /groups/{id}/users` + resolución de nombre/email vía `GET /auth/user?id=` en paralelo, con el N+1 aceptado por el usuario), que reemplaza `generateMockMembers`/`MOCK_ROSTER_SIZE`/etc. en `store/team-store.js`, y las estadísticas de equipo (`MOCK_TEAM_METRICS`), que siguen esperando por decisión ya tomada.
