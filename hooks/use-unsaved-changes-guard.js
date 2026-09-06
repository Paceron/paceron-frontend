import { useEffect, useRef, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { isWeb } from '../utils/platform.js';

// Intercepta la salida de un form con cambios sin guardar: back
// nativo/gesto/header (usePreventRemove, cubre remoción de ruta real) y
// cierre explícito vía `guardedClose` (para botones de back propios que
// llaman router.back()/router.replace() a mano, y para modales de RN que
// no son rutas — ver components/shared/discard-changes-modal.jsx).
export function useUnsavedChangesGuard(isDirty) {
  const navigation = useNavigation();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const pendingActionRef = useRef(null);

  usePreventRemove(isDirty, (e) => {
    pendingActionRef.current = () => navigation.dispatch(e.data.action);
    setConfirmVisible(true);
  });

  useEffect(() => {
    if (!isWeb) return undefined;
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const guardedClose = (closeFn) => {
    if (!isDirty) {
      closeFn();
      return;
    }
    pendingActionRef.current = closeFn;
    setConfirmVisible(true);
  };

  const confirmDiscard = () => {
    setConfirmVisible(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  };

  const cancelDiscard = () => setConfirmVisible(false);

  return { confirmVisible, guardedClose, confirmDiscard, cancelDiscard };
}
