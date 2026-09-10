# Alta de grupos e invitaciones vía modal — Plan de implementación

> **Para agentes:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Objetivo:** Reemplazar los 4 puntos de alta (form inline de grupo en el wizard, form inline de grupo en team-detail, fila compacta de invitación en el wizard, fila compacta de invitación en invite-team-members-screen) por dos modales compartidos (`CreateGroupModal`, `InviteMemberModal`), con un botón "+" circular como disparador en los 4 lugares.

**Arquitectura:** Mismo patrón que `CreateExerciseModal`/`CreateSessionModal` — modal con `useFormDirty`/`useUnsavedChangesGuard`, backdrop-close obligatorio (CLAUDE.md). El modal no sabe si el submit es staged (array local) o real (mutación contra el backend) — recibe `onSubmit(values) → {success, error?}` del caller y no muestra toasts de éxito (eso queda a cargo del caller, porque el modo staged no quiere toast y el real sí). `InviteMemberModal` es autocontenido respecto al autocompletado de email (monta su propio `useEmailSuggestions`/`AnimatedDropdown` anclado a su propia card) — el mecanismo actual, anclado a la raíz de cada pantalla, queda atrapado detrás del backdrop si el form se mueve adentro de un modal.

**Tech Stack:** React Native / NativeWind, mismos hooks/servicios ya existentes (`hooks/use-groups.js`, `hooks/use-email-suggestions.js`, `services/groups.js`) — sin cambios ahí.

**Spec:** `docs/superpowers/specs/2026-09-10-group-invite-creation-modals-design.md`

## Global Constraints

- Todo `Modal` con backdrop cierra al clickear afuera (regla obligatoria de `CLAUDE.md`, ya cubierta por el patrón que se copia de `CreateExerciseModal`).
- Los modales nuevos NO muestran `Toast.show` de éxito — esa responsabilidad es del `onSubmit` que pasa cada caller. Sí muestran el error inline si `onSubmit` devuelve `{success:false, error}`.
- Todo componente visual nuevo lleva `nativeID`/`testID` (regla obligatoria, enforcement automático vía `local/require-native-id`).
- Sin tests de render de componentes — verificación manual en preview (web) + nota de verificación en device real para el posicionamiento del autocompletado (ver Task 8).

---

### Task 1: `components/team/create-group-modal.jsx`

**Files:**
- Create: `components/team/create-group-modal.jsx`

**Interfaces:**
- Produces: `CreateGroupModal({ visible, onClose, onSubmit, existingNames = [], planOptions })`. `onSubmit({ name, description, trainingPlanId }) → Promise<{ success: boolean, error?: string }>`.

- [ ] **Step 1: Crear el archivo completo**

```jsx
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { InputField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';

// Alta de grupo — modal compartido por 2 contextos: el wizard de creación
// de equipo (create-team-screen.jsx, vía group-list-editor.jsx, donde el
// equipo todavía no existe y el grupo queda "staged" en un array local) y
// team-detail-screen.jsx (equipo real, crea contra el backend). El modal
// no sabe cuál de los dos es — solo llama a `onSubmit` y cierra si
// devuelve success. Feedback de éxito (toast) queda a cargo del caller,
// no del modal — el modo staged no quiere toast, el modo real sí.
export function CreateGroupModal({ visible, onClose, onSubmit, existingNames = [], planOptions }) {
  const colors = useThemeColors();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trainingPlanId, setTrainingPlanId] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetKey = String(visible);
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  // Limpia el form cada vez que el modal se abre — mismo criterio que
  // CreateExerciseModal (ver ese archivo para el porqué del ajuste
  // síncrono durante el render, no en un useEffect).
  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setName('');
    setDescription('');
    setTrainingPlanId('');
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? { name: '', description: '', trainingPlanId: '' } : { name, description, trainingPlanId };
  const formDirty = useFormDirty(dirtyValues, 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresá un nombre para el grupo.');
      return;
    }
    if (existingNames.includes(trimmed.toLowerCase())) {
      setError('Ya existe un grupo con ese nombre.');
      return;
    }
    setSubmitting(true);
    const result = await onSubmit({ name: trimmed, description: description.trim() || null, trainingPlanId: trainingPlanId || null });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal animationType="fade" nativeID="create-group-modal" onRequestClose={handleClose} testID="create-group-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-group-modal-backdrop" onPress={handleClose} testID="create-group-modal-backdrop">
          <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-group-modal-card" onPress={() => {}} testID="create-group-modal-card">
            <View className="mb-4 flex-row items-center gap-2" nativeID="create-group-modal-header" testID="create-group-modal-header">
              <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-group-modal-title" testID="create-group-modal-title">
                Nuevo grupo
              </Text>
            </View>

            <View className="gap-3" nativeID="create-group-modal-fields" testID="create-group-modal-fields">
              <InputField autoFocus={!isWeb && visible} className="mb-0" dense error={error} label="Nombre del grupo" onChange={(text) => { setName(text); if (error) setError(null); }} placeholder="Ej. Grupo avanzado" value={name} />
              <ResponsiveSelectField
                className="mb-0"
                dense
                hideErrorRow
                label="Plan de entrenamiento"
                onChange={setTrainingPlanId}
                options={planOptions}
                placeholder={planOptions.length === 0 ? 'Sin planes disponibles todavía' : 'Sin plan asignado'}
                value={trainingPlanId}
              />
              <InputField className="mb-0" dense hideErrorRow label="Descripción" multiline numberOfLines={3} onChange={setDescription} placeholder="Ej. Corredores con mayor volumen y ritmo." value={description} />
            </View>

            <View className="mt-3 flex-row gap-3" nativeID="create-group-modal-actions" testID="create-group-modal-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={submitting}
                nativeID="create-group-modal-cancel-button"
                onPress={handleClose}
                testID="create-group-modal-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="create-group-modal-cancel-label" testID="create-group-modal-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                disabled={submitting}
                nativeID="create-group-modal-confirm-button"
                onPress={handleSubmit}
                testID="create-group-modal-confirm-button"
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-group-modal-confirm-label" testID="create-group-modal-confirm-label">
                    Crear
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx eslint components/team/create-group-modal.jsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/team/create-group-modal.jsx
git commit -m "feat(teams): add CreateGroupModal shared component"
```

