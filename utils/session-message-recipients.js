// Deriva recipient_mode/recipient_user_ids de la selección del selector
// multi-destinatario del entrenador (checkboxes + atajo "Todos") -- función
// pura para que el modal no tenga que decidir la regla inline. `null` cuando
// la selección no alcanza para mandar nada (ni "Todos" tocado, ni ningún
// destinatario marcado) -- el caller usa esto para deshabilitar "Enviar".
export function deriveRecipients({ allSelected, selectedUserIds }) {
  if (allSelected) return { recipientMode: 'all', recipientUserIds: [] };
  const ids = [...(selectedUserIds ?? [])];
  if (ids.length === 0) return null;
  if (ids.length === 1) return { recipientMode: 'direct', recipientUserIds: ids };
  return { recipientMode: 'multiple', recipientUserIds: ids };
}
