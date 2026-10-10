import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { filterByName } from '../../utils/attendance-filter.js';
import { colorForUserId } from '../../utils/participant-color.js';
import { deriveRecipients } from '../../utils/session-message-recipients.js';
import { groupMessagesByThread } from '../../utils/session-message-threads.js';

// Mensajería de sesión en vivo (Gap 27) -- un solo componente para los dos
// roles (prop `role`), compartiendo lista/compose/respuesta rápida. Solo el
// selector de destinatario difiere: el entrenador elige entre varios con
// checkboxes + "Todos"; el corredor elige UNO ("Entrenador" o un compañero
// conectado). Ver docs/superpowers/specs/2026-10-09-live-session-messaging-design.md.

const TYPE_META = {
  info: {
    label: 'Info', icon: 'information-outline', iconColor: '#0284c7',
    bg: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-sky-400 dark:border-sky-600', text: 'text-sky-700 dark:text-sky-300',
  },
  aviso: {
    label: 'Aviso', icon: 'alert-outline', iconColor: '#d97706',
    bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-400 dark:border-amber-600', text: 'text-amber-700 dark:text-amber-400',
  },
  alerta: {
    label: 'Alerta', icon: 'alert-decagram-outline', iconColor: '#dc2626',
    bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-400 dark:border-red-700', text: 'text-red-700 dark:text-red-400',
  },
};

const QUICK_REPLIES = ['Recibido', 'Necesito ayuda', 'Dale, ahí voy'];

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function senderLabel(message, { myUserId, rosterMembers, trainerName }) {
  if (message.senderUserId === String(myUserId)) return 'Vos';
  if (message.senderRole === 'trainer') return trainerName ?? 'Entrenador';
  const member = rosterMembers.find((m) => String(m.userId) === message.senderUserId);
  return member?.name ?? 'Corredor';
}

function recipientSummary(message, { myUserId, rosterMembers, trainerName }) {
  if (message.recipientMode === 'all') return 'Para todos';
  if (message.recipientMode === 'multiple') return `Para ${message.recipientUserIds.length} personas`;
  const onlyId = message.recipientUserIds[0];
  if (onlyId === String(myUserId)) return 'Para vos';
  const member = rosterMembers.find((m) => String(m.userId) === onlyId);
  if (member) return `Para ${member.name}`;
  return trainerName ? `Para ${trainerName}` : 'Directo';
}

