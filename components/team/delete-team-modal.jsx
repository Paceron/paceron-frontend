import { useEffect, useState } from 'react';
import { notifyWarning } from '../../utils/haptics.js';
import { ConfirmDestructiveModal } from '../shared/confirm-destructive-modal.jsx';

// Mismo patrón que DeactivateTrainerModal — confirmación de una acción
// destructiva e irreversible (a diferencia de esa, esta sí borra datos:
// el equipo entero), un click alcanza porque ya está detrás de un botón
// que solo ve quien administra el equipo.
export function DeleteTeamModal({ visible, teamName, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) notifyWarning();
  }, [visible]);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <ConfirmDestructiveModal
      idPrefix="delete-team-modal"
      visible={visible}
      title="Eliminar equipo"
      description={`Vas a eliminar "${teamName}" de forma permanente. Esta acción no se puede deshacer.`}
      confirmLabel="Eliminar"
      loading={loading}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );
}