---

### Task 2: `components/team/invite-member-modal.jsx`

**Files:**
- Create: `components/team/invite-member-modal.jsx`

**Interfaces:**
- Consumes: `useEmailSuggestions` de `hooks/use-email-suggestions.js` (ya existe, sin cambios), `UserSuggestionsList`/`INPUT_CLASS` de `components/forms/fields.jsx` (ya existen).
- Produces: `InviteMemberModal({ visible, onClose, onSubmit, groups = [], existingEmails = [] })`. `onSubmit({ email, groupId }) → Promise<{ success: boolean, error?: string }>`.

- [ ] **Step 1: Crear el archivo completo**

```jsx
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { validateEmailFormat } from '../../utils/email-validators.js';
import { INPUT_CLASS, UserSuggestionsList } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { useEmailSuggestions } from '../../hooks/use-email-suggestions.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';

// Alta de invitación — modal compartido por 2 contextos: el paso 3 del
// wizard de creación de equipo (create-team-screen.jsx, equipo todavía no
// existe) e invite-team-members-screen.jsx (equipo real). En los dos
// casos el submit real (POST) no pasa acá — ambos callers acumulan en un
// array local y mandan recién al crear el equipo / tocar "Enviar
// invitaciones". Autocontenido respecto al autocompletado de email
// (monta su propio useEmailSuggestions/AnimatedDropdown anclado a su
// propia card, con `ref={cardRef}` en la card del modal) — ver
// docs/superpowers/specs/2026-09-10-group-invite-creation-modals-design.md
// para el porqué: si el dropdown de sugerencias se ancla a la raíz de la
// pantalla (como hacía EmailInviteForm) en vez de al modal, queda
// atrapado visualmente detrás del backdrop.
export function InviteMemberModal({ visible, onClose, onSubmit, groups = [], existingEmails = [] }) {
  const colors = useThemeColors();
  const cardRef = useRef(null);
  const { draft, suggestions, showSuggestions, anchor, inputWrapperRef, handleChange, handleFocus, selectSuggestion, close: closeSuggestions, resetDraft } = useEmailSuggestions(cardRef);

  const defaultGroupId = groups.find((g) => g.isDefault)?.id ?? '';
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetKey = String(visible);
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    resetDraft();
    setGroupId(defaultGroupId);
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? { draft: '', groupId: defaultGroupId } : { draft, groupId };
  const formDirty = useFormDirty(dirtyValues, 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const email = draft.trim();
    if (!email) return;
    if (!validateEmailFormat(email)) {
      setError('Email inválido');
      return;
    }
    if (existingEmails.includes(email)) {
      setError('Ya agregaste ese email');
      return;
    }
    setSubmitting(true);
    const result = await onSubmit({ email, groupId });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal animationType="fade" nativeID="invite-member-modal" onRequestClose={handleClose} testID="invite-member-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="invite-member-modal-backdrop" onPress={handleClose} testID="invite-member-modal-backdrop">
          <Pressable className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="invite-member-modal-card" onPress={() => {}} ref={cardRef} testID="invite-member-modal-card">
            <View className="mb-4 flex-row items-center gap-2" nativeID="invite-member-modal-header" testID="invite-member-modal-header">
              <MaterialCommunityIcons color={colors.primary} name="account-plus" size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="invite-member-modal-title" testID="invite-member-modal-title">
                Invitar corredor
              </Text>
            </View>

            <View className="gap-3" nativeID="invite-member-modal-fields" testID="invite-member-modal-fields">
              <View nativeID="invite-member-modal-email-wrapper" testID="invite-member-modal-email-wrapper">
                <View
                  className={`h-12 flex-row items-center rounded-xl border ${error ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}
                  nativeID="invite-member-modal-email-input-wrapper"
                  ref={inputWrapperRef}
                  testID="invite-member-modal-email-input-wrapper"
                >
                  <TextInput
                    autoCapitalize="none"
                    autoFocus={!isWeb && visible}
                    className={INPUT_CLASS}
                    keyboardType="email-address"
                    nativeID="invite-member-modal-email-input"
                    onChangeText={(text) => { handleChange(text); if (error) setError(null); }}
                    onFocus={handleFocus}
                    onSubmitEditing={handleSubmit}
                    placeholder="Email del corredor"
                    placeholderTextColor={colors.onSurfaceVariant}
                    returnKeyType="done"
                    testID="invite-member-modal-email-input"
                    value={draft}
                  />
                </View>
                {error && (
                  <Text className="mt-1 text-xs text-red-500 dark:text-red-400" nativeID="invite-member-modal-email-error" testID="invite-member-modal-email-error">
                    {error}
                  </Text>
                )}
              </View>

              {groups.length > 1 && (
                <ResponsiveSelectField
                  className="mb-0"
                  dense
                  hideErrorRow
                  label="Grupo"
                  onChange={setGroupId}
                  options={groups}
                  placeholder="Sin grupo asignado"
                  value={groupId}
                />
              )}
            </View>

            <View className="mt-3 flex-row gap-3" nativeID="invite-member-modal-actions" testID="invite-member-modal-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={submitting}
                nativeID="invite-member-modal-cancel-button"
                onPress={handleClose}
                testID="invite-member-modal-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="invite-member-modal-cancel-label" testID="invite-member-modal-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                disabled={submitting}
                nativeID="invite-member-modal-confirm-button"
                onPress={handleSubmit}
                testID="invite-member-modal-confirm-button"
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-member-modal-confirm-label" testID="invite-member-modal-confirm-label">
                    Agregar
                  </Text>
                )}
              </Pressable>
            </View>

            <AnimatedDropdown
              anchorStyle={{ left: anchor.x, top: anchor.y + anchor.height + 4, width: anchor.width }}
              onClose={closeSuggestions}
              open={showSuggestions}
            >
              <UserSuggestionsList onSelect={selectSuggestion} scope="invite-member-modal" suggestions={suggestions} />
            </AnimatedDropdown>
          </Pressable>
        </Pressable>
      </Modal>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