function ReplyArea({ idPrefix, onReply, message, replyDisabled }) {
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  if (!open) {
    return (
      <Pressable
        className="mt-1 flex-row items-center gap-1.5 self-start rounded-full px-2 py-1 active:opacity-70"
        disabled={replyDisabled}
        nativeID={`${idPrefix}-reply-toggle`}
        onPress={() => setOpen(true)}
        testID={`${idPrefix}-reply-toggle`}
      >
        <MaterialCommunityIcons color="#64748b" name="reply-outline" size={18} />
        <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-reply-toggle-label`} testID={`${idPrefix}-reply-toggle-label`}>
          Responder
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-1.5 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60" nativeID={`${idPrefix}-reply-card`} testID={`${idPrefix}-reply-card`}>
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-reply-card-header`} testID={`${idPrefix}-reply-card-header`}>
        <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-reply-card-title`} testID={`${idPrefix}-reply-card-title`}>Responder</Text>
        <Pressable nativeID={`${idPrefix}-reply-collapse-button`} onPress={() => setOpen(false)} testID={`${idPrefix}-reply-collapse-button`}>
          <MaterialCommunityIcons color="#64748b" name="chevron-up" size={20} />
        </Pressable>
      </View>
      <View className="flex-row flex-wrap gap-2" nativeID={`${idPrefix}-reply-chips`} testID={`${idPrefix}-reply-chips`}>
        {QUICK_REPLIES.map((chip, index) => (
          <Pressable
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 active:opacity-70 dark:border-slate-700 dark:bg-slate-800"
            disabled={replyDisabled}
            key={chip}
            nativeID={`${idPrefix}-reply-chip-${index}`}
            onPress={() => onReply(chip, message)}
            testID={`${idPrefix}-reply-chip-${index}`}
          >
            <Text className="text-sm font-medium text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-reply-chip-${index}-label`} testID={`${idPrefix}-reply-chip-${index}-label`}>
              {chip}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-reply-input-row`} testID={`${idPrefix}-reply-input-row`}>
        <TextInput
          className="h-12 flex-1 rounded-full border border-slate-200 bg-white px-4 text-base dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          editable={!replyDisabled}
          nativeID={`${idPrefix}-reply-input`}
          onChangeText={setReplyText}
          placeholder="Responder…"
          testID={`${idPrefix}-reply-input`}
          value={replyText}
        />
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-40"
          disabled={replyDisabled || !replyText.trim()}
          nativeID={`${idPrefix}-reply-send-button`}
          onPress={() => { onReply(replyText.trim(), message); setReplyText(''); setOpen(false); }}
          testID={`${idPrefix}-reply-send-button`}
        >
          <MaterialCommunityIcons color="#111518" name="send" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

function MessageRow({ message, idPrefix, myUserId, rosterMembers, trainerName, onReply, replyDisabled }) {
  const meta = TYPE_META[message.type] ?? TYPE_META.info;
  const isMine = message.senderUserId === String(myUserId);

  return (
    <View className="gap-1" nativeID={`${idPrefix}-row`} testID={`${idPrefix}-row`}>
      <View className={`rounded-xl p-3 ${meta.bg}`} nativeID={`${idPrefix}-bubble`} testID={`${idPrefix}-bubble`}>
        <View className="mb-1 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          <View className="flex-row items-center gap-1.5" nativeID={`${idPrefix}-identity`} testID={`${idPrefix}-identity`}>
            <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={16} />
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-sender`} testID={`${idPrefix}-sender`}>
              {senderLabel(message, { myUserId, rosterMembers, trainerName })}
            </Text>
          </View>
          <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-time`} testID={`${idPrefix}-time`}>
            {formatTime(message.createdAt)}
          </Text>
        </View>
        <Text className="text-base text-slate-800 dark:text-slate-100" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
          {message.body}
        </Text>
        <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-recipients`} testID={`${idPrefix}-recipients`}>
          {recipientSummary(message, { myUserId, rosterMembers, trainerName })}
        </Text>
      </View>

      {!isMine && (
        <ReplyArea idPrefix={idPrefix} message={message} onReply={onReply} replyDisabled={replyDisabled} />
      )}
    </View>
  );
}

