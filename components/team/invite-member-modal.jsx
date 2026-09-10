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