```

(Nota: la card tiene `className="relative ..."` explícito, a diferencia de `CreateGroupModal` — acá sí importa dejarlo explícito porque `AnimatedDropdown` es hijo directo de la card y necesita esa card como su ancestro posicionado para que `absolute inset-0` la tome como referencia; en el resto de los modales del proyecto `relative` ya sale gratis del default de React Native Web, pero dejarlo explícito acá documenta la dependencia real en vez de confiar en un default implícito.)

- [ ] **Step 2: Verificar**

Run: `npx eslint components/team/invite-member-modal.jsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/team/invite-member-modal.jsx
git commit -m "feat(teams): add InviteMemberModal shared component"
```

---

### Task 3: Migrar `group-list-editor.jsx` a lista + botón

**Files:**
- Modify: `components/team/group-list-editor.jsx`

**Interfaces:**
- Consumes: `CreateGroupModal` (Task 1).

- [ ] **Step 1: Reemplazar el archivo completo**

```jsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { CreateGroupModal } from './create-group-modal.jsx';

// Lista de grupos de un equipo en el paso "Grupos" del wizard de creación
// (create-team-screen.jsx, sobre datos en borrador — el equipo todavía no
// existe). El grupo principal primero (fila fija, sin botón eliminar — el
// backend lo crea automáticamente vía create_default_group al crear el
// equipo, acá es solo un preview, no tiene id real todavía), después cada
// grupo extra ya agregado, con botón de eliminar. El alta pasa por
// CreateGroupModal (botón "+" arriba de la lista) — acá solo se agrega al
// array local `groups`, sin pegarle a ningún servicio.
export function GroupListEditor({ groups, onChange, onRemove, planOptions }) {
  const colors = useThemeColors();
  const [modalVisible, setModalVisible] = useState(false);

  const handleRemove = (groupId) => {
    onChange(groups.filter((g) => g.id !== groupId));
    onRemove?.(groupId);
  };

  return (
    <View nativeID="group-list-editor" testID="group-list-editor">
      <View className="mb-3 flex-row items-center justify-between" nativeID="group-list-editor-header" testID="group-list-editor-header">
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="group-list-editor-header-label" testID="group-list-editor-header-label">
          Grupos agregados
        </Text>
        <Pressable
          accessibilityLabel="Agregar grupo"
          className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="group-list-editor-add-button"
          onPress={() => setModalVisible(true)}
          testID="group-list-editor-add-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
        </Pressable>
      </View>

      <View className="gap-2" nativeID="group-list-editor-list" testID="group-list-editor-list">
        <View
          className="flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary-tint-subtle px-4 py-3 dark:border-primary/20 dark:bg-primary/10"
          nativeID="group-list-editor-default-row"
          testID="group-list-editor-default-row"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID="group-list-editor-default-row-icon" testID="group-list-editor-default-row-icon">
            <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={18} />
          </View>
          <View className="flex-1" nativeID="group-list-editor-default-row-info" testID="group-list-editor-default-row-info">
            <View className="flex-row items-center gap-2" nativeID="group-list-editor-default-row-name-wrapper" testID="group-list-editor-default-row-name-wrapper">
              <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="group-list-editor-default-row-name" testID="group-list-editor-default-row-name">
                Grupo principal
              </Text>
              <View className="rounded-full bg-primary/15 px-2 py-0.5 dark:bg-primary/25" nativeID="group-list-editor-default-row-badge" testID="group-list-editor-default-row-badge">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-primary" nativeID="group-list-editor-default-row-badge-label" testID="group-list-editor-default-row-badge-label">
                  Fijo
                </Text>
              </View>
            </View>
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="group-list-editor-default-row-hint" testID="group-list-editor-default-row-hint">
              Se crea automáticamente con el equipo — todo corredor sin grupo elegido cae acá.
            </Text>
          </View>
        </View>

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

      <CreateGroupModal
        existingNames={groups.map((g) => g.name.toLowerCase())}
        onClose={() => setModalVisible(false)}
        onSubmit={async ({ name, description, trainingPlanId }) => {
          onChange([...groups, { id: `group-draft-${Date.now()}`, name, description, trainingPlanId }]);
          return { success: true };
        }}
        planOptions={planOptions}
        visible={modalVisible}
      />
    </View>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx eslint components/team/group-list-editor.jsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/team/group-list-editor.jsx
git commit -m "feat(teams): migrate GroupListEditor to list + CreateGroupModal"
```

---

### Task 4: Migrar `team-detail-screen.jsx` — grupos

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `CreateGroupModal` (Task 1).

- [ ] **Step 1: Actualizar imports**

Reemplazar:
```js
import { InputField, InlinePicker, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
```
por:
```js
import { InlinePicker, Row, Col } from '../forms/fields.jsx';
```
(se elimina el import de `ResponsiveSelectField` — su único uso en este archivo estaba en el form inline que se borra en este task; `InputField` también se va del import de `fields.jsx` por el mismo motivo, pero `InlinePicker`/`Row`/`Col` siguen usándose en otras partes del archivo, sin tocar.)

Agregar el import del modal nuevo, junto a los demás imports de `./`:
```js
import { CreateGroupModal } from './create-group-modal.jsx';
```

- [ ] **Step 2: Eliminar el estado del form inline**

Reemplazar:
```js
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [addGroupVisible, setAddGroupVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupPlan, setNewGroupPlan] = useState('');
  const [newGroupError, setNewGroupError] = useState(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
```
por:
```js
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
```

- [ ] **Step 3: Eliminar `handleAddGroup`**

Eliminar por completo (queda reemplazado por el `onSubmit` inline del modal en el Step 5):
```js
  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setNewGroupError('Ingresá un nombre para el grupo.');
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewGroupError('Ya existe un grupo con ese nombre.');
      return;
    }
    setAddingGroup(true);
    const result = await createGroupInTeam({ name: trimmed, description: newGroupDescription.trim() || null, trainingPlanId: newGroupPlan || null });
    setAddingGroup(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos crear el grupo', text2: result.error });
      return;
    }
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupPlan('');
    setNewGroupError(null);
    setAddGroupVisible(false);
    Toast.show({ type: 'success', text1: 'Grupo creado' });
  };
```

- [ ] **Step 4: Reemplazar el header y el form inline de `gruposContent`**

Reemplazar:
```jsx
  const gruposContent = isTrainerView && (
    <SectionCard
      headerRight={canManageTeam && (
        <Pressable
          accessibilityLabel="Agregar grupo"
          className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          nativeID="team-detail-add-group-button"
          onPress={() => setAddGroupVisible((v) => !v)}
          testID="team-detail-add-group-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
        </Pressable>
      )}
      icon="account-group"
      title="Grupos"
    >
      {addGroupVisible && (
        <View className="mb-6 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="team-detail-add-group-form" testID="team-detail-add-group-form">
          <Row>
            <Col>
              <InputField
                dense
                error={newGroupError}
                label="Nombre del grupo"
                onChange={(text) => { setNewGroupName(text); if (newGroupError) setNewGroupError(null); }}
                placeholder="Ej. Grupo avanzado"
                value={newGroupName}
              />
              <ResponsiveSelectField
                dense
                label="Plan de entrenamiento"
                onChange={setNewGroupPlan}
                options={TRAINING_PLAN_OPTIONS}
                placeholder={TRAINING_PLAN_OPTIONS.length === 0 ? 'Sin planes disponibles todavía' : 'Sin plan asignado'}
                value={newGroupPlan}
              />
            </Col>
            <Col>
              <View className="flex-1" nativeID="team-detail-add-group-description-wrapper" testID="team-detail-add-group-description-wrapper">
                <InputField
                  dense
                  label="Descripción del grupo"
                  multiline
                  numberOfLines={5}
                  onChange={setNewGroupDescription}
                  placeholder="Ej. Corredores con mayor volumen y ritmo."
                  value={newGroupDescription}
                />
              </View>
            </Col>
          </Row>
          <Pressable
            className="h-10 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-5 hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={addingGroup}
            nativeID="team-detail-add-group-submit"
            onPress={handleAddGroup}
            testID="team-detail-add-group-submit"
          >
            {addingGroup ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="team-detail-add-group-submit-label" testID="team-detail-add-group-submit-label">
                Crear grupo
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
```
por:
```jsx
  const gruposContent = isTrainerView && (
    <SectionCard
      headerRight={canManageTeam && (
        <Pressable
          accessibilityLabel="Agregar grupo"
          className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          nativeID="team-detail-add-group-button"
          onPress={() => setCreateGroupModalVisible(true)}
          testID="team-detail-add-group-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
        </Pressable>
      )}
      icon="account-group"
      title="Grupos"
    >
      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
```

(El resto del bloque — el `.map` de `groups` con `GroupRow`, el cierre `</View></SectionCard>` — no cambia, queda tal cual está hoy.)

- [ ] **Step 5: Montar `CreateGroupModal` junto a los demás modales de la pantalla**

Localizar el bloque de modales cerca del final del JSX (`{canDeleteTeam && (<DeleteTeamModal .../>)}`, `{runnerMenuMember && (...)}`, `{canLeaveGroup && (...)}`) y agregar, en el mismo nivel:
```jsx
      {canManageTeam && (
        <CreateGroupModal
          existingNames={groups.map((g) => g.name.toLowerCase())}
          onClose={() => setCreateGroupModalVisible(false)}
          onSubmit={async ({ name, description, trainingPlanId }) => {
            const result = await createGroupInTeam({ name, description, trainingPlanId });
            if (result.success) Toast.show({ type: 'success', text1: 'Grupo creado' });
            return result;
          }}
          planOptions={TRAINING_PLAN_OPTIONS}
          visible={createGroupModalVisible}
        />
      )}
```

- [ ] **Step 6: Verificar**

Run: `npx eslint components/team/team-detail-screen.jsx`
Expected: sin errores. Si el linter marca `ActivityIndicator`/`Row`/`Col` sin uso, revisar el resto del archivo antes de sacarlos del import — `Row`/`Col` se usan en otras secciones (confirmado en la exploración, líneas ~870-886), `ActivityIndicator` probablemente también (loading states de la pantalla) — no deberían quedar sin uso, pero confirmar con el propio linter.

- [ ] **Step 7: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(teams): migrate team-detail-screen.jsx group creation to CreateGroupModal"
```

---

### Task 5: Migrar `create-team-screen.jsx` — invitaciones (paso 3)

**Files:**
- Modify: `components/team/create-team-screen.jsx`

**Interfaces:**
- Consumes: `InviteMemberModal` (Task 2).

- [ ] **Step 1: Actualizar imports**

Reemplazar:
```js
import { EmailInviteForm, InvitedEmailsList, UserSuggestionsList } from '../forms/fields.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { useEmailSuggestions } from '../../hooks/use-email-suggestions.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { GroupListEditor } from './group-list-editor.jsx';
import { useTeamGeneralInfoForm } from '../../hooks/use-team-general-info-form.js';
import { TeamGeneralInfoFields } from './team-general-info-fields.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
```
por:
```js
import { InvitedEmailsList } from '../forms/fields.jsx';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { GroupListEditor } from './group-list-editor.jsx';
import { InviteMemberModal } from './invite-member-modal.jsx';
import { useTeamGeneralInfoForm } from '../../hooks/use-team-general-info-form.js';
import { TeamGeneralInfoFields } from './team-general-info-fields.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
```

- [ ] **Step 2: Eliminar `containerRef`/`emailSearch` y agregar el estado del modal**

Reemplazar:
```js
  // Raíz de la pantalla — ancla el AnimatedDropdown de sugerencias de
  // EmailInviteForm (ver hooks/use-email-suggestions.js).
  const containerRef = useRef(null);
  const emailSearch = useEmailSuggestions(containerRef);

  const [step, setStep] = useState(1);
```
por:
```js
  const [step, setStep] = useState(1);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
```

Quitar `useRef` del import de React si queda sin otro uso en el archivo (`import { useRef, useState } from 'react';` → `import { useState } from 'react';`) — confirmar con el linter en el Step 5.

- [ ] **Step 3: Reemplazar el paso 3 completo**

Reemplazar:
```jsx
        {step === 3 && (
          <>
            <SectionCard icon="email-outline" title="Invitar corredores">
              <EmailInviteForm emailSearch={emailSearch} existingEmails={invitedEmails.map((invite) => invite.email)} groups={groupsForInvite} onAdd={(invite) => setInvitedEmails((prev) => [...prev, invite])} placeholder="Email del corredor" />
            </SectionCard>

            <SectionCard icon="account-multiple-check" title="Corredores a invitar">
              <InvitedEmailsList groups={groupsForInvite} onChange={setInvitedEmails} value={invitedEmails} />

              <StepNav disabled={submitting} loading={submitting} nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
            </SectionCard>
          </>
        )}
```
por:
```jsx
        {step === 3 && (
          <>
            <SectionCard
              headerRight={(
                <Pressable
                  accessibilityLabel="Invitar corredor"
                  className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
                  nativeID="create-team-invite-add-button"
                  onPress={() => setInviteModalVisible(true)}
                  testID="create-team-invite-add-button"
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
                </Pressable>
              )}
              icon="account-multiple-check"
              title="Corredores a invitar"
            >
              <InvitedEmailsList groups={groupsForInvite} onChange={setInvitedEmails} value={invitedEmails} />

              <StepNav disabled={submitting} loading={submitting} nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
            </SectionCard>

            <InviteMemberModal
              existingEmails={invitedEmails.map((invite) => invite.email)}
              groups={groupsForInvite}
              onClose={() => setInviteModalVisible(false)}
              onSubmit={async (invite) => {
                setInvitedEmails((prev) => [...prev, invite]);
                return { success: true };
              }}
              visible={inviteModalVisible}
            />
          </>
        )}
```

- [ ] **Step 4: Eliminar el `AnimatedDropdown` de sugerencias montado a nivel de pantalla, y simplificar el `View` raíz**

Reemplazar:
```jsx
  return (
    <View className="relative flex-1" nativeID="create-team-screen-root" ref={containerRef} testID="create-team-screen-root">
    <ScrollView
```
por:
```jsx
  return (
    <View className="flex-1" nativeID="create-team-screen-root" testID="create-team-screen-root">
    <ScrollView
```

Reemplazar (cierre del archivo, después de `</ScrollView>`):
```jsx
    </ScrollView>
    <AnimatedDropdown
      anchorStyle={{ left: emailSearch.anchor.x, top: emailSearch.anchor.y + emailSearch.anchor.height + 4, width: emailSearch.anchor.width }}
      onClose={emailSearch.close}
      open={emailSearch.showSuggestions}
    >
      <UserSuggestionsList onSelect={emailSearch.selectSuggestion} scope="create-team-invite" suggestions={emailSearch.suggestions} />
    </AnimatedDropdown>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </View>
  );
```
por:
```jsx
    </ScrollView>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </View>
  );
```

- [ ] **Step 5: Verificar**

Run: `npx eslint components/team/create-team-screen.jsx`
Expected: sin errores — ajustar el import de `react` (Step 2) según lo que marque el linter.

- [ ] **Step 6: Commit**

```bash
git add components/team/create-team-screen.jsx
git commit -m "feat(teams): migrate create-team-screen.jsx step 3 to InviteMemberModal"
```

---

### Task 6: Migrar `invite-team-members-screen.jsx`

**Files:**
- Modify: `components/team/invite-team-members-screen.jsx`

**Interfaces:**
- Consumes: `InviteMemberModal` (Task 2).

- [ ] **Step 1: Actualizar imports**

Reemplazar:
```js
import { SectionCard } from '../forms/section-card.jsx';
import { EmailInviteForm, InvitedEmailsList, UserSuggestionsList } from '../forms/fields.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { useEmailSuggestions } from '../../hooks/use-email-suggestions.js';
```
por:
```js
import { SectionCard } from '../forms/section-card.jsx';
import { InvitedEmailsList } from '../forms/fields.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { InviteMemberModal } from './invite-member-modal.jsx';
```

- [ ] **Step 2: Eliminar `containerRef`/`emailSearch` y agregar el estado del modal**

Reemplazar:
```js
  // Raíz de la pantalla — ancla el AnimatedDropdown de sugerencias de
  // EmailInviteForm (ver hooks/use-email-suggestions.js).
  const containerRef = useRef(null);
  const emailSearch = useEmailSuggestions(containerRef);

  const [draftInvites, setDraftInvites] = useState([]);
  const [sending, setSending] = useState(false);
```
por:
```js
  const [draftInvites, setDraftInvites] = useState([]);
  const [sending, setSending] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
```

Quitar `useRef` del import de React si queda sin otro uso (`import { useRef, useState } from 'react';` → `import { useState } from 'react';`) — confirmar con el linter en el Step 5.

- [ ] **Step 3: Reemplazar el card de invitar por el botón "+" en el header del card de la lista**

Reemplazar:
```jsx
        <SectionCard icon="account-plus-outline" title="Invitar más corredores">
          <EmailInviteForm emailSearch={emailSearch} existingEmails={draftInvites.map((invite) => invite.email)} groups={groups} onAdd={(invite) => setDraftInvites((prev) => [...prev, invite])} placeholder="Email del corredor" />
        </SectionCard>

        <SectionCard icon="account-multiple-check" title="Corredores a invitar">
          <InvitedEmailsList groups={groups} onChange={setDraftInvites} value={draftInvites} />

          <Pressable
```
por:
```jsx
        <SectionCard
          headerRight={(
            <Pressable
              accessibilityLabel="Invitar corredor"
              className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
              nativeID="invite-team-invite-add-button"
              onPress={() => setInviteModalVisible(true)}
              testID="invite-team-invite-add-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
            </Pressable>
          )}
          icon="account-multiple-check"
          title="Corredores a invitar"
        >
          <InvitedEmailsList groups={groups} onChange={setDraftInvites} value={draftInvites} />

          <Pressable
```

(El resto del `Pressable` de "Enviar invitaciones" y el cierre `</SectionCard>` no cambian.)

- [ ] **Step 4: Montar `InviteMemberModal`, eliminar el `AnimatedDropdown` de sugerencias y simplificar el `View` raíz**

Reemplazar:
```jsx
  return (
    <View className="relative flex-1" nativeID="invite-team-screen-root" ref={containerRef} testID="invite-team-screen-root">
    <ScrollView
```
por:
```jsx
  return (
    <View className="flex-1" nativeID="invite-team-screen-root" testID="invite-team-screen-root">
    <ScrollView
```

Reemplazar el cierre del archivo:
```jsx
    </ScrollView>
    <AnimatedDropdown
      anchorStyle={{ left: emailSearch.anchor.x, top: emailSearch.anchor.y + emailSearch.anchor.height + 4, width: emailSearch.anchor.width }}
      onClose={emailSearch.close}
      open={emailSearch.showSuggestions}
    >
      <UserSuggestionsList onSelect={emailSearch.selectSuggestion} scope="invite-team-invite" suggestions={emailSearch.suggestions} />
    </AnimatedDropdown>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </View>
  );
```
por:
```jsx
    </ScrollView>
    <InviteMemberModal
      existingEmails={draftInvites.map((invite) => invite.email)}
      groups={groups}
      onClose={() => setInviteModalVisible(false)}
      onSubmit={async (invite) => {
        setDraftInvites((prev) => [...prev, invite]);
        return { success: true };
      }}
      visible={inviteModalVisible}
    />
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </View>
  );
```

- [ ] **Step 5: Verificar**

Run: `npx eslint components/team/invite-team-members-screen.jsx`
Expected: sin errores — ajustar el import de `react` (Step 2) según lo que marque el linter.

- [ ] **Step 6: Commit**

```bash
git add components/team/invite-team-members-screen.jsx
git commit -m "feat(teams): migrate invite-team-members-screen.jsx to InviteMemberModal"
```

---

### Task 7: Eliminar `EmailInviteForm` de `components/forms/fields.jsx`

**Files:**
- Modify: `components/forms/fields.jsx`

- [ ] **Step 1: Confirmar que no queda ningún consumidor**

Run:
```bash
grep -rn "EmailInviteForm" components/ app/
```
Expected: sin resultados (fuera de la propia definición, que se borra en el siguiente paso).

- [ ] **Step 2: Eliminar la función completa**

Eliminar el bloque de `EmailInviteForm` entero — desde el comentario que empieza con `// Formulario para agregar un email a la vez...` hasta el `}` de cierre de la función (incluye el comentario largo de autocompletar que está pegado arriba de la firma).

- [ ] **Step 3: Limpiar imports que quedaron sin uso**

Run:
```bash
grep -n "useEffect(\|validateEmailFormat(" components/forms/fields.jsx
```
Expected: sin resultados (ambos solo se usaban dentro de `EmailInviteForm`).

Reemplazar:
```js
import { useEffect, useState } from 'react';
```
por:
```js
import { useState } from 'react';
```

Eliminar la línea:
```js
import { validateEmailFormat } from '../../utils/email-validators.js';
```

- [ ] **Step 4: Verificar**

Run: `npx eslint components/forms/fields.jsx`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/forms/fields.jsx
git commit -m "refactor(forms): remove EmailInviteForm, folded into InviteMemberModal"
```

---

### Task 8: Suite completa, verificación en preview, versión

**Files:**
- Modify: `package.json` (versión)

- [ ] **Step 1: Suite completa**

Run: `npm run lint && npm test`
Expected: ambos en verde.

- [ ] **Step 2: Bump de versión**

Run: `cat package.json | grep '"version"'` para ver la versión actual, bumpear el minor (`0.X.0` → `0.(X+1).0`) — cambio de UX real con flujo nuevo en 4 pantallas, mismo criterio que otras migraciones de flujo real ya hechas en este proyecto.

- [ ] **Step 3: Verificar en preview (web) — flujo completo**

Recorrer:
1. Wizard de creación de equipo: paso 2 (agregar un grupo vía el botón "+", confirmar que aparece en la lista, confirmar el guard de "cambios sin guardar" si se cierra el modal con datos tipeados), paso 3 (agregar una invitación vía el botón "+", con y sin autocompletado de email — escribir 3+ letras de un email existente y confirmar que aparecen sugerencias y se pueden seleccionar).
2. `team-detail-screen.jsx`, pestaña Grupos: agregar un grupo real vía el botón "+" (confirmar que pega contra el backend/mock y aparece en la lista tras cerrar el modal).
3. `/teams/{id}/invite`: agregar una invitación vía el botón "+", confirmar que aparece en "Corredores a invitar", y que "Enviar invitaciones" sigue funcionando igual que antes.
4. En los 4 casos: confirmar que clickear afuera del modal (backdrop) lo cierra, y que si hay datos tipeados sin guardar aparece el modal de descarte en vez de cerrar directo.

- [ ] **Step 4: Nota para verificación en device real (no bloqueante para este plan)**

El posicionamiento del dropdown de autocompletado dentro de `InviteMemberModal` usa `measureLayout` (vía `useEmailSuggestions`), que según `CLAUDE.md` ("Quirks conocidos") no es confiable en Android bajo New Architecture en ciertos casos. El preview web no puede confirmar el comportamiento nativo — dejar anotado (no bloquea el cierre de este plan) que la próxima vez que se pruebe en un device Android real, conviene escribir un email de prueba en el modal de invitar y confirmar que las sugerencias aparecen en la posición correcta. Si falla, la alternativa ya documentada en el proyecto es `measureInWindow` con resta de coordenadas (mismo patrón que `RunnerMenu` en `team-detail-screen.jsx`).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore(teams): version bump for group/invite creation modals

EOF
)"
```

---

## Self-Review

**Cobertura de la spec:** `CreateGroupModal` (Task 1) + sus 2 consumidores (`GroupListEditor` en Task 3, `team-detail-screen.jsx` en Task 4) — cubre los 2 contextos de grupo descriptos en la spec. `InviteMemberModal` (Task 2, con el detalle técnico del autocompletado autocontenido ya resuelto en el propio componente) + sus 2 consumidores (`create-team-screen.jsx` paso 3 en Task 5, `invite-team-members-screen.jsx` en Task 6) — cubre los 2 contextos de invitación. Eliminación de `EmailInviteForm` (Task 7) cubierta explícitamente por la spec ("se elimina — su contenido se funde dentro de InviteMemberModal"). La limpieza de `containerRef`/`emailSearch`/`AnimatedDropdown` a nivel de pantalla (mencionada en la spec como consecuencia de que el autocompletado se autocontenga) está en los Steps 4 de las Tasks 5 y 6.

**Placeholder scan:** sin TBD/TODO. La nota de verificación en device (Task 8 Step 4) es explícitamente "no bloqueante", no una instrucción vaga — está clasificada como verificación posterior, no como parte del criterio de cierre de este plan.

**Consistencia de tipos:** `onSubmit({ name, description, trainingPlanId })` para `CreateGroupModal` se llama igual en Tasks 3 y 4. `onSubmit({ email, groupId })` para `InviteMemberModal` se llama igual en Tasks 5 y 6. Ambos modales devuelven siempre `{ success, error? }`, nunca lanzan — mismo contrato en las 4 implementaciones de `onSubmit` provistas por los callers.