// Ocultar colapsa a una fila mínima (no borra de la lista) -- "Mostrar" la
// vuelve a expandir. Nunca desaparece del todo: no hay backend para borrar
// un mensaje (Gap 27 sin delete), así que esto es solo una preferencia de
// vista, no se pierde información.
function CollapsedThreadRow({ thread, idPrefix, onToggle }) {
  return (
    <Pressable
      className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 active:opacity-70 dark:border-slate-800 dark:bg-slate-900/40"
      nativeID={`${idPrefix}-thread-${thread.rootId}-collapsed`}
      onPress={onToggle}
      testID={`${idPrefix}-thread-${thread.rootId}-collapsed`}
    >
      <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-thread-${thread.rootId}-collapsed-label`} testID={`${idPrefix}-thread-${thread.rootId}-collapsed-label`}>
        {thread.messages.length} mensaje{thread.messages.length === 1 ? '' : 's'} oculto{thread.messages.length === 1 ? '' : 's'}
      </Text>
      <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-thread-${thread.rootId}-show-button`} testID={`${idPrefix}-thread-${thread.rootId}-show-button`}>
        <MaterialCommunityIcons color="#64748b" name="eye-outline" size={16} />
        <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-thread-${thread.rootId}-show-label`} testID={`${idPrefix}-thread-${thread.rootId}-show-label`}>
          Mostrar
        </Text>
      </View>
    </Pressable>
  );
}

function ThreadCard({ thread, idPrefix, myUserId, rosterMembers, trainerName, onReply, replyDisabled, hidden, onToggleHidden }) {
  if (hidden) {
    return <CollapsedThreadRow idPrefix={idPrefix} onToggle={onToggleHidden} thread={thread} />;
  }
  return (
    <View className="mb-3 gap-2.5 rounded-xl border border-slate-100 p-2.5 dark:border-slate-800" nativeID={`${idPrefix}-thread-${thread.rootId}`} testID={`${idPrefix}-thread-${thread.rootId}`}>
      <Pressable
        className="flex-row items-center gap-1 self-end active:opacity-70"
        nativeID={`${idPrefix}-thread-${thread.rootId}-hide-button`}
        onPress={onToggleHidden}
        testID={`${idPrefix}-thread-${thread.rootId}-hide-button`}
      >
        <MaterialCommunityIcons color="#94a3b8" name="eye-off-outline" size={16} />
        <Text className="text-xs font-medium text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-thread-${thread.rootId}-hide-label`} testID={`${idPrefix}-thread-${thread.rootId}-hide-label`}>
          Ocultar
        </Text>
      </Pressable>
      {thread.messages.map((message) => (
        <MessageRow
          idPrefix={`${idPrefix}-message-${message.id}`}
          key={message.id}
          message={message}
          myUserId={myUserId}
          onReply={onReply}
          replyDisabled={replyDisabled}
          rosterMembers={rosterMembers}
          trainerName={trainerName}
        />
      ))}
    </View>
  );
}

function TrainerRecipientPicker({ idPrefix, rosterMembers, allSelected, setAllSelected, selectedUserIds, setSelectedUserIds }) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const visibleMembers = filterByName(rosterMembers, query);

  // Nunca queda sin destinatario: destildar el último miembro marcado cae de
  // vuelta en "Todos", en vez de dejar una selección vacía que no se podría
  // mandar.
  const toggleMember = (userId) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      setAllSelected(next.size === 0);
      return next;
    });
  };

  return (
    <View className="gap-2" nativeID={`${idPrefix}-trainer-picker`} testID={`${idPrefix}-trainer-picker`}>
      <TextInput
        className="h-12 rounded-full border border-slate-200 bg-white px-4 text-base dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        nativeID={`${idPrefix}-trainer-picker-search`}
        onChangeText={setQuery}
        placeholder="Buscar participante"
        placeholderTextColor={colors.onSurfaceVariant}
        testID={`${idPrefix}-trainer-picker-search`}
        value={query}
      />
      <Pressable
        className={`flex-row items-center gap-2.5 rounded-lg p-3 ${allSelected ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
        nativeID={`${idPrefix}-trainer-picker-all`}
        onPress={() => { setAllSelected(true); setSelectedUserIds(new Set()); }}
        testID={`${idPrefix}-trainer-picker-all`}
      >
        <MaterialCommunityIcons color={allSelected ? colors.primary : colors.onSurfaceVariant} name={allSelected ? 'check-circle' : 'checkbox-blank-circle-outline'} size={24} />
        <Text className="text-base font-semibold text-slate-800 dark:text-white" nativeID={`${idPrefix}-trainer-picker-all-label`} testID={`${idPrefix}-trainer-picker-all-label`}>Todos</Text>
      </Pressable>
      <ScrollView className="max-h-52" keyboardShouldPersistTaps="handled" nativeID={`${idPrefix}-trainer-picker-list`} testID={`${idPrefix}-trainer-picker-list`}>
        {visibleMembers.map((member) => {
          const checked = !allSelected && selectedUserIds.has(String(member.userId));
          return (
            <Pressable
              className="flex-row items-center gap-2.5 p-3"
              key={member.userId}
              nativeID={`${idPrefix}-trainer-picker-member-${member.userId}`}
              onPress={() => toggleMember(String(member.userId))}
              testID={`${idPrefix}-trainer-picker-member-${member.userId}`}
            >
              <MaterialCommunityIcons color={checked ? colors.primary : colors.onSurfaceVariant} name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} />
              <View className="h-2.5 w-2.5 rounded-full" nativeID={`${idPrefix}-trainer-picker-member-${member.userId}-dot`} style={{ backgroundColor: colorForUserId(member.userId) }} testID={`${idPrefix}-trainer-picker-member-${member.userId}-dot`} />
              <Text className="text-base text-slate-800 dark:text-white" nativeID={`${idPrefix}-trainer-picker-member-${member.userId}-name`} testID={`${idPrefix}-trainer-picker-member-${member.userId}-name`}>{member.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RunnerRecipientPicker({ idPrefix, trainerName, peerMembers, selectedUserId, setSelectedUserId }) {
  const colors = useThemeColors();
  return (
    <ScrollView className="max-h-52" keyboardShouldPersistTaps="handled" nativeID={`${idPrefix}-runner-picker`} testID={`${idPrefix}-runner-picker`}>
      <Pressable
        className={`flex-row items-center gap-2.5 p-3 ${selectedUserId === 'trainer' ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
        nativeID={`${idPrefix}-runner-picker-trainer`}
        onPress={() => setSelectedUserId('trainer')}
        testID={`${idPrefix}-runner-picker-trainer`}
      >
        <MaterialCommunityIcons color={selectedUserId === 'trainer' ? colors.primary : colors.onSurfaceVariant} name={selectedUserId === 'trainer' ? 'check-circle' : 'checkbox-blank-circle-outline'} size={24} />
        <Text className="text-base font-semibold text-slate-800 dark:text-white" nativeID={`${idPrefix}-runner-picker-trainer-label`} testID={`${idPrefix}-runner-picker-trainer-label`}>
          {trainerName ?? 'Entrenador'}
        </Text>
      </Pressable>
      {peerMembers.map((member) => {
        const selected = selectedUserId === String(member.userId);
        return (
          <Pressable
            className={`flex-row items-center gap-2.5 p-3 ${selected ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
            key={member.userId}
            nativeID={`${idPrefix}-runner-picker-peer-${member.userId}`}
            onPress={() => setSelectedUserId(String(member.userId))}
            testID={`${idPrefix}-runner-picker-peer-${member.userId}`}
          >
            <MaterialCommunityIcons color={selected ? colors.primary : colors.onSurfaceVariant} name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'} size={24} />
            <View className="h-2.5 w-2.5 rounded-full" nativeID={`${idPrefix}-runner-picker-peer-${member.userId}-dot`} style={{ backgroundColor: colorForUserId(member.userId) }} testID={`${idPrefix}-runner-picker-peer-${member.userId}-dot`} />
            <Text className="text-base text-slate-800 dark:text-white" nativeID={`${idPrefix}-runner-picker-peer-${member.userId}-name`} testID={`${idPrefix}-runner-picker-peer-${member.userId}-name`}>{member.name}</Text>
          </Pressable>
        );
      })}
      {peerMembers.length === 0 && (
        <Text className="p-3 text-sm text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-runner-picker-empty`} testID={`${idPrefix}-runner-picker-empty`}>
          Ningún compañero conectado todavía.
        </Text>
      )}
    </ScrollView>
  );
}

// Reemplaza a KeyboardAvoidingView -- con `behavior="height"` en Android, el
// compose quedaba bien posicionado mientras el teclado estaba arriba, pero
// al CERRARSE el teclado el View no volvía a su altura completa (bug real:
// franja transparente abajo que dejaba ver la pantalla de atrás, se
// "arreglaba" solo cerrando y reabriendo el modal -- o sea, un remount, no
// un resize real). Esto probablemente también explicaba el scroll roto sin
// teclado: un layout/hit-test desactualizado por la misma causa. Control
// manual del alto del teclado via eventos nativos -- sin ninguna animación
// de alto que se pueda quedar a mitad de camino.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

export function SessionMessagesModal({
  visible, onClose, role, myUserId, messages, onSend, isSending,
  rosterMembers, trainerName, trainerUserId, connectedPeerIds, idPrefix,
}) {
  const colors = useThemeColors();
  const keyboardHeight = useKeyboardHeight();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [type, setType] = useState('info');
  const [body, setBody] = useState('');
  // Entrenador: multi-select, siempre arranca en "Todos" (nunca sin
  // destinatario). Corredor: single-select ('trainer' o un userId string).
  const [allSelected, setAllSelected] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set());
  const [runnerRecipientId, setRunnerRecipientId] = useState('trainer');
  // Ocultar un hilo (sin backend para "borrar" un mensaje, Gap 27) -- solo
  // local, dura mientras este componente esté montado (toda la visita a la
  // sesión en vivo, el Modal se queda montado aunque `visible` esté en
  // false). Vuelve a verse si se sale y se reentra a la sesión.
  const [hiddenThreadIds, setHiddenThreadIds] = useState(() => new Set());

  const peerMembers = role === 'runner'
    ? rosterMembers.filter((m) => connectedPeerIds?.has(String(m.userId)))
    : [];

  const handleReply = (text, originalMessage) => {
    const clean = text.trim();
    if (!clean) return;
    onSend({
      type: 'info',
      recipientMode: 'direct',
      recipientUserIds: [originalMessage.senderUserId],
      body: clean,
      replyToMessageId: originalMessage.id,
    });
  };

  const handleSendCompose = () => {
    const clean = body.trim();
    if (!clean) return;
    if (role === 'trainer') {
      const recipients = deriveRecipients({ allSelected, selectedUserIds });
      if (!recipients) return;
      onSend({ type, ...recipients, body: clean });
    } else {
      // recipient_mode:'direct' exige EXACTAMENTE un id (contrato confirmado)
      // -- un array vacío no es "que el backend adivine el entrenador", es
      // simplemente inválido (400). Por eso el runner picker necesita
      // `trainerUserId` real, no solo el label `trainerName`.
      const recipientUserIds = runnerRecipientId === 'trainer' ? [trainerUserId] : [runnerRecipientId];
      onSend({ type, recipientMode: 'direct', recipientUserIds, body: clean });
    }
    setBody('');
  };

  const canSendCompose = role === 'trainer'
    ? Boolean(deriveRecipients({ allSelected, selectedUserIds })) && body.trim().length > 0
    // Si todavía no resolvió quién es el entrenador (useTeam en curso, ver
    // Task 9) y la elección actual es justo "Entrenador", no hay un id
    // válido para armar el mensaje -- se deshabilita en vez de mandar
    // recipient_user_ids:[undefined].
    : body.trim().length > 0 && (runnerRecipientId !== 'trainer' || Boolean(trainerUserId));

  const recipientSummaryLabel = role === 'trainer'
    ? (allSelected ? 'Todos' : `${selectedUserIds.size} seleccionado(s)`)
    : (runnerRecipientId === 'trainer' ? (trainerName ?? 'Entrenador') : rosterMembers.find((m) => String(m.userId) === runnerRecipientId)?.name ?? 'Elegí destinatario');

  const threads = groupMessagesByThread(messages);

  const toggleThreadHidden = (rootId) => {
    setHiddenThreadIds((current) => {
      const next = new Set(current);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  return (
    <Modal animationType="fade" nativeID={idPrefix} onRequestClose={onClose} testID={idPrefix} transparent visible={visible}>
      <Pressable className="flex-1 items-end bg-black/50" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        {/* View con responder manual, no Pressable -- frena la propagación del
            click al backdrop igual que un Pressable no-op, pero sin la lógica
            interna de Pressability (retención de press, sonido de toque de
            Android) que compite con el ScrollView hijo por el gesto. Bug real:
            un swipe lento sobre contenido no interactivo quedaba "retenido"
            como press por ese Pressable ancestro en vez de cederlo al scroll
            (sonaba el click de toque de Android), y solo un flick brusco
            alcanzaba a robarle el gesto a tiempo. onResponderTerminationRequest
            siempre en true para no resistirse nunca a cederle el gesto a un
            hijo (ScrollView o un botón Pressable interno). */}
        <View
          className="h-full w-full max-w-lg bg-white dark:bg-surface"
          nativeID={`${idPrefix}-card`}
          onResponderTerminationRequest={() => true}
          onStartShouldSetResponder={() => true}
          testID={`${idPrefix}-card`}
        >
          <SafeAreaView className="flex-1 p-4" edges={['top', 'bottom']} nativeID={`${idPrefix}-card-safe-area`} style={{ paddingBottom: keyboardHeight }} testID={`${idPrefix}-card-safe-area`}>
              <View className="mb-3 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
                <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>Mensajes</Text>
                <Pressable className="h-10 w-10 items-center justify-center rounded-full active:opacity-70" nativeID={`${idPrefix}-close-button`} onPress={onClose} testID={`${idPrefix}-close-button`}>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={24} />
                </Pressable>
              </View>

              {pickerOpen ? (
                <View className="flex-1" nativeID={`${idPrefix}-picker-area`} testID={`${idPrefix}-picker-area`}>
                  {role === 'trainer' ? (
                    <TrainerRecipientPicker
                      allSelected={allSelected}
                      idPrefix={idPrefix}
                      rosterMembers={rosterMembers}
                      selectedUserIds={selectedUserIds}
                      setAllSelected={setAllSelected}
                      setSelectedUserIds={setSelectedUserIds}
                    />
                  ) : (
                    <RunnerRecipientPicker
                      idPrefix={idPrefix}
                      peerMembers={peerMembers}
                      selectedUserId={runnerRecipientId}
                      setSelectedUserId={setRunnerRecipientId}
                      trainerName={trainerName}
                    />
                  )}
                  <Pressable
                    className="mt-3 h-12 items-center justify-center rounded-full bg-primary active:opacity-80"
                    nativeID={`${idPrefix}-picker-done-button`}
                    onPress={() => setPickerOpen(false)}
                    testID={`${idPrefix}-picker-done-button`}
                  >
                    <Text className="text-base font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-picker-done-label`} testID={`${idPrefix}-picker-done-label`}>Listo</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" nativeID={`${idPrefix}-list`} testID={`${idPrefix}-list`}>
                    {threads.map((thread) => (
                      <ThreadCard
                        hidden={hiddenThreadIds.has(thread.rootId)}
                        idPrefix={idPrefix}
                        key={thread.rootId}
                        myUserId={myUserId}
                        onReply={handleReply}
                        onToggleHidden={() => toggleThreadHidden(thread.rootId)}
                        replyDisabled={isSending}
                        rosterMembers={rosterMembers}
                        thread={thread}
                        trainerName={trainerName}
                      />
                    ))}
                    {threads.length === 0 && (
                      <Text className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>
                        Todavía no hay mensajes en esta sesión.
                      </Text>
                    )}
                  </ScrollView>

                  <View className="gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800" nativeID={`${idPrefix}-compose`} testID={`${idPrefix}-compose`}>
                    <View className="flex-row gap-2.5" nativeID={`${idPrefix}-compose-type-row`} testID={`${idPrefix}-compose-type-row`}>
                      {Object.entries(TYPE_META).map(([key, meta]) => (
                        <Pressable
                          className={`h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border-2 px-2 ${type === key ? `${meta.border} ${meta.bg}` : 'border-slate-200 dark:border-slate-700'}`}
                          key={key}
                          nativeID={`${idPrefix}-compose-type-${key}`}
                          onPress={() => setType(key)}
                          testID={`${idPrefix}-compose-type-${key}`}
                        >
                          <MaterialCommunityIcons color={type === key ? meta.iconColor : colors.onSurfaceVariant} name={meta.icon} size={20} />
                          <Text className={`text-sm font-semibold ${type === key ? meta.text : 'text-slate-600 dark:text-slate-300'}`} nativeID={`${idPrefix}-compose-type-${key}-label`} testID={`${idPrefix}-compose-type-${key}-label`}>
                            {meta.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Pressable
                      className="h-12 flex-row items-center justify-between rounded-full border border-slate-200 px-4 active:opacity-70 dark:border-slate-700"
                      nativeID={`${idPrefix}-compose-recipient-button`}
                      onPress={() => setPickerOpen(true)}
                      testID={`${idPrefix}-compose-recipient-button`}
                    >
                      <Text className="text-base font-medium text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-compose-recipient-label`} numberOfLines={1} testID={`${idPrefix}-compose-recipient-label`}>
                        {recipientSummaryLabel}
                      </Text>
                      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={22} />
                    </Pressable>

                    <View className="flex-row items-end gap-2.5" nativeID={`${idPrefix}-compose-input-row`} testID={`${idPrefix}-compose-input-row`}>
                      <TextInput
                        className="min-h-14 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        multiline
                        nativeID={`${idPrefix}-compose-input`}
                        onChangeText={setBody}
                        placeholder="Escribí un mensaje…"
                        placeholderTextColor={colors.onSurfaceVariant}
                        testID={`${idPrefix}-compose-input`}
                        value={body}
                      />
                      <Pressable
                        className="h-12 w-12 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-40"
                        disabled={!canSendCompose || isSending}
                        nativeID={`${idPrefix}-compose-send-button`}
                        onPress={handleSendCompose}
                        testID={`${idPrefix}-compose-send-button`}
                      >
                        <MaterialCommunityIcons color="#111518" name="send" size={24} />
                      </Pressable>
                    </View>
                  </View>
                </>
              )}
          </SafeAreaView>
        </View>
      </Pressable>
    </Modal>
  );
}

const SEVERITY_META = {
  aviso: { border: 'border-amber-300 dark:border-amber-700/60', icon: 'alert-outline', iconColor: '#d97706', title: 'text-amber-700 dark:text-amber-400', button: 'bg-amber-500' },
  alerta: { border: 'border-red-300 dark:border-red-900/50', icon: 'alert-decagram', iconColor: '#dc2626', title: 'text-red-700 dark:text-red-400', button: 'bg-red-600' },
};

// Modal bloqueante para "aviso"/"alerta" (Gap 27) -- estilo según severidad
// (borde/ícono/botón ámbar para aviso, rojo para alerta), compartido entre
// las dos pantallas en vivo (entrenador/corredor) que lo montan igual.
export function DeliverySeverityModal({ visible, message, onClose, idPrefix }) {
  const meta = SEVERITY_META[message?.type] ?? SEVERITY_META.aviso;
  return (
    <Modal animationType="fade" nativeID={idPrefix} onRequestClose={onClose} testID={idPrefix} transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable className={`w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl dark:bg-surface ${meta.border}`} nativeID={`${idPrefix}-card`} onPress={() => {}} testID={`${idPrefix}-card`}>
          <View className="mb-3 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
            <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={22} />
            <Text className={`text-lg font-bold ${meta.title}`} nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
              {message?.type === 'alerta' ? 'Alerta' : 'Aviso'}
            </Text>
          </View>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
            {message?.body}
          </Text>
          <Pressable className={`mt-5 h-11 items-center justify-center rounded-full active:opacity-80 ${meta.button}`} nativeID={`${idPrefix}-close-button`} onPress={onClose} testID={`${idPrefix}-close-button`}>
            <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID={`${idPrefix}-close-label`} testID={`${idPrefix}-close-label`}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
